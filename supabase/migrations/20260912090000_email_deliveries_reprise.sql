-- P1-018 (reprise) — Reprendre les réservations mortes, et ne pas re-poster une
-- adresse morte à chaque clic.
--
-- 20260911101500, qui a posé la table et ces deux fonctions, est **déjà fusionnée**
-- (PR #84) : déjà versionnée, donc immuable — le hook `guard-migrations.mjs` la
-- bloque, et règle 13 impose alors d'**ajouter** une migration qui la
-- `create or replace`, jamais d'éditer l'originale. (`UNE_BASE_DE_PRODUCTION_EXISTE`
-- reste `false` : ce n'est pas la prod qui l'immobilise, c'est le fait qu'elle soit
-- déjà partie sur `main`.) Même gabarit que 20260911101200.
--
-- Deux défauts du motif claim/mark, invisibles sur une PR verte, corrigés ensemble :
--
-- 1. RÉSERVATION MORTE. `claim` marque `sending`, puis l'action envoie. Un processus
--    tué entre les deux (timeout Vercel, déploiement en plein lot) laisse une ligne
--    `sending` que l'exclusion d'origine comptait comme un envoi : l'invitation était
--    bloquée pendant `p_within` (24 h), en silence, et personne ne recevait rien.
--    Reprise : au début du `claim`, toute `sending` plus vieille qu'un **bail de
--    15 min** est marquée `failed` (donc visible) — elle cesse de bloquer, et
--    l'invitation est réessayée.
--
-- 2. ADRESSE MORTE RE-POSTÉE. Pour que la reprise libère, `failed` ne doit plus
--    bloquer. Mais alors une adresse invalide du fichier de la box serait re-postée
--    à Brevo **à chaque clic** de l'opérateur (quota brûlé, liste « à corriger » qui
--    se recompose à l'identique). D'où un état terminal distinct : `failed_permanent`
--    (rejet 4xx hors 429, classé par l'action selon le code HTTP) bloque
--    indéfiniment ; `failed` (429 / 5xx / réseau, ou reprise) reste réservable. La
--    **même information** que l'écran affiche (point 4), servie aussi au `claim`.
--
-- Réémission **entière** des deux fonctions — même signature, même
-- `security definer` / `search_path = ''` — les seuls changements sont la reprise +
-- le prédicat d'exclusion (`claim`) et le statut cible admis (`mark`). Les `grant`
-- survivent au `create or replace`. Réversible : re-narrower le CHECK et réémettre
-- les corps d'origine.

alter table public.email_deliveries
  drop constraint email_deliveries_status_known;
alter table public.email_deliveries
  add constraint email_deliveries_status_known
  check (status in ('sending', 'sent', 'failed', 'failed_permanent'));

-- ---------------------------------------------------------------------------
-- claim_invitations_to_email — reprise des réservations mortes + exclusion revue
-- ---------------------------------------------------------------------------
create or replace function public.claim_invitations_to_email(
  p_tenant_id uuid,
  p_limit integer default 40,
  p_within interval default interval '24 hours'
)
returns table (
  delivery_id uuid,
  invitation_id uuid,
  email text,
  first_name text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_tenant_id not in (select public.current_admin_tenant_ids()) then
    perform public.app_error('FORBIDDEN_ROLE',
      'Réservé aux propriétaires et gestionnaires.', '42501');
  end if;

  -- Reprise : une réservation `sending` plus vieille que le bail (processus mort
  -- entre claim et mark) passe `failed` — visible, et surtout elle cesse de bloquer.
  -- Le bail est un littéral : le rendre paramétrable changerait la signature (ce
  -- serait une surcharge, pas un remplacement) et l'appelant n'a aucune raison de
  -- le régler.
  update public.email_deliveries
  set status = 'failed',
      last_error = 'réservation expirée (reprise) : envoi jamais confirmé'
  where tenant_id = p_tenant_id
    and status = 'sending'
    and created_at < now() - interval '15 minutes';

  return query
  with candidates as (
    select i.id, i.email::text as email, i.first_name
    from public.invitations i
    where i.tenant_id = p_tenant_id
      and i.status = 'PENDING'
      and i.email is not null
      and i.expires_at > now()
      and not exists (
        select 1 from public.email_deliveries d
        where d.invitation_id = i.id
          and (
            -- déjà atteint récemment (anti-renvoi après succès)
            (d.status = 'sent' and d.created_at > now() - p_within)
            -- réservation vive (la reprise ci-dessus a déjà libéré les mortes)
            or d.status = 'sending'
            -- adresse morte : ne jamais la re-poster tant qu'elle n'a pas changé
            or d.status = 'failed_permanent'
          )
      )
    order by i.created_at
    limit p_limit
    for update skip locked
  ),
  reserved as (
    insert into public.email_deliveries (tenant_id, invitation_id, email, status)
    select p_tenant_id, c.id, c.email, 'sending'
    from candidates c
    returning email_deliveries.id, email_deliveries.invitation_id, email_deliveries.email
  )
  select r.id, r.invitation_id, r.email, c.first_name
  from reserved r
  join candidates c on c.id = r.invitation_id;
end;
$$;

comment on function public.claim_invitations_to_email(uuid, integer, interval) is
  'Reprend les réservations mortes (sending > 15 min -> failed), puis réserve un lot d''invitations PENDING nominatives et vives sans succès récent (sent < p_within), sans réservation vive, et sans échec permanent (failed_permanent). Insère une ligne sending par retenue. security definer, autorise OWNER/MANAGER.';

-- ---------------------------------------------------------------------------
-- mark_email_delivery — admet le statut terminal failed_permanent
-- ---------------------------------------------------------------------------
create or replace function public.mark_email_delivery(
  p_delivery_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- `failed_permanent` (adresse invalide, 4xx hors 429) ne sera plus réservée ;
  -- `failed` (429 / 5xx / réseau) reste réessayable. C'est `claim` qui exploite
  -- l'écart. Signature inchangée : le statut porte la distinction.
  if p_status not in ('sent', 'failed', 'failed_permanent') then
    raise exception 'mark_email_delivery: statut cible invalide %', p_status
      using errcode = '22023';
  end if;

  update public.email_deliveries d
  set status = p_status,
      provider_message_id = p_provider_message_id,
      last_error = p_error,
      sent_at = case when p_status = 'sent' then now() else null end
  where d.id = p_delivery_id
    and d.status = 'sending'
    and d.tenant_id in (select public.current_admin_tenant_ids());
end;
$$;

comment on function public.mark_email_delivery(uuid, text, text, text) is
  'Passe une ligne email_deliveries sending à sent | failed | failed_permanent. Idempotent par le garde status = sending. security definer, autorise OWNER/MANAGER dans le where.';
