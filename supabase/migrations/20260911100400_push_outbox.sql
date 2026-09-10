-- P1-007 — La file d'envoi durable (outbox).
--
-- ---------------------------------------------------------------------------
-- Pourquoi une table, et pas un POST direct depuis le producteur
-- ---------------------------------------------------------------------------
--
-- Un producteur (l'annulation d'un cours, le job de rappel J-1) décide qu'une
-- notification **doit** partir, dans sa propre transaction. S'il appelait
-- l'émetteur en direct (`net.http_post` synchrone, ou pire un `fetch` côté app),
-- une notification serait perdue à chaque fois que l'émetteur est momentanément
-- mort — et personne ne le saurait. La file découple les deux : le producteur
-- **enfile** dans sa transaction (donc l'enfilage est atomique avec l'annulation
-- qui le motive), et l'émetteur **draine** à son rythme, avec retry.
--
-- C'est le patron transactional-outbox, choisi contre le webhook Supabase
-- (hébergé-only, invisible au harnais local — D-010) et le POST direct (ne
-- survit pas à un émetteur mort). La contrepartie assumée : une table mutable de
-- plus, et un balayage `pg_cron` en filet de retry (migration des producteurs).
--
-- ---------------------------------------------------------------------------
-- Ce que la file NE contient pas : de la prose
-- ---------------------------------------------------------------------------
--
-- `context` porte des **données**, pas un titre déjà rédigé : `class_id`,
-- `class_name`, l'instant du cours et le fuseau de la box. Le rendu — titre et
-- corps, dans la langue du membre, l'heure formatée à l'heure locale de la box —
-- se fait dans l'émetteur (Deno, `Intl` complet côté serveur), à partir des clés
-- `push.*` de `fr.json`/`en.json`. Une seule source de vérité i18n (règle 8), et
-- la langue résolue **à l'envoi** (elle peut changer entre l'enfilage et le
-- drain), pas figée dans la file.
--
-- ---------------------------------------------------------------------------
-- Table d'infrastructure, pas table de box exposée au client
-- ---------------------------------------------------------------------------
--
-- `tenant_id` **présent** (une notification part d'une box) — donc pas dans
-- `tenant_id_exempt` de `rls_leak_test`. Mais **aucune policy, aucun grant** :
-- seul l'émetteur y touche, en `service_role` (bypass RLS), et les producteurs
-- l'alimentent depuis des fonctions `security definer`. RLS forcée sans policy =
-- invisible et intouchable pour `authenticated`, comme `processed_webhook_events`.
-- D'où son entrée dans `policy_exempt`. Un membre ne lit jamais sa file d'attente
-- d'envoi : son historique, c'est `notification_sends`.
create table public.push_outbox (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  membership_id uuid not null,
  category public.notification_category not null,
  -- Données structurées pour le rendu côté émetteur. Jamais de prose ici.
  context jsonb not null default '{}'::jsonb,
  -- pending -> (claim) -> sent | failed. Un CHECK, pas un enum : les états d'une
  -- file interne changent plus vite qu'un type partagé, et `alter type add value`
  -- est irréversible.
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  -- Posé par claim, relu par le balayage pour ré-armer une ligne qu'un émetteur
  -- mort a laissée « claimed » (voir claim_push_outbox).
  claimed_at timestamptz,
  sent_at timestamptz,
  constraint push_outbox_status_known check (status in ('pending', 'claimed', 'sent', 'failed')),
  -- FK composite (piège 4 de database.md) : une ligne ne référence qu'une
  -- appartenance du **même** tenant. Ferme la substitution membership/tenant
  -- indépendamment de toute policy.
  constraint push_outbox_membership_same_tenant
    foreign key (membership_id, tenant_id)
    references public.memberships (id, tenant_id) on delete cascade
);

-- Le drain lit les `pending` (et les `claimed` périmés) les plus anciens d'abord.
create index push_outbox_drain_idx on public.push_outbox (status, created_at)
  where status in ('pending', 'claimed');

comment on table public.push_outbox is
  'File d''envoi durable des notifications push. Infra : RLS forcée sans policy, écrite/lue en service_role. Les producteurs enfilent en security definer, l''émetteur draine. context = données structurées, le rendu i18n se fait dans l''émetteur.';

alter table public.push_outbox enable row level security;
alter table public.push_outbox force row level security;
