-- P1-008a — Le coach coche sa feuille, et l'absent est marqué.
--
-- Le ticket est venu de la box pilote. Le coach connaît ses membres et tient sa
-- liste à la main : RM3.6, le pointage manuel, **est** le produit ; le QR est
-- l'extra (P1-008b, non programmé). Il veut quand même sanctionner les absents,
-- donc le no-show reste — il lui faut un endroit où l'enregistrer, pas un
-- lecteur de code-barres.
--
-- ---------------------------------------------------------------------------
-- 1. La présence va sur `bookings`, en deux colonnes stockées
-- ---------------------------------------------------------------------------
--
-- Pointer, c'est dire « cette réservation a été honorée » : la donnée a la forme
-- de la ligne qui existe déjà. Pas de table `checkins` — elle n'aurait de sens
-- que le jour où un pointage existe **sans** réservation (le drop-in) ou porte
-- l'appareil et la source ; ces deux besoins sont dans P1-008b, qui reprendra
-- ce qui est ici (règle 7 : un mécanisme avant son appelant, non).
--
-- **Deux colonnes, pas une**, sur le précédent `cancelled_within_window` (un
-- fait stocké, jamais dérivé) :
--   * `attended_at` — la présence, posée et retirée par le coach ;
--   * `no_show_at`  — l'absence, posée par le job après le cours.
-- Un no-show n'est pas l'absence de présence : c'est un fait daté, que S5
-- (frais) et P2-014 (assiduité) reliront. Le dériver le recalculerait à chaque
-- lecture avec la règle du jour ; le stocker le fige au moment où il devient
-- vrai.
--
-- Aucun `grant` d'écriture sur `bookings` (elle n'a que `select` depuis P1-003) :
-- ces deux colonnes sont donc write-protected par construction, comme `status`
-- et `cancelled_at`. Elles ne s'écrivent que par les fonctions ci-dessous.
alter table public.bookings add column attended_at timestamptz;
alter table public.bookings add column no_show_at timestamptz;

comment on column public.bookings.attended_at is
  'Présence, posée/retirée par le staff via set_attendance(). NULL = pas (encore) pointé.';
comment on column public.bookings.no_show_at is
  'Absence, posée par mark_no_shows() après le cours. Un fait daté, jamais dérivé — comme cancelled_within_window.';

-- ---------------------------------------------------------------------------
-- 2. La fenêtre de pointage — deux colonnes de réglage, jugées en instants
-- ---------------------------------------------------------------------------
--
-- 30 min avant / 15 min après le début par défaut. Éditables par le gérant
-- (deux champs dans le formulaire de règles de réservation). Mêmes type et
-- forme que les fenêtres voisines de `tenant_settings`. La contrainte est
-- **séparée** : `tenant_settings_windows_positive` est figée dans une migration
-- versionnée, on ne la réécrit pas.
alter table public.tenant_settings
  add column checkin_window_before_minutes integer not null default 30,
  add column checkin_window_after_minutes integer not null default 15;

alter table public.tenant_settings
  add constraint tenant_settings_checkin_window_positive check (
    checkin_window_before_minutes >= 0
    and checkin_window_after_minutes >= 0
  );

comment on column public.tenant_settings.checkin_window_before_minutes is
  'Minutes avant le début du cours où le pointage ouvre (défaut 30).';
comment on column public.tenant_settings.checkin_window_after_minutes is
  'Minutes après le début du cours où le pointage ferme (défaut 15).';

-- ---------------------------------------------------------------------------
-- 3. La feuille du coach — une vue coach, parce que `class_roster` est « pair »
-- ---------------------------------------------------------------------------
--
-- **`class_roster` ne sert pas cette feuille.** C'est la vue des pairs : son
-- `exists (… l'appelant est inscrit à ce cours …)` la rend vide pour un coach
-- qui anime le cours sans l'avoir réservé. Et `bookings_coach_select` donne au
-- coach les lignes brutes, **sans nom** — `users` est en `id = auth.uid()`.
-- Il faut donc une vue à part. C'est la 4e audience de `.claude/rules/privacy.md`,
-- « Présence — un coach sur son propre cours », qui y était « à trancher » : elle
-- l'est ici.
--
-- **Portée : tout le staff de la box** (`current_staff_tenant_ids()` =
-- OWNER/MANAGER/COACH), comme la séance de P1-015. Un cas de moins qu'« le coach
-- de ce cours seulement », et le gérant peut pointer à la place d'un coach
-- absent (RM3.6, « fallback universel »).
--
-- **Identité : prénom + initiale**, exactement la règle des pairs et de P1-010 —
-- une seule règle d'identité dans tout le produit, aucun e-mail/téléphone/
-- naissance/sexe.
--
-- **Et la vue IGNORE `hidden_from_roster`**, à la différence de `class_roster`.
-- L'opposition d'un membre le masque à ses **pairs** ; elle ne peut pas le
-- soustraire au coach qui doit cocher sa présence — c'est un traitement légitime
-- de la box (exécution du contrat), pas une exposition entre pairs. Écrit ici
-- parce que c'est précisément la distinction que `class_roster` applique et que
-- celle-ci doit ne pas appliquer.
--
-- `security_invoker = false`, comme ses trois sœurs : en `true`, la policy
-- `id = auth.uid()` de `users` ne rendrait que l'appelant. Le `WHERE` dérivé
-- d'`auth.uid()` est la seule chose entre le staff et `users` — aucun paramètre
-- du client n'y entre.
create view public.class_attendance_sheet
with (security_invoker = false)
as
select
  -- `tenant_id` d'abord : le test anti-fuite interroge chaque vue avec
  -- `where tenant_id is not null` sous une session étrangère, et `tenantScope()`
  -- l'exige pour filtrer sur la box active.
  b.tenant_id,
  b.class_id,
  -- `booking_id` : c'est la ligne que `set_attendance()` marque. Id technique
  -- déjà lisible du staff via `bookings_staff_select`/`bookings_coach_select`
  -- (privacy.md règle 2), il rend la feuille actionnable sans rien exposer.
  b.id as booking_id,
  m.id as membership_id,
  u.first_name,
  nullif(left(coalesce(u.last_name, ''), 1), '') as last_initial,
  b.attended_at,
  b.no_show_at
from public.bookings b
join public.memberships m on m.id = b.membership_id
join public.users u on u.id = m.user_id
where b.status = 'CONFIRMED'
  and m.status = 'ACTIVE'
  and m.left_at is null
  and u.deleted_at is null
  and b.tenant_id in (select public.current_staff_tenant_ids());

comment on view public.class_attendance_sheet is
  'Feuille de présence d''un cours, vue par le staff de la box : prénom + initiale, présence et no-show. Ignore hidden_from_roster (traitement légitime de la box, pas exposition entre pairs). Règle d''exposition : .claude/rules/privacy.md, 4e audience.';

grant select on public.class_attendance_sheet to authenticated;

-- ---------------------------------------------------------------------------
-- 4. set_attendance — pointer ou dépointer, dans la fenêtre
-- ---------------------------------------------------------------------------
--
-- Gabarit `cancel_booking()` : transitionne une ligne existante, `security
-- definer`, garde avant toute divulgation, jugement en instants. Pas de verrou
-- de `classes` — le pointage ne touche pas `booked_count` — et l'écriture est un
-- compare-and-swap sur `attended_at`, idempotent : recocher ne fait rien de plus.
create or replace function public.set_attendance(
  p_booking_id uuid,
  p_present boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking record;
  v_class record;
  v_before integer;
  v_after integer;
begin
  -- 1. La réservation, **dans une box dont l'appelant est staff**. Un membre,
  --    ou un staff d'une autre box, n'obtient rien — et « inconnue » et
  --    « pas la vôtre » rendent la même réponse (pas d'oracle d'existence).
  select b.id, b.class_id, b.tenant_id, b.status
  into v_booking
  from public.bookings b
  where b.id = p_booking_id
    and b.tenant_id in (select public.current_staff_tenant_ids());

  if v_booking.id is null then
    perform public.app_error(
      'FORBIDDEN_ROLE',
      'Cette réservation n''existe pas, ou n''est pas dans une box que vous animez.',
      '42501'
    );
  end if;

  -- 2. La fenêtre de pointage, en instants — comme cancel_booking, et pour la
  --    même raison : une durée entre deux instants ne dépend d'aucun fuseau,
  --    `starts_at` porte déjà l'heure locale convertie. Hors fenêtre, la base
  --    refuse (pas seulement l'écran).
  select c.starts_at into v_class
  from public.classes c
  where c.id = v_booking.class_id;

  select ts.checkin_window_before_minutes, ts.checkin_window_after_minutes
  into strict v_before, v_after
  from public.tenant_settings ts
  where ts.tenant_id = v_booking.tenant_id;

  if now() < v_class.starts_at - make_interval(mins => v_before)
     or now() > v_class.starts_at + make_interval(mins => v_after) then
    perform public.app_error(
      'ATTENDANCE_WINDOW_CLOSED',
      'Le pointage n''est ouvert que juste avant et juste après le début du cours.',
      '23514'
    );
  end if;

  -- 3. Compare-and-swap : seule une réservation CONFIRMED se pointe. Une annulée
  --    a disparu de la feuille ; la viser ne touche aucune ligne, sans erreur.
  update public.bookings
  set attended_at = case when p_present then now() else null end
  where id = v_booking.id
    and status = 'CONFIRMED';

  return v_booking.id;
end;
$$;

comment on function public.set_attendance(uuid, boolean) is
  'Pose (p_present) ou retire (not p_present) la présence d''une réservation. Staff de la box uniquement, dans la fenêtre de pointage. Idempotent.';

-- ---------------------------------------------------------------------------
-- 5. mark_no_shows — le job de fond, gabarit maintain_class_occurrences
-- ---------------------------------------------------------------------------
--
-- Après le cours, une réservation confirmée jamais pointée devient un no-show.
-- Idempotent (`no_show_at is null`), révoqué de tous les rôles applicatifs :
-- seul `pg_cron` l'appelle, et les tests l'appellent directement.
create or replace function public.mark_no_shows()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with marked as (
    update public.bookings b
    set no_show_at = now()
    from public.classes c
    where b.class_id = c.id
      and b.status = 'CONFIRMED'
      and b.attended_at is null
      and b.no_show_at is null
      and c.deleted_at is null
      and c.status <> 'CANCELLED'
      -- Le cours est **terminé** : `ends_at`, pas `starts_at`. Un cours en
      -- train de se dérouler n'a pas d'absents, il a des retardataires.
      and c.ends_at < now()
    returning b.id
  )
  select count(*) into v_count from marked;
  return v_count;
end;
$$;

comment on function public.mark_no_shows() is
  'Marque no_show_at sur les réservations confirmées non pointées des cours terminés. Idempotent. Appelée par pg_cron (rack-mark-no-shows), et directement par les tests.';

-- ---------------------------------------------------------------------------
-- 6. Droits
-- ---------------------------------------------------------------------------
--
-- `set_attendance` est ouverte à `authenticated` — sa garde interne est le
-- staff de la box. `mark_no_shows` ne l'est à personne : c'est un job.
revoke all on function public.set_attendance(uuid, boolean) from public, anon;
grant execute on function public.set_attendance(uuid, boolean) to authenticated;
revoke all on function public.mark_no_shows() from public, anon, authenticated;

-- Le second job de fond du produit, après les occurrences (00:05). À 01:05, il
-- laisse la nuit passer : un cours du soir est terminé, et rien ne se pointe la
-- nuit. Un simple `select` de la fonction idempotente, comme son aîné.
select cron.schedule(
  'rack-mark-no-shows',
  '5 1 * * *',
  $$select public.mark_no_shows();$$
);
