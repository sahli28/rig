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
(CGU Rack, politique de confidentialité) a `tenant_id null` ; un consentement propre
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

### Douze pièges déjà payés, à ne pas repayer

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
10. **Un contrôle de sécurité qui lit des tables protégées doit être
    `security definer`.** `forbid_orphaning_tenant` lit `memberships` et
    `tenants` en RLS `force`, sous le rôle qui supprime `auth.users` — lequel n'a
    pas `bypassrls`. Sans `security definer`, son `select` ne voyait rien, le
    garde passait, et la box devenait orpheline dans le cas même qu'il devait
    empêcher. C'est le piège de la récursion en miroir : la RLS qui **vide en
    silence** le résultat d'un contrôle.
11. **Durcir une table sans durcir ses voisines laisse la porte la plus large
    ouverte.** `tenant_settings`, `themes`, `locations` et `rooms` ont reçu une
    garde de rôle ; `tenants` non. Or `tenants.timezone` gouverne la fenêtre
    d'annulation : un MEMBER faisait pire en changeant le fuseau qu'en touchant
    `cancel_window_minutes`. Après avoir gardé une table, faire l'inventaire de
    celles qui portent la même donnée sous un autre nom.

12. **Une contrainte CHECK qui s'évalue à NULL passe.** Écrite
    `check (jsonb_typeof(name_i18n -> 'fr') = 'string')`, la contrainte
    censée imposer un nom français **acceptait** `{"en": "…"}` : la clé absente
    rend l'opérateur NULL, la comparaison NULL, et PostgreSQL ne rejette une
    ligne que sur un `false` franc. Commencer par un terme qui rend un booléen —
    `name_i18n -> 'fr' is not null and …` — parce que `false and null` vaut
    `false`. Trouvé par un test, pas par la relecture : la contrainte se lisait
    juste.

### La RLS ne borne pas les colonnes

Une policy dit **quelles lignes**, jamais quelles colonnes. Dès qu'une ligne
contient à la fois des champs éditables et des champs de gouvernance —
`deleted_at`, `created_at`, `status`, `currency` — la policy seule ne suffit pas.

L'outil est le droit au niveau colonne, qui s'ajoute à la policy :

```sql
revoke update on public.users from authenticated;
grant update (first_name, last_name, birthdate, gender, locale, avatar_url)
  on public.users to authenticated;
```

Différence visible en test : un refus par **policy** n'affecte aucune ligne et ne
lève pas ; un refus par **grant de colonne** lève `42501`. Le second est donc
plus facile à tester — et plus explicite pour l'appelant.

Ce piège s'est présenté trois fois dans P0-004 : `tenants` (tout membre pouvait
changer le fuseau), `tenants` de nouveau (un MANAGER pouvait fermer la box), puis
`users` (chacun pouvait poser son propre `deleted_at`). Trois fois le même
raisonnement manquant.

**Une quatrième fois en P1-003c, et cette fois sur la lecture.** `memberships`
rend toutes ses colonnes à tout membre du tenant depuis P0-004 — assumé, parce
qu'elle ne portait que `user_id`, `role`, `status` et des dates. Y ajouter
`hidden_from_roster`, une **opposition RGPD**, a rendu lisible par les pairs
exactement ce que la vue `class_roster` existe pour leur cacher. La colonne
n'avait pas changé la table : elle avait changé sa sensibilité, et personne
n'avait de raison de rouvrir un grant qui ne bougeait pas.

D'où deux choses à connaître avant de les découvrir :

- **`select *` sur `memberships` échoue en `42501` pour `authenticated`**, donc
  `tenantScope().select('memberships')` aussi — le helper ne sait pas projeter,
  c'est un compromis assumé ailleurs et une conséquence ici. Sa propre opposition
  se lit par `get_roster_visibility()`, son pendant en écriture est
  `set_roster_visibility()` ;
- **ajouter une colonne à une table déjà exposée est une décision d'exposition**,
  pas une décision de schéma. La question à poser est « qui lit déjà cette
  table ? », et elle ne se pose pas toute seule : ici c'est `rls-auditor` qui l'a
  posée, après que les tests, la vue et sa suite pgTAP étaient verts.

### Ce que les tests d'isolation ne voient pas

Une suite qui teste **le tenant A contre le tenant B** ne peut pas voir une
élévation de privilège entre un `MEMBER` et un `OWNER` de la **même** box. C'est
là que s'était logée `tenants_member_update`, et aucun des tests inter-tenant ne
pouvait la détecter.

Toute table portant une garde de rôle a donc besoin de son cas dans
`supabase/tests/role_isolation_test.sql` : un MEMBER qui tente, un OWNER qui
réussit. La policy `using` masquant la ligne, l'`UPDATE` refusé **ne lève pas** —
il n'affecte aucune ligne. C'est la valeur inchangée qui prouve la garde, jamais
une exception.

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
- **Une migration déjà versionnée ne se modifie pas** — le hook
  `.claude/hooks/guard-migrations.mjs` la bloque, et c'est le bon défaut. La
  **règle 13 de `CLAUDE.md`** dit l'exception et sa date de péremption : tant
  qu'aucune base de production n'existe, corriger en place est plus propre
  qu'ajouter une migration de rattrapage, parce qu'une cicatrice dans
  l'historique d'un projet sans données ne documente rien. **Le jour où une base
  de production existe, l'exception disparaît sans discussion.**
  Ces deux lignes disaient l'inverse l'une de l'autre entre le 4 et le
  5 septembre 2026 : la règle 13 est arrivée ici sans que celle-ci bouge.
- **Le garde ne couvre qu'un chemin sur deux.** Il s'exécute sur
  `PreToolUse(Edit|Write)`. Un script Node lancé en Bash écrit le même fichier
  sans qu'il voie rien — c'est ce qui s'est passé au renommage `D-013`, et le
  hook n'a pas échoué : il n'était pas sur le chemin. Un garde qui se croit
  étanche est plus dangereux qu'un garde qui dit sa portée.
- Toute migration doit être réversible ou documenter pourquoi elle ne l'est pas.
- Pas de `drop column` sans étape de dépréciation préalable.

### Tout test qui lit hors de son paquet doit le déclarer à Turbo

**Le titre a compté.** Cette section s'est d'abord appelée « une migration
ajoutée doit invalider les tests qui lisent les migrations », et la règle
générale était en dernière ligne. Une semaine plus tard, deux tests écrits
**dans le commit qui appliquait la leçon** rouvraient la même faille sur
d'autres fichiers. Un cas particulier en titre ne protège que ce cas.

Un test qui lit un fichier à l'exécution crée une dépendance que Turbo **ne
déduit pas** si elle sort du paquet. Sans déclaration, modifier ce fichier ne
change pas le hash de la tâche : le cache ressert un résultat calculé **avant**,
et le test rend vert sans avoir rien vu. C'est la panne la plus coûteuse, parce
qu'elle rassure.

La forme du symptôme, à reconnaître du premier coup d'œil :

    local : cache hit, replaying logs a8f090fa5772d266   → vert
    CI    : cache miss, executing    a8f090fa5772d266   → rouge

**Le même hash.** Deux verts, un seul vrai. En P1-003, six codes d'erreur
manquaient dans `APP_ERROR_CODES`, invisibles en local, rouges en CI.

La parade est dans `turbo.json`, et son commentaire tient la liste **qui lit
quoi** — à compléter en même temps qu'on écrit le test, pas après :

```json
"globalDependencies": ["supabase/migrations/**", "supabase/seed.sql", "apps/mobile/app/**"]
```

| Fichiers | Lus par | Pour vérifier quoi |
| --- | --- | --- |
| `supabase/migrations/**` | `errors.test.ts`, `me.test.ts`, `default-brand.test.ts` | tout code levé a sa clé i18n ; la forme de `me()` ; le défaut de `primary_color` |
| `supabase/seed.sql` | `default-brand.test.ts` | la couleur de la plateforme n'est celle d'aucune box |
| `apps/mobile/app/**` | `invitation-link.test.ts` | le mobile a une route pour le lien que le web distribue |

`globalDependencies` plutôt que des `inputs` par tâche. `..` dans un `inputs`
**fonctionne** — mesuré sur turbo 2.10.12, les deux hashes bougent — mais c'est
un comportement non documenté sur lequel on parierait la justesse du cache, et
deux mécanismes pour un même souci finissent avec un seul entretenu. L'oubli
d'aujourd'hui est déjà celui-là. L'invalidation est large ; elle ne coûte que du
recalcul, jamais un faux vert.

**Vérifier, pas supposer.** `touch` ne prouve rien — Turbo hache le contenu, pas
la date. Le protocole qui prouve, en trois mesures :

```bash
pnpm exec turbo run test --dry=json     # hash de la tâche, arbre propre
# … modifier réellement le fichier surveillé …
pnpm exec turbo run test --dry=json     # le hash doit avoir changé
```

`globalCacheInputs.files` du même JSON liste tout ce qui entre dans le hash
global : si le fichier n'y est pas, la déclaration ne mord pas.

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

## Énumérer les sœurs

C'est le treizième piège, et le plus rentable : **cinq des cinq trous trouvés
depuis P0-004 ont la même forme — un chemin bien gardé, et son jumeau oublié.**

| Gardé | Oublié | Ce que ça donnait |
| --- | --- | --- |
| `tenant_settings` protégé par une garde de rôle | `tenants` ne l'était pas | n'importe quel membre changeait le fuseau de sa box, donc la fenêtre d'annulation de tout le monde |
| `create_tenant` vérifiait le quota de boxes | ni `accept_invitation`, ni `set_member_role` | le plafond se contournait par une invitation `OWNER` |
| `tenantScope.insert()` imposait le `tenant_id` | `update()` se contentait de filtrer | un patch déplaçait la ligne dans une autre box, et la RLS laissait passer |
| `users` passée en revue pour construire la vue restreinte | `audit_logs` et `ledger_entries`, ses voisines immédiates | protégées par tenant sans garde de rôle : un simple MEMBER lisait tout le journal d'audit de sa box — diffs des changements de rôle compris — et toutes les écritures comptables, dont la somme est le chiffre d'affaires |
| Les **policies**, écrites avec soin sur les treize tables | les **droits de table**, jamais regardés | `anon` et `authenticated` détenaient `arwdDxtm` partout. Un simple MEMBER pouvait `TRUNCATE` les treize tables — comptabilité et journal d'audit des deux boxes compris |

## `TRUNCATE` échappe à la RLS, et au trigger append-only

Le cinquième cas mérite son paragraphe, parce que rien ne le laisse deviner.

**Aucune policy ne s'applique à `TRUNCATE`** : ce n'est pas une opération ligne à
ligne, il n'y a pas de ligne à filtrer. Une policy `for all` ne le couvre pas
davantage — son « all » désigne `select`, `insert`, `update`, `delete`, pas tous
les privilèges.

**`forbid_mutation` ne le voit pas non plus** : c'est un `before update or
delete`. Les deux protections sur lesquelles reposent `ledger_entries` et
`audit_logs` sont donc contournées par un seul ordre, pour peu que le rôle en ait
le droit — et il l'avait, par les privilèges par défaut de Supabase.

Ce qui nous protégeait était **l'absence de chemin** : PostgREST n'expose aucun
verbe qui produise un `TRUNCATE`, et `anon`/`authenticated` sont `NOLOGIN`. Une
couche, là où le garde-fou n°6 de l'ADR 0002 en demande deux.

**Toute nouvelle table pose donc ses `grant` dans la même migration que ses
policies.** Les privilèges par défaut du schéma ont été retirés à `anon` et
`authenticated` : sans grant explicite, une table neuve est inaccessible — ce qui
est le bon défaut. `rls_leak_test.sql` confronte les deux listes et signale aussi
bien un droit sans policy qu'une policy sans droit.

Aucun n'a été trouvé par les tests ni par `rls-auditor` : ils vérifient ce qui
est écrit, pas ce qui manque. Seule la relecture les a vus, et seulement en
cherchant explicitement le jumeau.

**Avant de considérer une protection comme posée, énumérer ses sœurs :**

- l'opération : `insert`, `update`, **et** `delete` — protéger l'une ne dit rien
  des autres, et `update` est presque toujours celle qu'on oublie ;
- la ligne **et** la colonne : une policy dit *quelles lignes*, un `grant (col)`
  dit *quelles colonnes*. Autoriser l'écriture d'une ligne autorise l'écriture
  de toutes ses colonnes ;
- la table **et** sa jointure : `memberships` et `tenants`, `consents` et
  `users` ;
- la fonction **et** le trigger qui l'appelle : rendre l'une `security definer`
  ne fait rien pour l'autre, qui lit pourtant les mêmes tables ;
- le contrôle porté par **une** fonction n'est pas un invariant. Un invariant
  vit sur la table, là où l'état change — il couvre alors aussi les chemins
  qu'on écrira plus tard ;
- le tenant **et** le rôle : `tenant_id in (select current_tenant_ids())` dit
  « c'est bien ta box ». Il ne dit pas « tu as le droit d'y voir ça ». Dans un
  produit à quatre rôles, une policy qui ne mentionne que le tenant est un
  candidat à relire — et c'est ainsi que se sont trouvés `tenants`,
  `audit_logs` et `ledger_entries`. `current_admin_tenant_ids()` existe pour ça.

## Vues : deux décisions déjà prises

- **`security_invoker = false` sur `member_admin_directory`, et l'alerte
  Supabase qui va avec.** L'advisor la signale sous `security_definer_view` à
  chaque passage sur le tableau de bord. C'est **voulu et définitif** : en
  `security_invoker = true`, la policy `id = auth.uid()` de `users` s'applique à
  l'appelant et la vue ne rend que lui-même. Supabase n'offre pas de
  suppression par objet ; l'alerte reste donc allumée. Ne pas la re-litiger à
  chaque ouverture du tableau de bord — la garantie est le `WHERE` de la vue,
  et `rls_leak_test.sql` la vérifie de deux façons.
- **Aucune vue matérialisée**, et un test le fige. La RLS **ne s'applique pas**
  à une `matview` : c'est un instantané, servi identique à tout le monde. Le
  jour où un cache de leaderboard en réclame une, ce sera une décision explicite,
  pas un objet posé en passant.

Formulé autrement : la question utile n'est pas « ce que je viens d'écrire
est-il correct ? » mais « qu'est-ce qui, ailleurs, fait la même chose et n'a pas
été touché ? »

## Un jeton stocké est un jeton compromis à terme

`invitations.token` était en clair, avec un index unique dessus (D-005). Chaque
ligne était un identifiant **vivant** : la présenter à `accept_invitation()`
ouvrait une appartenance dans une box, au rôle inscrit dans la ligne.

L'exposition était bornée — seuls `OWNER` et `MANAGER` lisaient la table — mais
c'est exactement le raisonnement que D-006 a démonté quelques heures plus tôt.

**La règle, pour tout secret qu'on doit seulement reconnaître :**

- stocker `encode(extensions.digest(valeur, 'sha256'), 'hex')`, jamais la valeur ;
- non salé, et c'est correct ici : la recherche se fait **par empreinte**, et un
  jeton est une valeur aléatoire de 192 bits, pas un mot de passe à faible
  entropie. Le sel sert contre les tables arc-en-ciel sur un espace devinable ;
- nommer la colonne `_hash`. Une colonne qui ne contient plus ce que son nom
  annonce est une invitation à s'en servir mal ;
- la valeur en clair n'existe **qu'une fois**, dans le retour de la fonction qui
  la crée. Le motif est celui des clés d'API : montrée une fois, perdue ensuite,
  et « réafficher » n'existe pas — seulement « régénérer ».

Corollaire d'interface, à ne pas oublier côté écran : si la valeur ne se rattrape
pas, l'écran doit l'afficher immédiatement et le dire.

Ce qui vaudra aussi pour les jetons de check-in QR (P1-008) et pour toute clé de
webhook entrante.

## Trois décisions de P1-001 qu'il ne faut pas re-litiger

Elles se sont posées deux ou trois fois chacune. Les voici tranchées.

**La frontière OWNER / MANAGER se coupe par table, pas par colonne.**
`tenants` — nom, slug, fuseau, devise, langue — au seul propriétaire ;
`tenant_settings`, `opening_hours`, `locations`, `rooms`, `class_types` au
gestionnaire aussi. Une frontière par colonne se serait re-négociée à chaque
nouvelle colonne. À l'écran, le bloc identité est en lecture seule **avec la
phrase qui l'explique**.

**Le journal d'audit s'écrit dans la même transaction que l'action**, et
`log_audit()` lève si l'appelant n'est pas membre **actif**. D'où un ordre qui
est une question de correction, pas de style : `leave_tenant` journalise
**avant** de passer le statut à `LEFT` ; `accept_invitation` et `create_tenant`
**après** l'insertion de l'appartenance.

**`opening_hours` est une table, pas un `jsonb`** : une fonction PLpgSQL la
joint (P1-002). Ses heures sont des `time` **nus**, en heure locale de la box —
jamais `timetz`, jamais UTC. Le chevauchement de deux créneaux n'est **pas**
garanti par la base : il vit dans `overlappingSlots()`, et la migration le dit.
