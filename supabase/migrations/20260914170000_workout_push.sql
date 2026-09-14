-- ---------------------------------------------------------------------------
-- P1-029 — la séance publiée prévient ceux qui ont réservé
-- ---------------------------------------------------------------------------
--
-- Câble un canal, n'en refait pas un : toute la chaîne aval existe (P1-007) —
-- `enqueue_push()` porte l'éligibilité (consentement PUSH, préférence de
-- catégorie, quiet hours), `push_outbox` la file, `kick_push_emitter()` le
-- réveil, l'émetteur le rendu FR/EN et le lien profond `rack:///class/[id]`.
--
-- La valeur d'enum et son producteur arrivent DANS LA MÊME migration : une
-- valeur d'enum sans code derrière ne vaut rien (CLAUDE.md). PostgreSQL 17
-- accepte `alter type … add value` en transaction tant que la valeur n'est pas
-- **évaluée** dans la même transaction — le corps de la fonction ne l'évalue
-- qu'à l'exécution, jamais à la définition.
--
-- Par les fonctions génériques de 20260911100100, la nouvelle catégorie est
-- automatiquement : transactionnelle (hors plafond marketing) et **soumise aux
-- quiet hours** (seules CLASS_CANCELLATION et WAITLIST_PROMOTION les percent).
--
-- **Correction d'une hypothèse du ticket, mesurée avant d'écrire (règle 6)** :
-- les quiet hours ÉCARTENT, elles ne diffèrent pas — `notification_eligibility`
-- rend `QUIET_HOURS` et `enqueue_push()` n'enfile rien ; il n'existe aucun
-- mécanisme de report (pas de `send_after` dans l'outbox). Une séance publiée
-- à 22 h ne « part donc pas au matin » : elle ne notifie personne, comme toute
-- catégorie non exemptée, et le membre la voit dans l'app. Le report est un
-- lot possible (colonne + claim + émetteur) si l'usage le réclame — pas ici.

alter type public.notification_category add value if not exists 'WORKOUT_UPDATED';

-- ---------------------------------------------------------------------------
-- notify_workout_published_at — l'enfileur interne (jamais atteint d'un client)
-- ---------------------------------------------------------------------------
--
-- **Deux fonctions, et la coupure est une trouvaille d'audit (rls-auditor,
-- 14 sept. 2026)** : le premier jet exposait `p_now` sur la fonction grantée à
-- `authenticated` — or `p_now` est l'instant de référence des quiet hours. Un
-- staff appelant le RPC à 23 h avec un `p_now` de midi aurait poussé en pleine
-- nuit : la sœur exacte du piège 7 de `database.md` (« un contrôle ne s'appuie
-- jamais sur une valeur que le client écrit »), appliquée à l'horloge et non à
-- une colonne. D'où la coupure, sur le motif des producteurs de P1-007 :
-- l'interne paramétrable en `p_now` (tests, futurs appelants serveur) est
-- révoquée de tous les rôles applicatifs ; la porte publique fixe `now()`
-- elle-même, et l'appelant ne peut pas mentir sur l'heure.
--
-- L'enfileur est volontairement bête : il enfile pour chaque réservation
-- CONFIRMED du cours, à chaque appel. Le « pas deux fois pour rien » vit dans
-- l'action (`saveWorkout` ne l'appelle que si le texte a changé) — l'enfileur
-- ne peut pas savoir si une séance a changé, l'action le sait.
create or replace function public.notify_workout_published_at(
  p_class_id uuid,
  p_now timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enqueued integer := 0;
  r record;
begin
  for r in
    select
      b.membership_id,
      c.tenant_id,
      c.id as class_id,
      ct.name_i18n as class_name_i18n,
      c.starts_at,
      t.timezone as box_tz
    from public.classes c
    join public.tenants t on t.id = c.tenant_id
    join public.class_types ct on ct.id = c.class_type_id
    join public.bookings b on b.class_id = c.id and b.status = 'CONFIRMED'
    where c.id = p_class_id
      and c.deleted_at is null
      and c.status <> 'CANCELLED'
  loop
    if public.enqueue_push(
      r.membership_id,
      r.tenant_id,
      'WORKOUT_UPDATED',
      jsonb_build_object(
        'class_id', r.class_id,
        'class_name_i18n', r.class_name_i18n,
        'starts_at', r.starts_at,
        'timezone', r.box_tz
      ),
      p_now
    ) then
      v_enqueued := v_enqueued + 1;
    end if;
  end loop;

  if v_enqueued > 0 then
    perform public.kick_push_emitter();
  end if;

  return v_enqueued;
end;
$$;

comment on function public.notify_workout_published_at(uuid, timestamptz) is
  'P1-029, interne : enfile un WORKOUT_UPDATED par réservation CONFIRMED du cours, à l''instant p_now. Révoquée des rôles applicatifs — p_now est la référence des quiet hours et ne vient jamais d''un client. Porte publique : notify_workout_published(uuid).';

revoke all on function public.notify_workout_published_at(uuid, timestamptz)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- notify_workout_published — la porte publique, gardée, sans horloge cliente
-- ---------------------------------------------------------------------------

create or replace function public.notify_workout_published(p_class_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- La garde : le cours existe et l'appelant est staff de sa box. Un id d'une
  -- autre box rend le même refus qu'un id inconnu — ne pas révéler l'existence
  -- d'une ressource d'un autre tenant (api.md).
  if not exists (
    select 1 from public.classes c
    where c.id = p_class_id
      and c.deleted_at is null
      and c.tenant_id in (select public.current_staff_tenant_ids())
  ) then
    perform public.app_error('FORBIDDEN_ROLE', 'Réservé au staff de la box.', '42501');
  end if;

  -- `now()` posé ICI, jamais reçu : l'instant des quiet hours n'est pas
  -- négociable par l'appelant.
  return public.notify_workout_published_at(p_class_id, now());
end;
$$;

comment on function public.notify_workout_published(uuid) is
  'P1-029 : porte publique du push de séance — gardée staff-du-tenant, fixe now() elle-même (les quiet hours ne se contournent pas par un p_now client). Appelée par saveWorkout, qui ne l''appelle que si le texte a changé.';

revoke all on function public.notify_workout_published(uuid) from public, anon;
grant execute on function public.notify_workout_published(uuid) to authenticated;
