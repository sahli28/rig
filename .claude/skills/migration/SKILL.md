---
name: migration
description: Crée une migration Supabase complète — schéma, RLS, policies, index, test pgTAP.
argument-hint: [nom_de_la_migration]
disable-model-invocation: true
---

Crée la migration **$0**.

## Étapes

1. `npx supabase migration new $0` pour obtenir un fichier horodaté.
   **Ne modifie jamais une migration déjà versionnée dans git** — le hook la bloque,
   et c'est voulu : crée-en une nouvelle.

2. Écris le DDL. Pour chaque table métier, sans exception :

```sql
create table <nom> (
  id uuid primary key default uuid_generate_v7(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  -- colonnes métier
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index <nom>_tenant_idx on <nom> (tenant_id, created_at desc);

alter table <nom> enable row level security;
alter table <nom> force row level security;

create policy <nom>_tenant_select on <nom> for select
  using (tenant_id = (select auth_tenant_id()));

create policy <nom>_tenant_write on <nom> for all
  using (tenant_id = (select auth_tenant_id()))
  with check (tenant_id = (select auth_tenant_id()));
```

Une table globale (sans `tenant_id`) doit être justifiée en commentaire dans la
migration et ajoutée à la liste d'exceptions de `.claude/rules/database.md`.

3. Si la migration ajoute de la logique métier, écris-la en fonction PLpgSQL
   transactionnelle, avec verrou de ligne là où la concurrence existe.

4. Écris le test pgTAP correspondant dans `supabase/tests/` :
   le cas nominal, le cas limite, le cas d'erreur, et le cas concurrent si applicable.
   Ajoute la nouvelle table à `supabase/tests/rls_leak_test.sql`.

5. `pnpm db:reset` puis `pnpm test:db`.

6. Lance le sous-agent `rls-auditor`. S'il rend `VERDICT: LEAK`, corrige avant
   de rendre la main.

## Rendu

Le contenu de la migration, le résultat des tests, le verdict de l'auditeur,
et ce que la migration change pour le code applicatif.
