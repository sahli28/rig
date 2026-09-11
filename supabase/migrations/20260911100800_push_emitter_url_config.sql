-- P1-007 / P1-017 — L'URL de l'émetteur vient d'une table, plus d'un GUC.
--
-- Pourquoi cette migration existe, et pourquoi elle est *ajoutée* et non éditée
-- en place. Le transport de P1-007 (`20260911100600`) faisait lire l'URL de
-- l'émetteur à `kick_push_emitter` depuis un GUC,
-- `current_setting('app.settings.push_emitter_url')`. **Vérifié sur le projet
-- hébergé le 11 septembre 2026**, pas supposé : le rôle `postgres` n'y est pas
-- superutilisateur (`is_superuser = off`) et `supautils` lui **refuse** tout
-- `ALTER DATABASE|ROLE ... SET` de paramètre personnalisé — le préfixe réservé
-- `app.settings.*` **comme** un préfixe libre `rack.*` : « permission denied to
-- set parameter ». Seul un `SET` de session passe, et il ne survit pas à la
-- connexion ; `pg_cron`, qui ouvre ses propres connexions, ne le verrait jamais.
-- Le GUC ne peut donc **jamais** être posé sur l'hébergé sans le superutilisateur
-- qu'on n'a pas — la ligne resterait `pending` pour toujours, le piège « conclu
-- cassé » que `P1-017` décrit.
--
-- La réponse est une table de configuration, **pas Vault** : l'URL de l'émetteur
-- n'est pas un secret (la fonction répond 200 **sans** apikey, `verify_jwt=false`),
-- Vault serait une première dépendance propriétaire non substituable (ADR 0001,
-- réversibilité) pour une valeur publique, et une table se comporte
-- **identiquement** en local et sur l'hébergé — précisément l'écart qu'on refuse
-- de recréer. Vault sera le bon outil quand un vrai secret devra y vivre — un
-- en-tête partagé `pg_net` <-> fonction, `D-025`.
--
-- Règle 13 : le jour où une base de production existe, on n'édite plus une
-- migration versionnée, on en ajoute une. `P1-017` a créé cette base ; ceci est
-- la première migration *ajoutée* sous la règle inversée. `20260911100600` reste
-- tel qu'appliqué — `kick_push_emitter` y est seulement redéfini.

-- ---------------------------------------------------------------------------
-- app_runtime_config — configuration au niveau du DÉPLOIEMENT, pas de la box
-- ---------------------------------------------------------------------------
--
-- Tenant-agnostique, et c'est un choix, pas un oubli : l'URL de l'émetteur est
-- une propriété du projet Supabase (une par déploiement), identique pour toutes
-- les boxes. Un `tenant_id` n'aurait aucun sens — aucune box ne « possède » l'URL
-- de la fonction. Même catégorie que `processed_webhook_events` : table
-- d'infrastructure, exemptée de `tenant_id` et de policy dans `rls_leak_test`.
--
-- RLS activée **et forcée**, **aucune policy**, **aucun droit** à `anon` /
-- `authenticated` : invisible et intouchable au client, exactement comme
-- `processed_webhook_events`. Seule une fonction `security definer` — propriété
-- de `postgres`, qui a `rolbypassrls` — la lit (`kick_push_emitter`). Un client
-- (`authenticated`, sans `bypassrls`, sans grant, sans policy) n'y accède pas.
-- La FORCE ne masque pas le lecteur légitime parce qu'il contourne la RLS ; elle
-- ferme la porte à tout le reste.
create table public.app_runtime_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

comment on table public.app_runtime_config is
  'Configuration au niveau du déploiement (pas de la box) : paires clé/valeur NON secrètes, lues par des fonctions security definer. Ex. push_emitter_url. RLS forcée sans policy ni grant : invisible au client, lue seulement par le propriétaire (bypassrls). Un secret irait dans Vault, pas ici (voir D-025).';

alter table public.app_runtime_config enable row level security;
alter table public.app_runtime_config force row level security;
-- Aucune policy, comme processed_webhook_events. Aucun droit client, explicite
-- (les droits par défaut du schéma ont déjà été retirés à anon/authenticated en
-- D-006 ; ce revoke le rend visible dans la migration plutôt que déduit).
revoke all on table public.app_runtime_config from anon, authenticated;

-- ---------------------------------------------------------------------------
-- kick_push_emitter — lit l'URL dans la table, plus dans un GUC
-- ---------------------------------------------------------------------------
-- Tout le reste est inchangé : best-effort, jamais bloquant, no-op **silencieux**
-- quand l'URL est absente (aucune erreur), exception avalée. `create or replace`
-- préserve les révocations posées en `20260911100600` ; on les ré-affirme
-- ci-dessous par prudence (règle des sœurs : la migration dit ses droits).
create or replace function public.kick_push_emitter()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
begin
  select value into v_url
  from public.app_runtime_config
  where key = 'push_emitter_url';

  if v_url is null or length(v_url) = 0 then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    params := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
exception
  when others then
    -- Le réveil ne casse jamais son appelant. Le balayage est le filet.
    return;
end;
$$;

revoke all on function public.kick_push_emitter() from public, anon, authenticated;

comment on function public.kick_push_emitter() is
  'Réveille l''émetteur (net.http_post vers app_runtime_config[push_emitter_url]). Best-effort, non bloquant, no-op silencieux si l''URL est absente. L''URL vient d''une table, pas d''un GUC : l''hébergé refuse ALTER DATABASE/ROLE SET à postgres. Preuve = passe iPhone + net._http_response, pas test auto.';
