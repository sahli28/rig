---
paths:
  - 'supabase/**/*.sql'
  - 'supabase/**/*.ts'
  - 'packages/core/src/db/**/*.ts'
---

# Règles base de données

## Multi-tenancy — vérifier à chaque nouvelle table

Toute table métier :

```sql
create table <nom> (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- colonnes métier
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz          -- règle 10 de CLAUDE.md : pas de DELETE physique
);

-- `tenant_id` en tête de clé composite : il est dans le prédicat de chaque requête.
create index <nom>_tenant_idx on <nom> (tenant_id, created_at desc);

create trigger <nom>_set_updated_at before update on <nom>
  for each row execute function public.set_updated_at();

alter table <nom> enable row level security;
alter table <nom> force row level security;
```

Exceptions autorisées (tables globales, sans `tenant_id`) : `users`, `movements`,
`hyrox_stations`, `benchmarks`, `personal_records`, `devices`.
Ces données suivent la **personne**, pas la box : un membre inscrit dans deux boxes
garde un seul compte, un seul appareil, un seul historique de PR.

Deux autres exceptions, d'une autre nature :

- `tenants` — elle *est* le tenant, le filtre porte sur `id`.
- `processed_webhook_events` — déduplication Stripe globale par identifiant
  d'événement. Table d'infrastructure : RLS forcée **sans aucune policy**, ce qui
  la rend invisible et intouchable pour `authenticated`.

Cas particulier — `consents` : `tenant_id uuid null`. Un consentement plateforme
(CGU RIG, politique de confidentialité) a `tenant_id null` ; un consentement propre
à une box (CGV, leaderboard, partage inter-box) porte son `tenant_id`. Elle est donc
exemptée du `not null` et du motif de policy standard :

```sql
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and (tenant_id is null or tenant_id in (select public.current_tenant_ids()))
)
```

C'est la seule table hybride ; toute autre exception doit être justifiée dans le
commit **et** ajoutée à la liste d'exceptions de `supabase/tests/rls_leak_test.sql`,
qui échoue sinon.

Chaque table reçoit au minimum une policy `select` et une policy d'écriture basées
sur l'appartenance au tenant, jamais sur un `tenant_id` fourni par le client :

```sql
create policy <table>_tenant_select on <table> for select to authenticated
  using (tenant_id in (select public.current_tenant_ids()));

create policy <table>_tenant_write on <table> for all to authenticated
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));
```

Le `(select …)` autour de l'appel n'est pas cosmétique : il permet à Postgres de
mettre le résultat en cache d'initplan au lieu de le réévaluer à chaque ligne.

### Neuf pièges déjà payés, à ne pas repayer

Chacun a coûté un aller-retour d'audit sur le ticket P0-004. Ils sont ici plutôt
que dans le ticket parce qu'un ticket clos ne se relit jamais.

1. **`current_tenant_ids()` est `security definer`, et ne doit jamais prendre de
   paramètre.** En `security invoker` elle serait soumise à la RLS de
   `memberships`, dont la policy l'appelle : `infinite recursion detected in
   policy for relation "memberships"`. Sa sûreté tient à son absence de
   paramètre — elle ne peut retourner que les tenants de l'appelant.
2. **`memberships` n'a aucune policy d'écriture.** Un `with check` d'appartenance
   rendrait la première appartenance ininsérable ; et une garde de rôle dans un
   `with check` valide *qui* écrit, pas *ce qui* est écrit — un MANAGER pouvait
   ainsi réécrire le `user_id` d'une ligne OWNER et évincer le propriétaire.
   Tout passe par `create_tenant()`, `accept_invitation()`, `set_member_role()`,
   `remove_member()`, `leave_tenant()`.
3. **La RLS isole les tenants, pas les rôles.** Pour toute table sensible
   (argent, données de santé, notes de coach), faire entrer le rôle dans le
   prédicat au lieu de compter sur l'API seule.
4. **Une FK vers une table tenant-scopée est composite `(id, tenant_id)`.** Une FK
   simple laisse une salle de la box A référencer une adresse de la box B, et un
   `on delete cascade` côté B détruit alors des lignes de A. Corollaire : écrire
   `on delete set null (colonne)` **avec la liste de colonnes** — sans elle,
   PostgreSQL annule toute la clé, `tenant_id` compris, qui est `not null`, et la
   suppression de compte RGPD casse.
5. **Une table qui doit survivre à ses acteurs n'a pas de FK vers eux.**
   `audit_logs.actor_membership_id` est volontairement sans contrainte : une
   trace d'audit qui s'efface ou mute quand son auteur est supprimé ne prouve
   plus rien.
6. **Deux policies permissives s'additionnent.** Une policy `for all` couvre déjà
   le `select` : en ajouter une `_select` au même prédicat est redondant et
   surtout piégeux — resserrer la `_select` ne restreint rien. Une policy `for all`
   par table, ou des policies par commande, jamais les deux.
7. **Un contrôle d'identité ne s'appuie jamais sur une colonne que le client
   écrit.** `accept_invitation()` comparait l'e-mail de l'invitation à
   `public.users.email` — que l'utilisateur pouvait réécrire. Il suffisait de se
   donner l'adresse de l'invité pour consommer un jeton nominatif capté. La
   comparaison porte sur `auth.jwt() ->> 'email'`, vérifié par le fournisseur
   d'identité, et un trigger gèle la colonne.
8. **Un trigger `before delete` bloque aussi les cascades.** Sur une table
   référencée par `on delete cascade`, il fait échouer la suppression de compte.
   Contre un `DELETE` client, la protection est l'**absence de policy** ; le
   trigger append-only ne porte que sur l'`UPDATE`. C'est pour cette raison que
   `consents` n'a pas de trigger `no_delete` et que `audit_logs` en a un — cette
   dernière n'est plus référencée par `users`.
9. **Retirer une capacité d'écriture oblige à fournir son remplacement dans le
   même commit.** Supprimer la policy `insert` de `users` en écrivant « la fiche
   est créée côté serveur » a rendu l'inscription impossible : le mécanisme
   serveur n'existait pas. Le seed et les tests, qui insértaient en
   superutilisateur, masquaient la panne. Corollaire : **un test qui court-circuite
   le vrai chemin ne teste rien** — le seed exerce désormais le trigger
   `on_auth_user_created` au lieu d'écrire directement dans `public.users`.

### `service_role` contourne tout

`service_role` a `rolbypassrls`. **Toute requête émise avec la clé de service
ignore l'intégralité des policies.** L'API applicative agit sous le JWT de
l'utilisateur (rôle `authenticated`) ; `service_role` est réservé aux webhooks et
aux tâches d'administration, dans des fichiers serveur explicitement identifiés.
La clé ne doit jamais atteindre `apps/mobile` ni un composant client de `apps/web`.

### Écriture d'une donnée que le client ne doit pas forger

`audit_logs` et `ledger_entries` n'ont qu'une policy `select`. Sans policy
d'écriture, un membre ne peut pas fabriquer d'entrée d'audit ni de ligne
comptable dans sa propre box. Les écritures passent par le serveur.

### Les montants : `integer` n'est pas un garde-fou

`amount_cents integer` **arrondit** un décimal au lieu de le rejeter : insérer
`89.5` donne `90`, sans erreur. Vérifié par test.

Deux gardes, donc, et aucune n'est la colonne :

- côté TypeScript, le schéma Zod de `packages/core` (`.int()`) ;
- côté SQL, **tout paramètre de montant d'une fonction PLpgSQL est typé
  `integer`**, jamais `numeric` — sinon l'arrondi se produit à l'entrée de la
  fonction, avant même d'atteindre la colonne.

### Où la box accède à la preuve de consentement

`consents` n'est pas seulement une donnée personnelle : la box est responsable de
traitement pour ses membres et doit pouvoir **prouver** leur consentement
(accountability RGPD). D'où une seconde policy `select`, réservée aux OWNER et
MANAGER, strictement bornée aux consentements portant **leur** `tenant_id`. Les
consentements plateforme (`tenant_id is null`) leur restent invisibles.

Sans ce chemin, la seule issue aurait été la clé de service — qui donnerait
infiniment plus.

Limite connue : la policy porte sur des **lignes**, pas des colonnes, donc
`ip` et `user_agent` du consentement sont visibles avec le reste. Défendable pour
une preuve de consentement, mais à reprendre par une vue projetée si l'on veut
s'en tenir au strict nécessaire.

### Deux tables où le contenu n'est pas contraint par la base

- `log_audit(p_diff jsonb)` : l'acteur et le tenant sont vérifiés, **pas le
  contenu du `diff`**. Rien n'empêche d'y écrire une donnée de santé, que
  `privacy.md` interdit. Le filtrage est la responsabilité de l'appelant.
- `audit_logs.target_id` et `ledger_entries.ref_id` sont polymorphes, sans clé
  étrangère. Acceptable — aucun client ne peut les écrire — mais aucune
  intégrité référentielle ne les protège.

Après toute nouvelle table, ajouter son cas au test anti-fuite
`supabase/tests/rls_leak_test.sql` — le test itère sur `information_schema.tables`
et échoue si une table n'a pas de policy.

## Migrations

- Une migration = un changement cohérent, nommée `<timestamp>_<verbe>_<objet>.sql`.
- **Jamais** de modification d'une migration déjà versionnée (le hook la bloque).
- Toute migration doit être réversible ou documenter pourquoi elle ne l'est pas.
- Pas de `drop column` sans étape de dépréciation préalable.

## Logique métier transactionnelle

Ces opérations sont des fonctions PLpgSQL, jamais du TypeScript :
`book_class`, `cancel_booking`, `join_waitlist`, `promote_waitlist`,
`debit_credits`, `refund_credits`, `settle_cross_box_booking`.

Motif obligatoire pour la réservation :

```sql
select * from classes where id = p_class_id for update;  -- verrou de ligne
-- vérifier capacité, droits, fenêtre, doublon
-- insérer booking + débit crédit + incrément booked_count
-- le tout dans la MÊME transaction
```

Contraintes qui doivent exister et ne jamais être retirées :

- `unique (class_id, membership_id) where status = 'CONFIRMED'` sur `bookings`
- `check (booked_count <= capacity)` sur `classes`
- `unique (idempotency_key)` sur `bookings` et `payments`

## Argent

- `amount_cents integer`, `currency char(3)`. Jamais `numeric`, jamais `float`.
- `ledger_entries` est append-only : un trigger `before update or delete` lève une exception.
- Une correction se fait par contre-écriture, jamais par modification.
