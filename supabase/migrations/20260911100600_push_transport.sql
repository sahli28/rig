-- P1-007 — Le transport : réveiller l'émetteur, et l'unique porte d'enfilage.
--
-- ---------------------------------------------------------------------------
-- pg_net, dans le schéma `net` (comme l'hébergé)
-- ---------------------------------------------------------------------------
--
-- `with schema extensions` : l'extension se pose dans `extensions`, mais pg_net
-- crée **de lui-même** un schéma `net` pour ses tables (`http_request_queue`,
-- `_http_response`) et ses fonctions. Deux conséquences voulues :
--   1. rien n'atterrit dans `public` — `rls_leak_test`, qui n'itère que `public`,
--      ne voit pas ces tables d'infrastructure, et c'est correct ;
--   2. la référence est `net.http_post`, la **même** que sur Supabase hébergé où
--      pg_net vit déjà dans `net`. Le local ne diverge pas de l'hébergé.
--
-- Vérifié à l'exécution plutôt que supposé (façon garde de `20260906200000:54`) :
-- pg_net absent ferait échouer le `net.http_post` du réveil à trois écrans de la
-- cause.
create extension if not exists pg_net with schema extensions;

do $$
begin
  if to_regprocedure('net.http_post(text, jsonb, jsonb, jsonb, integer)') is null then
    raise exception
      'net.http_post est absent : pg_net n''a pas exposé sa fonction dans le schéma net. '
      'Vérifier la version de pg_net (image Supabase locale / extension activée côté hébergé).';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- kick_push_emitter — le coup de sonnette, best-effort
-- ---------------------------------------------------------------------------
--
-- Après qu'un producteur a enfilé, on réveille l'émetteur pour le `< 30 s` sans
-- attendre le prochain balayage. **Best-effort, et jamais bloquant** : l'URL
-- n'est pas configurée en local ni en test (le balayage rattrape), et un
-- émetteur injoignable ne doit surtout pas faire échouer la transaction du
-- producteur — l'annulation a bien eu lieu, la notification est dans la file, le
-- réveil n'est qu'une optimisation de latence.
--
-- L'URL vient d'un réglage d'environnement (`app.settings.push_emitter_url`),
-- pas du code : elle diffère entre local, hébergé et le projet du pilote.
-- `verify_jwt = false` sur la fonction (config.toml) : le réveil n'a pas d'en-tête
-- d'auth à porter, il déclenche seulement un drain qui, lui, s'authentifie en
-- `service_role` côté runtime.
--
-- **Ce chemin HTTP n'est pas couvert par un test automatique** (db -> Kong est la
-- ride locale de D-010) : sa preuve est la passe iPhone, écran sous les yeux. Ce
-- qui *est* testé, c'est l'enfilage (pgTAP) et le rendu/mapping (deno test).
create or replace function public.kick_push_emitter()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := current_setting('app.settings.push_emitter_url', true);
begin
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

comment on function public.kick_push_emitter() is
  'Réveille l''émetteur (net.http_post vers app.settings.push_emitter_url). Best-effort, non bloquant, no-op si l''URL n''est pas configurée. Preuve = passe iPhone, pas test auto.';

-- ---------------------------------------------------------------------------
-- enqueue_push — l'unique porte d'enfilage, et donc l'appelant de l'éligibilité
-- ---------------------------------------------------------------------------
--
-- **Aucun producteur n'insère dans `push_outbox` en direct.** Tout passe par ici,
-- pour la même raison que tout accès de box passe par `tenantScope` : la
-- vérification d'éligibilité cesse d'être une discipline qu'on peut oublier et
-- devient le seul chemin. C'est aussi ce qui donne enfin un appelant à
-- `notification_eligibility` (règle 7) — elle était livrée au lot 1 en attente
-- de celui-ci.
--
-- Rend un booléen : enfilé (`true`) ou écarté par l'éligibilité (`false`). Le
-- producteur peut compter les deux. L'éligibilité est jugée à l'enfilage ; pour
-- le pilote, le drain est quasi-immédiat, donc l'écart enfilage/envoi est
-- négligeable (les quiet hours ne se franchissent pas en quelques secondes).
create or replace function public.enqueue_push(
  p_membership_id uuid,
  p_tenant_id uuid,
  p_category public.notification_category,
  p_context jsonb,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- `p_now` traverse jusqu'à l'éligibilité : le rappel J-1 juge son heure d'envoi
  -- (18 h locales) et ses quiet hours **sur le même instant**. Sans ce fil, la
  -- porte 18 h userait de l'heure passée par le job et les quiet hours de l'heure
  -- réelle — deux horloges, un rappel qui saute au petit matin, et un test dont
  -- le vert dépend de l'heure où la CI tourne.
  if public.notification_eligibility(p_membership_id, p_category, p_now) <> 'OK' then
    return false;
  end if;

  insert into public.push_outbox (tenant_id, membership_id, category, context)
  values (p_tenant_id, p_membership_id, p_category, p_context);

  return true;
end;
$$;

comment on function public.enqueue_push(uuid, uuid, public.notification_category, jsonb, timestamptz) is
  'Unique porte d''enfilage : vérifie notification_eligibility (au même instant p_now que l''appelant) puis insère dans push_outbox. Appelée par les producteurs (security definer). Rend true si enfilé, false si écarté.';

-- ---------------------------------------------------------------------------
-- Droits — internes uniquement
-- ---------------------------------------------------------------------------
--
-- `enqueue_push` et `kick_push_emitter` ne sont appelées que par d'autres
-- fonctions `security definer` (les producteurs) et par `pg_cron`, toutes sous
-- le propriétaire. Aucun rôle applicatif n'y accède.
revoke all on function public.kick_push_emitter() from public, anon, authenticated;
revoke all on function public.enqueue_push(uuid, uuid, public.notification_category, jsonb, timestamptz)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Le balayage — le filet de retry
-- ---------------------------------------------------------------------------
--
-- Toutes les 30 s, on réveille l'émetteur : il reprend les `pending` (échecs
-- transitoires ré-armés par `mark_push_failed`, enfilages dont le coup de
-- sonnette s'est perdu) et les `claimed` périmés d'un émetteur mort. C'est le
-- mécanisme *fiable* ; le coup de sonnette n'est que l'optimisation de latence
-- par-dessus. pg_cron 1.6 accepte la granularité sub-minute.
select cron.schedule(
  'rack-drain-push-outbox',
  '30 seconds',
  $$select public.kick_push_emitter();$$
);
