-- P1-007 — Les RPC d'état de l'émetteur, en SQL (donc prouvables en pgTAP).
--
-- L'émetteur (edge function) ne décide de rien et n'écrit rien en propre : il
-- appelle ces fonctions. Mettre l'état en SQL plutôt que dans le Deno donne
-- trois choses : la logique se teste sous `postgres` sans HTTP, l'écriture de
-- `notification_sends` reste dans une transaction, et un émetteur mort ne laisse
-- pas la file dans un état qu'aucun test n'a vu.
--
-- Toutes en `service_role` sauf `register_device` (appelée par le mobile,
-- `authenticated`). `service_role` a `rolbypassrls` ; le `security definer` +
-- `revoke`/`grant` explicite reste la même discipline que partout (précédent
-- `app_error`, `20260831230000:25`), et rend l'intention lisible.

-- ---------------------------------------------------------------------------
-- claim_push_outbox — verrouille un lot, résout jetons et langue
-- ---------------------------------------------------------------------------
--
-- `for update skip locked` : deux émetteurs concurrents ne se marchent pas
-- dessus, chacun prend des lignes différentes. On reprend aussi les `claimed`
-- **périmés** (> 5 min) — un émetteur mort après le claim et avant le mark
-- aurait sinon bloqué ses lignes pour toujours. `attempts` compte les prises,
-- pas les échecs : c'est ce plafond qui, dans `mark_push_failed`, décide de
-- renoncer.
--
-- La langue est résolue **ici**, au drain, pas figée à l'enfilage : elle peut
-- changer entre les deux. Les jetons de l'appareil aussi (`devices` suit la
-- personne, pas la box — d'où le `user_id` du membre, tous appareils confondus).
create or replace function public.claim_push_outbox(p_limit integer default 50)
returns table (
  id uuid,
  tenant_id uuid,
  membership_id uuid,
  category public.notification_category,
  context jsonb,
  locale text,
  push_tokens text[]
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with claimed as (
    update public.push_outbox o
    set status = 'claimed', attempts = o.attempts + 1, claimed_at = now()
    where o.id in (
      select o2.id
      from public.push_outbox o2
      where o2.status = 'pending'
         or (o2.status = 'claimed' and o2.claimed_at < now() - interval '5 minutes')
      order by o2.created_at
      limit p_limit
      for update skip locked
    )
    returning o.id, o.tenant_id, o.membership_id, o.category, o.context
  )
  select
    c.id,
    c.tenant_id,
    c.membership_id,
    c.category,
    c.context,
    coalesce(u.locale, t.default_locale) as locale,
    coalesce(
      (select array_agg(d.push_token) from public.devices d where d.user_id = m.user_id),
      '{}'::text[]
    ) as push_tokens
  from claimed c
  join public.memberships m on m.id = c.membership_id
  join public.users u on u.id = m.user_id
  join public.tenants t on t.id = c.tenant_id;
end;
$$;

comment on function public.claim_push_outbox(integer) is
  'Verrouille un lot de la file (pending + claimed périmés), l''incrémente et le rend avec jetons d''appareil et langue résolus à l''instant du drain. service_role.';

-- ---------------------------------------------------------------------------
-- mark_push_sent — l'envoi réussi devient une ligne de journal
-- ---------------------------------------------------------------------------
--
-- `where status = 'claimed'` : idempotent, et n'écrit `notification_sends`
-- **qu'une fois** — un second appel sur les mêmes ids ne trouve plus de ligne
-- `claimed` et n'insère rien. C'est ce qui protège le plafond marketing d'un
-- double comptage sur un retry mal placé.
create or replace function public.mark_push_sent(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with sent as (
    update public.push_outbox o
    set status = 'sent', sent_at = now()
    where o.id = any(p_ids) and o.status = 'claimed'
    returning o.tenant_id, o.membership_id, o.category
  ),
  logged as (
    insert into public.notification_sends (tenant_id, membership_id, category, channel, sent_at)
    select s.tenant_id, s.membership_id, s.category, 'push', now()
    from sent s
    returning 1
  )
  select count(*) into v_count from logged;
  return v_count;
end;
$$;

comment on function public.mark_push_sent(uuid[]) is
  'Passe les lignes claimed à sent et écrit notification_sends (une par envoi). Idempotent par le garde status = claimed. service_role.';

-- ---------------------------------------------------------------------------
-- mark_push_failed — réessayer, puis renoncer
-- ---------------------------------------------------------------------------
--
-- Un échec transitoire (exp.host injoignable) doit repartir : la ligne revient
-- `pending` et le balayage la reprendra. Au-delà de 5 prises, elle passe
-- `failed` pour de bon — sinon une notification indéfiniment refusée tournerait
-- en boucle. Le plafond `attempts` a été incrémenté au claim, on le lit ici.
create or replace function public.mark_push_failed(p_ids uuid[], p_error text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with updated as (
    update public.push_outbox o
    set status = case when o.attempts >= 5 then 'failed' else 'pending' end,
        last_error = p_error
    where o.id = any(p_ids) and o.status = 'claimed'
    returning 1
  )
  select count(*) into v_count from updated;
  return v_count;
end;
$$;

comment on function public.mark_push_failed(uuid[], text) is
  'Rearme les lignes claimed en pending (retry par balayage), ou les fige à failed après 5 prises. service_role.';

-- ---------------------------------------------------------------------------
-- register_device — l'upsert nu casse sur téléphone partagé
-- ---------------------------------------------------------------------------
--
-- Un `upsert` client direct sur `devices` échoue en `23505` sur un téléphone
-- partagé : le jeton existe déjà, mais sous le `user_id` de l'occupant
-- précédent, que la RLS masque à l'appelant — le `on conflict` ne voit pas la
-- ligne à mettre à jour et l'insert bute sur l'index unique. D'où cette fonction
-- `security definer` : sur conflit de jeton, elle **réassigne** `user_id` à
-- l'appelant. Le jeton appartient à l'appareil physique ; le réassigner à la
-- session courante est exactement le comportement voulu.
create or replace function public.register_device(
  p_push_token text,
  p_platform text,
  p_app_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user_id is null then
    perform public.app_error('AUTH_REQUIRED', 'Authentification requise.', '42501');
  end if;

  insert into public.devices (user_id, push_token, platform, app_version, last_seen_at)
  values (v_user_id, p_push_token, p_platform, p_app_version, now())
  on conflict (push_token) do update
    set user_id = v_user_id,
        platform = excluded.platform,
        app_version = excluded.app_version,
        last_seen_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.register_device(text, text, text) is
  'Enregistre le jeton push de l''appelant. Sur conflit de jeton (téléphone partagé), réassigne user_id à l''appelant. security definer, authenticated.';

-- ---------------------------------------------------------------------------
-- revoke_device — supprimé au premier échec
-- ---------------------------------------------------------------------------
--
-- Expo répond `DeviceNotRegistered` quand un jeton est mort (app désinstallée,
-- permission retirée). L'émetteur le supprime **au premier échec** : le garder
-- ferait retenter un envoi voué à échouer, et gonflerait `attempts` pour rien.
--
-- `service_role` seul : c'est l'émetteur qui révoque, sur n'importe quel jeton
-- mort. La révocation « je me déconnecte » côté mobile passe, elle, par un
-- `delete` direct borné par la policy `devices_self_write` — pas par cette
-- fonction, pour ne pas donner à `authenticated` un « supprime n'importe quel
-- jeton par sa valeur ».
create or replace function public.revoke_device(p_push_token text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.devices where push_token = p_push_token;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.revoke_device(text) is
  'Supprime un jeton d''appareil mort. Appelée par l''émetteur sur DeviceNotRegistered. service_role.';

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------
--
-- L'émetteur agit en `service_role` : claim/mark/revoke lui sont réservés.
-- `register_device` est le seul chemin client (le mobile, `authenticated`).
revoke all on function public.claim_push_outbox(integer) from public, anon, authenticated;
revoke all on function public.mark_push_sent(uuid[]) from public, anon, authenticated;
revoke all on function public.mark_push_failed(uuid[], text) from public, anon, authenticated;
revoke all on function public.revoke_device(text) from public, anon, authenticated;
grant execute on function public.claim_push_outbox(integer) to service_role;
grant execute on function public.mark_push_sent(uuid[]) to service_role;
grant execute on function public.mark_push_failed(uuid[], text) to service_role;
grant execute on function public.revoke_device(text) to service_role;

revoke all on function public.register_device(text, text, text) from public, anon;
grant execute on function public.register_device(text, text, text) to authenticated;
