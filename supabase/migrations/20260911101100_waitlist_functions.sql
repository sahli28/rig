-- P1-006 — Lot 2 : les fonctions de la liste d'attente, et la greffe dans
-- l'annulation.
--
-- **L'épine dorsale, une fois pour toutes : le verrou de la ligne `classes`.**
-- `join_waitlist`, `promote_waitlist`, `confirm_promotion`, `leave_waitlist`,
-- `cancel_booking` et (lot 3) le balayage prennent tous `select … from
-- public.classes … for update` avant de toucher `booked_count`, `waitlist_count`
-- ou l'état d'une offre. C'est le seul point de sérialisation — celui que
-- `book_class`/`cancel_booking` utilisent déjà (règle 3, défense P1-004). Rien de
-- neuf en concurrence : confirm et le balayage ne peuvent pas se croiser, ils se
-- sérialisent sur ce verrou.
--
-- **Siège tenu par `booked_count` (modèle A).** Une place libérée reste comptée
-- tant qu'une offre court : `book_class` ne change pas, sa porte
-- `booked_count >= capacity` bloque quiconque voudrait rafler le siège tenu. La
-- confirmation / l'auto-book transfèrent le siège (booking CONFIRMED) **sans**
-- toucher `booked_count`. Si personne ne prend, le siège redevient libre par un
-- décrément explicite.

-- ---------------------------------------------------------------------------
-- promote_waitlist — donne le siège tenu à la première tête éligible
-- ---------------------------------------------------------------------------
-- **Précondition : l'appelant tient DÉJÀ le verrou de la ligne `classes`** et le
-- siège est encore compté dans `booked_count`. Interne (révoquée de tous les
-- rôles). Ne touche jamais `booked_count`. Rend l'id de l'entrée promue, ou
-- `null` si aucune tête éligible (l'appelant libère alors le siège).
--
-- Boucle sur les têtes WAITING par position et **saute les inéligibles** :
--   - déjà réservée pour ce cours (bord que `join_waitlist` interdit) → LEFT ;
--   - en auto-book (< 12 h), au plafond de réservations à venir → sautée, laissée
--     WAITING (elle sera reconsidérée si elle repasse sous le plafond).
create or replace function public.promote_waitlist(
  p_class_id uuid,
  p_tenant_id uuid,
  p_now timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_starts_at timestamptz;
  v_name_i18n jsonb;
  v_box_tz text;
  v_context jsonb;
  v_head record;
  v_booking_id uuid;
  v_max integer;
  v_upcoming integer;
begin
  -- Contexte du push + heure du cours, lus une fois sous le verrou déjà tenu.
  select c.starts_at, ct.name_i18n, t.timezone
  into v_starts_at, v_name_i18n, v_box_tz
  from public.classes c
  join public.class_types ct on ct.id = c.class_type_id
  join public.tenants t on t.id = c.tenant_id
  where c.id = p_class_id;

  v_context := jsonb_build_object(
    'class_id', p_class_id,
    'class_name_i18n', v_name_i18n,
    'starts_at', v_starts_at,
    'timezone', v_box_tz
  );

  for v_head in
    select w.id, w.membership_id
    from public.waitlist_entries w
    where w.class_id = p_class_id and w.status = 'WAITING'
    order by w.position
  loop
    -- Déjà réservée ? (ne devrait pas arriver — join l'interdit — mais on ne
    -- promeut pas dans le vide.) On la sort de la file et on continue.
    if exists (
      select 1 from public.bookings b
      where b.class_id = p_class_id
        and b.membership_id = v_head.membership_id
        and b.status = 'CONFIRMED'
    ) then
      update public.waitlist_entries set status = 'LEFT' where id = v_head.id;
      update public.classes set waitlist_count = waitlist_count - 1 where id = p_class_id;
      continue;
    end if;

    if p_now >= v_starts_at - interval '12 hours' then
      -- Auto-book (< 12 h, pas de fenêtre de confirmation). Le plafond de
      -- réservations à venir se vérifie ici : au plafond, on saute au suivant en
      -- la laissant WAITING (décision de périmètre : le plafond mord à l'auto-book
      -- et au join, pas à la confirmation d'une offre déjà faite).
      select ts.max_upcoming_bookings into v_max
      from public.tenant_settings ts where ts.tenant_id = p_tenant_id;

      select count(*) into v_upcoming
      from public.bookings b
      join public.classes c on c.id = b.class_id
      where b.membership_id = v_head.membership_id
        and b.status = 'CONFIRMED'
        and c.starts_at > p_now;

      if v_upcoming >= v_max then
        continue;
      end if;

      insert into public.bookings (tenant_id, class_id, membership_id, idempotency_key)
      values (p_tenant_id, p_class_id, v_head.membership_id, 'wl-' || v_head.id::text)
      returning id into v_booking_id;

      update public.waitlist_entries
      set status = 'ACCEPTED', promoted_at = p_now, booking_id = v_booking_id
      where id = v_head.id;
      update public.classes set waitlist_count = waitlist_count - 1 where id = p_class_id;

      perform public.enqueue_push(
        v_head.membership_id, p_tenant_id, 'WAITLIST_PROMOTION',
        v_context || jsonb_build_object('requires_confirmation', false), p_now
      );
      return v_head.id;
    else
      -- Offre (≥ 12 h) : le siège lui est réservé 60 minutes. Reste OFFERED (donc
      -- toujours compté dans waitlist_count) ; booked_count inchangé (siège tenu).
      update public.waitlist_entries
      set status = 'OFFERED', offered_at = p_now, expires_at = p_now + interval '60 minutes'
      where id = v_head.id;

      perform public.enqueue_push(
        v_head.membership_id, p_tenant_id, 'WAITLIST_PROMOTION',
        v_context || jsonb_build_object('requires_confirmation', true), p_now
      );
      return v_head.id;
    end if;
  end loop;

  return null;
end;
$$;

revoke all on function public.promote_waitlist(uuid, uuid, timestamptz)
  from public, anon, authenticated;

comment on function public.promote_waitlist(uuid, uuid, timestamptz) is
  'Interne. Sous le verrou classes déjà tenu par l''appelant, offre (≥12h) ou auto-book (<12h) le siège tenu à la première tête WAITING éligible, enfile un WAITLIST_PROMOTION. Rend l''id promu, ou null si personne (l''appelant libère alors le siège). Ne touche jamais booked_count.';

-- ---------------------------------------------------------------------------
-- join_waitlist — rejoindre la file d'un cours complet
-- ---------------------------------------------------------------------------
-- Miroir des gardes de `book_class`, mais la capacité est **inversée** : on ne
-- rejoint que ce qui est complet. `book_class` reste inchangé et lève toujours
-- CLASS_FULL ; le client attrape et propose de rejoindre — acte explicite.
create or replace function public.join_waitlist(
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
  v_position integer;
  v_id uuid;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    perform public.app_error('IDEMPOTENCY_KEY_REQUIRED',
      'Une clé d''idempotence est obligatoire.', '22023');
  end if;

  select m.tenant_id into v_tenant_id
  from public.memberships m
  where m.id = p_membership_id and m.user_id = v_user_id;
  if v_tenant_id is null then
    perform public.app_error('FORBIDDEN_ROLE', 'Cette appartenance n''est pas la vôtre.', '42501');
  end if;

  -- Rejeu, borné à l'appartenance.
  select w.id into v_existing
  from public.waitlist_entries w
  where w.membership_id = p_membership_id and w.idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return v_existing;
  end if;

  select c.id, c.starts_at, c.capacity, c.booked_count, c.status
  into v_class
  from public.classes c
  where c.id = p_class_id and c.tenant_id = v_tenant_id and c.deleted_at is null
  for update;
  if v_class.id is null then
    perform public.app_error('FORBIDDEN_ROLE', 'Ce cours n''existe pas, ou n''est pas accessible.', '42501');
  end if;
  if v_class.status <> 'SCHEDULED' then
    perform public.app_error('BOOKING_WINDOW_CLOSED', 'Ce cours est annulé.', '23514');
  end if;

  if exists (
    select 1 from public.bookings b
    where b.class_id = p_class_id and b.membership_id = p_membership_id and b.status = 'CONFIRMED'
  ) then
    perform public.app_error('ALREADY_BOOKED', 'Tu as déjà réservé ce cours.', '23505');
  end if;

  -- On ne rejoint la file que d'un cours **complet** : sinon, il faut réserver.
  if v_class.booked_count < v_class.capacity then
    perform public.app_error('CLASS_NOT_FULL',
      'Ce cours n''est pas complet — tu peux le réserver directement.', '23514');
  end if;

  if not public.member_has_booking_right(p_membership_id, v_class.starts_at) then
    perform public.app_error('NO_VALID_ENTITLEMENT', 'Aucun droit de réservation valide.', '42501');
  end if;

  select ts.open_days_before, ts.close_minutes_before, ts.max_upcoming_bookings
  into strict v_settings
  from public.tenant_settings ts where ts.tenant_id = v_tenant_id;

  -- On ne rejoint que tant qu'on pourrait réserver. La **promotion** d'un siège
  -- libéré, elle, ignorera cette fenêtre (le siège est réel), mais l'entrée dans
  -- la file la respecte.
  if v_class.starts_at - now() < make_interval(mins => v_settings.close_minutes_before) then
    perform public.app_error('BOOKING_WINDOW_CLOSED', 'Les réservations pour ce cours sont closes.', '23514');
  end if;
  if v_class.starts_at - now() > make_interval(days => v_settings.open_days_before) then
    perform public.app_error('BOOKING_WINDOW_CLOSED', 'Ce cours n''est pas encore ouvert.', '23514');
  end if;

  -- Le plafond des réservations à venir vaut aussi pour la file : inutile
  -- d'attendre une place qu'on ne pourrait pas prendre.
  select count(*) into v_upcoming
  from public.bookings b
  join public.classes c on c.id = b.class_id
  where b.membership_id = p_membership_id and b.status = 'CONFIRMED' and c.starts_at > now();
  if v_upcoming >= v_settings.max_upcoming_bookings then
    perform public.app_error('MAX_UPCOMING_BOOKINGS_REACHED',
      'Tu as atteint le nombre de réservations à venir autorisé.', '23514');
  end if;

  -- Position = clé immuable, calculée sous le verrou.
  select coalesce(max(w.position), 0) + 1 into v_position
  from public.waitlist_entries w where w.class_id = p_class_id;

  insert into public.waitlist_entries (tenant_id, class_id, membership_id, position, idempotency_key)
  values (v_tenant_id, p_class_id, p_membership_id, v_position, p_idempotency_key)
  returning id into v_id;

  update public.classes set waitlist_count = waitlist_count + 1 where id = p_class_id;
  return v_id;
exception
  when unique_violation then
    -- L'index partiel actif a mordu : déjà en file pour ce cours.
    perform public.app_error('ALREADY_ON_WAITLIST', 'Tu es déjà en liste d''attente pour ce cours.', '23505');
    return null;
end;
$$;

revoke all on function public.join_waitlist(uuid, uuid, text) from public, anon;
grant execute on function public.join_waitlist(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- confirm_promotion — accepter une offre dans le délai
-- ---------------------------------------------------------------------------
-- L'id de l'entrée fait l'idempotence (comme le booking id pour cancel_booking).
-- Le verrou de la ligne classes tranche la course confirm / balayage.
create or replace function public.confirm_promotion(p_waitlist_entry_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_entry record;
  v_booking_id uuid;
begin
  select w.id, w.class_id, w.tenant_id, w.membership_id, w.status, w.booking_id, w.expires_at
  into v_entry
  from public.waitlist_entries w
  join public.memberships m on m.id = w.membership_id
  where w.id = p_waitlist_entry_id and m.user_id = v_user_id;

  if v_entry.id is null then
    perform public.app_error('FORBIDDEN_ROLE', 'Cette offre n''existe pas, ou n''est pas la vôtre.', '42501');
  end if;

  -- Déjà confirmée : rendre le booking, sans rien retoucher (idempotent).
  if v_entry.status = 'ACCEPTED' then
    return v_entry.booking_id;
  end if;

  -- Le verrou, puis re-lecture de l'état sous le verrou (le balayage a pu passer).
  perform 1 from public.classes c where c.id = v_entry.class_id for update;
  select w.status, w.expires_at, w.booking_id into v_entry.status, v_entry.expires_at, v_entry.booking_id
  from public.waitlist_entries w where w.id = p_waitlist_entry_id;

  if v_entry.status = 'ACCEPTED' then
    return v_entry.booking_id;
  end if;
  if v_entry.status <> 'OFFERED' or v_entry.expires_at is null or v_entry.expires_at <= now() then
    perform public.app_error('OFFER_EXPIRED', 'Cette offre a expiré. La place est passée au suivant.', '23514');
  end if;

  -- Le siège est déjà tenu par booked_count : on transforme l'offre en
  -- réservation SANS toucher booked_count. C'est ici que P2-007 débitera le crédit.
  insert into public.bookings (tenant_id, class_id, membership_id, idempotency_key)
  values (v_entry.tenant_id, v_entry.class_id, v_entry.membership_id, 'wl-' || v_entry.id::text)
  returning id into v_booking_id;

  update public.waitlist_entries
  set status = 'ACCEPTED', promoted_at = now(), booking_id = v_booking_id
  where id = p_waitlist_entry_id;
  update public.classes set waitlist_count = waitlist_count - 1 where id = v_entry.class_id;

  return v_booking_id;
end;
$$;

revoke all on function public.confirm_promotion(uuid) from public, anon;
grant execute on function public.confirm_promotion(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- leave_waitlist — quitter la file, ou décliner une offre
-- ---------------------------------------------------------------------------
create or replace function public.leave_waitlist(p_waitlist_entry_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_entry record;
  v_promoted uuid;
begin
  select w.id, w.class_id, w.tenant_id, w.status
  into v_entry
  from public.waitlist_entries w
  join public.memberships m on m.id = w.membership_id
  where w.id = p_waitlist_entry_id and m.user_id = v_user_id;

  if v_entry.id is null then
    perform public.app_error('FORBIDDEN_ROLE', 'Cette entrée n''existe pas, ou n''est pas la vôtre.', '42501');
  end if;

  -- Terminal → idempotent.
  if v_entry.status in ('ACCEPTED', 'EXPIRED', 'LEFT', 'CLASS_CANCELLED') then
    return v_entry.id;
  end if;

  perform 1 from public.classes c where c.id = v_entry.class_id for update;
  select w.status into v_entry.status
  from public.waitlist_entries w where w.id = p_waitlist_entry_id;

  if v_entry.status = 'WAITING' then
    update public.waitlist_entries set status = 'LEFT' where id = p_waitlist_entry_id;
    update public.classes set waitlist_count = waitlist_count - 1 where id = v_entry.class_id;
  elsif v_entry.status = 'OFFERED' then
    -- Décliner : le siège tenu cascade au suivant, ou redevient libre.
    update public.waitlist_entries set status = 'LEFT' where id = p_waitlist_entry_id;
    update public.classes set waitlist_count = waitlist_count - 1 where id = v_entry.class_id;
    v_promoted := public.promote_waitlist(v_entry.class_id, v_entry.tenant_id, now());
    if v_promoted is null then
      update public.classes set booked_count = booked_count - 1 where id = v_entry.class_id;
    else
      perform public.kick_push_emitter();
    end if;
  end if;

  return p_waitlist_entry_id;
end;
$$;

revoke all on function public.leave_waitlist(uuid) from public, anon;
grant execute on function public.leave_waitlist(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- expire_waitlist_offers — le balayage : cascade ou retour en place libre
-- ---------------------------------------------------------------------------
-- **Le seul mécanisme qui agit quand toute la file ignore l'offre** — donc ce qui
-- rend vrai « aucune place perdue, retour en place libre ». Interne, révoquée de
-- tous les rôles, gabarit `mark_no_shows`/`enqueue_class_reminders`. Le `< 30 s`
-- est tenu en synchrone par `cancel_booking` ; ce balayage tolère ~1 min.
create or replace function public.expire_waitlist_offers(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer record;
  v_expired integer := 0;
  v_promoted uuid;
  v_enqueued boolean := false;
begin
  for v_offer in
    select w.id, w.class_id, w.tenant_id
    from public.waitlist_entries w
    where w.status = 'OFFERED' and w.expires_at < p_now
    order by w.class_id, w.expires_at
  loop
    -- Verrou du cours, puis re-vérif sous le verrou : le membre a pu confirmer
    -- entre la lecture de la boucle et l'obtention du verrou. La sérialisation
    -- confirm / balayage se joue ici.
    perform 1 from public.classes c where c.id = v_offer.class_id for update;
    continue when not exists (
      select 1 from public.waitlist_entries w
      where w.id = v_offer.id and w.status = 'OFFERED' and w.expires_at < p_now
    );

    update public.waitlist_entries set status = 'EXPIRED' where id = v_offer.id;
    update public.classes set waitlist_count = waitlist_count - 1 where id = v_offer.class_id;
    v_expired := v_expired + 1;

    -- Le siège tenu cascade au suivant, ou redevient libre si la file est épuisée.
    v_promoted := public.promote_waitlist(v_offer.class_id, v_offer.tenant_id, p_now);
    if v_promoted is null then
      update public.classes set booked_count = booked_count - 1 where id = v_offer.class_id;
    else
      v_enqueued := true;
    end if;
  end loop;

  if v_enqueued then
    perform public.kick_push_emitter();
  end if;
  return v_expired;
end;
$$;

revoke all on function public.expire_waitlist_offers(timestamptz) from public, anon, authenticated;

comment on function public.expire_waitlist_offers(timestamptz) is
  'Balayage (cron 1 min). Sous le verrou de chaque cours, expire les offres dépassées et cascade le siège tenu au suivant, ou le libère si la file est épuisée. Interne.';

select cron.schedule(
  'rack-expire-waitlist-offers',
  '* * * * *',
  $$select public.expire_waitlist_offers();$$
);

-- ---------------------------------------------------------------------------
-- cancel_booking — la greffe : promouvoir avant de libérer le siège
-- ---------------------------------------------------------------------------
-- `create or replace` (règle 13 : migration ajoutée). Corps identique à
-- `20260905100000_cancel_booking.sql` **sauf** le décrément final (ex-lignes
-- 266-268) : on tente d'abord de promouvoir la file ; si personne, on libère le
-- siège. Le court-circuit « déjà annulée » et la garde CAS `if not found`
-- garantissent que la promotion part **exactement une fois** par siège libéré.
create or replace function public.cancel_booking(p_booking_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_booking record;
  v_class record;
  v_window_minutes integer;
  v_within boolean;
  v_promoted uuid;
begin
  select b.id, b.class_id, b.tenant_id, b.status
  into v_booking
  from public.bookings b
  join public.memberships m on m.id = b.membership_id
  where b.id = p_booking_id and m.user_id = v_user_id;

  if v_booking.id is null then
    perform public.app_error('FORBIDDEN_ROLE', 'Cette réservation n''existe pas, ou n''est pas la vôtre.', '42501');
  end if;

  -- Déjà annulée : idempotent, avant le verrou et la garde « cours commencé ».
  if v_booking.status = 'CANCELLED' then
    return v_booking.id;
  end if;

  select c.id, c.starts_at
  into v_class
  from public.classes c
  where c.id = v_booking.class_id
  for update;

  -- Un cours commencé ne s'annule plus (protège la trace no-show, RM3.4).
  if v_class.starts_at <= now() then
    perform public.app_error('CLASS_ALREADY_STARTED', 'Ce cours a déjà eu lieu. Contacte ta box.', '23514');
  end if;

  select ts.cancel_window_minutes into strict v_window_minutes
  from public.tenant_settings ts where ts.tenant_id = v_booking.tenant_id;

  v_within := v_class.starts_at - now() >= make_interval(mins => v_window_minutes);

  -- Compare-and-swap : la seconde annulation concurrente réévalue son `where`
  -- contre une ligne devenue CANCELLED et n'affecte rien (défense P1-004).
  update public.bookings
  set status = 'CANCELLED', cancelled_at = now(), cancelled_within_window = v_within
  where id = v_booking.id and status = 'CONFIRMED';

  if not found then
    return v_booking.id;
  end if;

  -- **La greffe P1-006.** Le siège vient de se libérer, sous le verrou : on
  -- l'offre à la file. Si personne n'attend (`null`), on libère le siège comme
  -- avant. Sinon il reste tenu par booked_count, et un WAITLIST_PROMOTION est parti.
  v_promoted := public.promote_waitlist(v_booking.class_id, v_booking.tenant_id, now());
  if v_promoted is null then
    update public.classes set booked_count = booked_count - 1 where id = v_booking.class_id;
  else
    perform public.kick_push_emitter();
  end if;

  perform public.restore_booking_entitlement(v_booking.id, v_within);
  return v_booking.id;
end;
$$;

revoke all on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.cancel_booking(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- cancel_class_bookings — nettoyer la file quand la box annule le cours
-- ---------------------------------------------------------------------------
-- `create or replace` : corps identique à `20260911100700_push_producers.sql`
-- **plus** le nettoyage de la file. Le cours n'existe plus : pas de promotion,
-- mais les entrées WAITING/OFFERED restantes passent à CLASS_CANCELLED, et le
-- siège éventuellement tenu par une offre est libéré (booked_count recalculé le
-- fait déjà). Sans ce nettoyage : entrées orphelines + waitlist_count bloqué.
create or replace function public.cancel_class_bookings(p_class_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_cancelled integer;
  v_class_name_i18n jsonb;
  v_starts_at timestamptz;
  v_box_tz text;
  v_ids uuid[];
  v_membership_ids uuid[];
  v_context jsonb;
  i integer;
begin
  select c.tenant_id into v_tenant_id
  from public.classes c
  where c.id = p_class_id and c.tenant_id in (select public.current_admin_tenant_ids())
  for update;

  if v_tenant_id is null then
    perform public.app_error('FORBIDDEN_ROLE', 'Ce cours n''existe pas, ou n''est pas accessible.', '42501');
  end if;

  select ct.name_i18n, c.starts_at, t.timezone
  into v_class_name_i18n, v_starts_at, v_box_tz
  from public.classes c
  join public.class_types ct on ct.id = c.class_type_id
  join public.tenants t on t.id = c.tenant_id
  where c.id = p_class_id;

  with annulees as (
    update public.bookings
    set status = 'CANCELLED', cancelled_at = now(), cancelled_within_window = true
    where class_id = p_class_id and status = 'CONFIRMED'
    returning id, membership_id
  )
  select array_agg(id), array_agg(membership_id) into v_ids, v_membership_ids from annulees;

  v_cancelled := coalesce(cardinality(v_ids), 0);

  -- **Nettoyage de la file (P1-006).** Le cours est annulé : plus de siège à
  -- tenir ni à offrir. Les entrées encore actives passent à CLASS_CANCELLED.
  update public.waitlist_entries
  set status = 'CLASS_CANCELLED'
  where class_id = p_class_id and status in ('WAITING', 'OFFERED');

  -- booked_count et waitlist_count réaffirmés sous le verrou : on réaffirme
  -- l'invariant plutôt que de propager une dérive (une offre tenait un siège).
  update public.classes
  set booked_count = (
        select count(*) from public.bookings b
        where b.class_id = p_class_id and b.status = 'CONFIRMED'
      ),
      waitlist_count = (
        select count(*) from public.waitlist_entries w
        where w.class_id = p_class_id and w.status in ('WAITING', 'OFFERED')
      )
  where id = p_class_id;

  if v_cancelled > 0 then
    v_context := jsonb_build_object(
      'class_id', p_class_id, 'class_name_i18n', v_class_name_i18n,
      'starts_at', v_starts_at, 'timezone', v_box_tz
    );
    for i in 1 .. v_cancelled loop
      perform public.restore_booking_entitlement(v_ids[i], true);
      perform public.enqueue_push(v_membership_ids[i], v_tenant_id, 'CLASS_CANCELLATION', v_context);
    end loop;
    perform public.kick_push_emitter();
  end if;

  return v_cancelled;
end;
$$;

revoke all on function public.cancel_class_bookings(uuid) from public, anon;
grant execute on function public.cancel_class_bookings(uuid) to authenticated;
