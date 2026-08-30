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
tenant_id uuid not null references tenants(id),
-- index en tête de clé composite
create index on <table> (tenant_id, <colonne_de_filtrage>);
alter table <table> enable row level security;
alter table <table> force row level security;
```

Exceptions autorisées (tables globales, sans `tenant_id`) : `users`, `movements`,
`hyrox_stations`, `benchmarks`, `personal_records`, `devices`.
Ces données suivent la **personne**, pas la box : un membre inscrit dans deux boxes
garde un seul compte, un seul appareil, un seul historique de PR.

Cas particulier — `consents` : `tenant_id uuid null`. Un consentement plateforme
(CGU RIG, politique de confidentialité) a `tenant_id null` ; un consentement propre
à une box (CGV de la box, leaderboard, partage inter-box) porte son `tenant_id`.
La table est donc exemptée du `not null` et du motif de policy standard : elle reçoit
sa propre policy `user_id = auth.uid() and (tenant_id is null or tenant_id = (select auth_tenant_id()))`.
C'est la seule table hybride ; toute autre exception doit être justifiée dans le commit.

Chaque table reçoit au minimum une policy `select` et une policy `all` basées sur
l'appartenance au tenant courant, jamais sur un `tenant_id` fourni par le client :

```sql
create policy tenant_isolation on <table>
  using (tenant_id = (select auth_tenant_id()))
  with check (tenant_id = (select auth_tenant_id()));
```

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
