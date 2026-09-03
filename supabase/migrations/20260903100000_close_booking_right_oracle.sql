-- Trois corrections sur la migration précédente, dont une fuite.
--
-- Écrites dans une migration à part et non en retouchant
-- `20260903090000_bookings_and_book_class.sql` : une migration déjà appliquée ne
-- se modifie pas (`.claude/rules/database.md`), et le hook la bloque. Le coût
-- est un second fichier ; le gain est que l'histoire dit ce qui s'est passé.
--
-- Trouvées par `rls-auditor`, vérifiées à la main avant correction.

-- ---------------------------------------------------------------------------
-- 1. FUITE — `member_has_booking_right()` était un oracle inter-tenant
-- ---------------------------------------------------------------------------
--
-- Elle est `security definer` et ne filtre **ni sur `auth.uid()` ni sur le
-- tenant** : elle prend un `membership_id` et répond. Exposée à `authenticated`
-- par un `grant execute`, elle devenait un RPC PostgREST que n'importe quel
-- membre pouvait appeler sur l'appartenance de n'importe quelle box.
--
-- Vérifié avant correction, avec le compte Léa (membre de Rueil et de nulle
-- part ailleurs) :
--
--     lignes de Nanterre visibles par la RLS ........ 0
--     member_has_booking_right(<appartenance Nanterre>) .... true
--     member_has_booking_right(<identifiant inexistant>) ... false
--
-- Deux réponses distinctes, donc un oracle d'existence qui traverse la
-- frontière que tout le reste du schéma défend. Et il empire avec le produit :
-- P2-006 et P2-007 remplaceront ce corps par « l'abonnement est-il valide » puis
-- « le portefeuille est-il suffisant ». Le même appel dirait alors, sur une box
-- concurrente, si l'abonnement d'une personne est à jour.
--
-- **Le correctif est de retirer le grant, pas de durcir la fonction.** Son seul
-- appelant légitime est `book_class()`, elle-même `security definer` : elle
-- s'exécute sous le propriétaire et n'a jamais eu besoin que `authenticated`
-- détienne ce droit. Le grant était un réflexe, pas un besoin.
--
-- Sœur du motif déjà gardé ailleurs : `current_tenant_role(p_tenant_id)` prend
-- elle aussi un identifiant du client, et son commentaire dit pourquoi c'est
-- sans risque — « la fonction filtre toujours sur `auth.uid()` ». Ce croisement
-- manquait ici. C'était la jumelle oubliée.
revoke execute on function public.member_has_booking_right(uuid, timestamptz) from authenticated;

comment on function public.member_has_booking_right(uuid, timestamptz) is
  'Droits de réservation. Appelée uniquement par book_class(). Jamais exposée à authenticated : sans filtre sur auth.uid(), elle serait un oracle d''existence inter-tenant.';

-- ---------------------------------------------------------------------------
-- 2. Le coach voit les inscrits de ses cours
-- ---------------------------------------------------------------------------
--
-- `bookings_staff_select` filtre sur `current_admin_tenant_ids()`, qui ne rend
-- que OWNER et MANAGER. Un COACH ne voyait donc **aucune** réservation, pas même
-- celles du cours qu'il anime — alors que la spec §5.2 lui accorde « voir la
-- liste des inscrits · 🔸 ses cours », et que le roster de P1-008 en dépend.
--
-- Ce n'était pas une fuite mais un manque, et surtout un manque **non tracé** :
-- le ticket documentait ce qui est différé (la vue des pairs) et pas ceci.
--
-- La policy est bornée par le cours, pas par le tenant : un coach voit les
-- inscrits des cours dont il est le coach, et rien d'autre de sa box. C'est
-- exactement ce que la spec décrit, et c'est plus étroit que « toute la box ».
create policy bookings_coach_select on public.bookings for select to authenticated
  using (
    class_id in (
      select c.id
      from public.classes c
      join public.memberships m on m.id = c.coach_membership_id
      where m.user_id = (select auth.uid())
        and m.status = 'ACTIVE'
        and m.left_at is null
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Un réglage absent ne doit pas ouvrir les fenêtres, il doit lever
-- ---------------------------------------------------------------------------
--
-- `select … into v_settings` sans `strict` laisse `v_settings.*` à `NULL` si la
-- ligne manque. Les comparaisons deviennent alors `NULL`, jamais `true` : la
-- fenêtre de réservation **et** le plafond seraient silencieusement contournés.
-- C'est le piège 12 de `.claude/rules/database.md` — « une contrainte qui
-- s'évalue à NULL passe » — transposé dans une fonction.
--
-- Pas exploitable aujourd'hui : `create_tenant()` insère toujours la ligne et
-- aucun chemin ne permet de la supprimer. Mais l'invariant vit dans une autre
-- migration, et rien ne le rappelle ici. `strict` le rappelle, en levant.
create or replace function public.book_class(
  p_class_id uuid,
  p_membership_id uuid,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_tenant_id uuid;
  v_existing uuid;
  v_class record;
  v_settings record;
  v_upcoming integer;
begin
  -- 1. La clé d'abord. Sans elle, tout le reste est un pari sur le réseau.
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    perform public.app_error(
      'IDEMPOTENCY_KEY_REQUIRED',
      'Une clé d''idempotence est obligatoire pour réserver.',
      '22023'
    );
  end if;

  -- 2. On ne réserve que pour soi.
  select m.tenant_id into v_tenant_id
  from public.memberships m
  where m.id = p_membership_id
    and m.user_id = v_user_id;

  if v_tenant_id is null then
    perform public.app_error(
      'FORBIDDEN_ROLE',
      'Cette appartenance n''est pas la vôtre.',
      '42501'
    );
  end if;

  -- 3. Le rejeu, borné à l'appartenance.
  select b.id into v_existing
  from public.bookings b
  where b.membership_id = p_membership_id
    and b.idempotency_key = p_idempotency_key;

  if v_existing is not null then
    return v_existing;
  end if;

  -- 4. Le verrou.
  select c.id, c.starts_at, c.capacity, c.booked_count, c.status
  into v_class
  from public.classes c
  where c.id = p_class_id
    and c.tenant_id = v_tenant_id
    and c.deleted_at is null
  for update;

  if v_class.id is null then
    perform public.app_error(
      'FORBIDDEN_ROLE',
      'Ce cours n''existe pas, ou n''est pas accessible.',
      '42501'
    );
  end if;

  if v_class.status <> 'SCHEDULED' then
    perform public.app_error('BOOKING_WINDOW_CLOSED', 'Ce cours est annulé.', '23514');
  end if;

  -- 5. Déjà réservé, avant les fenêtres et les droits : qui a sa place n'a pas
  --    à s'entendre dire qu'elle est fermée, ni que le cours est complet.
  if exists (
    select 1 from public.bookings b
    where b.class_id = p_class_id
      and b.membership_id = p_membership_id
      and b.status = 'CONFIRMED'
  ) then
    perform public.app_error('ALREADY_BOOKED', 'Tu as déjà réservé ce cours.', '23505');
  end if;

  -- 6. Les droits.
  if not public.member_has_booking_right(p_membership_id, v_class.starts_at) then
    perform public.app_error(
      'NO_VALID_ENTITLEMENT',
      'Aucun droit de réservation valide.',
      '42501'
    );
  end if;

  -- **`strict`** : l'absence de réglages lève au lieu d'ouvrir les vannes.
  select ts.open_days_before, ts.close_minutes_before, ts.max_upcoming_bookings
  into strict v_settings
  from public.tenant_settings ts
  where ts.tenant_id = v_tenant_id;

  -- 7. Les fenêtres (RM2.3).
  if v_class.starts_at - now() < make_interval(mins => v_settings.close_minutes_before) then
    perform public.app_error(
      'BOOKING_WINDOW_CLOSED',
      'Les réservations pour ce cours sont closes.',
      '23514'
    );
  end if;

  if v_class.starts_at - now() > make_interval(days => v_settings.open_days_before) then
    perform public.app_error(
      'BOOKING_WINDOW_CLOSED',
      'Ce cours n''est pas encore ouvert à la réservation.',
      '23514'
    );
  end if;

  -- 8. Le plafond de réservations à venir (RM2.5).
  select count(*) into v_upcoming
  from public.bookings b
  join public.classes c on c.id = b.class_id
  where b.membership_id = p_membership_id
    and b.status = 'CONFIRMED'
    and c.starts_at > now();

  if v_upcoming >= v_settings.max_upcoming_bookings then
    perform public.app_error(
      'MAX_UPCOMING_BOOKINGS_REACHED',
      'Tu as atteint le nombre de réservations à venir autorisé.',
      '23514'
    );
  end if;

  -- 9. La capacité, lue sous le verrou.
  if v_class.booked_count >= v_class.capacity then
    perform public.app_error('CLASS_FULL', 'Ce cours est complet.', '23514');
  end if;

  -- 10. L'insertion, puis le compteur, dans la même transaction.
  insert into public.bookings (tenant_id, class_id, membership_id, idempotency_key)
  values (v_tenant_id, p_class_id, p_membership_id, p_idempotency_key)
  returning id into v_existing;

  update public.classes
  set booked_count = booked_count + 1
  where id = p_class_id;

  return v_existing;
exception
  when unique_violation then
    perform public.app_error('ALREADY_BOOKED', 'Tu as déjà réservé ce cours.', '23505');
    return null;
end;
$$;

revoke all on function public.book_class(uuid, uuid, text) from public, anon;
grant execute on function public.book_class(uuid, uuid, text) to authenticated;
