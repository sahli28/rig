-- P1-007 — Les producteurs de notifications : qui décide qu'une push doit partir.
--
-- Deux producteurs dans ce lot. Le troisième — la promotion de liste d'attente,
-- « une place se libère à 19 h, la personne suivante l'apprend » — appartient à
-- `promote_waitlist` (P1-006), qui n'existe pas encore : il enfilera un
-- `WAITLIST_PROMOTION` de la même façon quand il arrivera. C'est pour ça que
-- l'annulation **individuelle** (`cancel_booking`) n'enfile rien ici : son seul
-- aval est cette promotion, différée en P1-006. Voir la note des sœurs plus bas.

-- ---------------------------------------------------------------------------
-- enqueue_class_reminders — le rappel J-1
-- ---------------------------------------------------------------------------
--
-- Gabarit `mark_no_shows` : `security definer`, révoquée de tous, appelée par
-- `pg_cron`, idempotente par construction (elle ne mord qu'une fenêtre précise).
--
-- **Une fois par box et par jour.** Le job tourne au top de chaque heure ; il
-- n'agit que pour les boxes dont l'heure locale est 18 h à cet instant, et pour
-- les cours de **demain** (date locale de la box). Le top de l'heure garantit un
-- seul passage dans la fenêtre `= 18`, donc un seul rappel par réservation.
--
-- L'éligibilité (consentement PUSH, préférence de catégorie, quiet hours) est
-- déléguée à `enqueue_push` : à 18 h locales, les quiet hours (21 h–7 h) ne
-- mordent jamais, mais un membre qui a coupé les rappels ou le push, si.
--
-- Le contexte porte des **données** (le nom du type de cours dans les deux
-- langues, l'instant, le fuseau), jamais de prose : l'émetteur rend le titre et
-- le corps dans la langue du membre.
--
-- Limite assumée du pilote : si le job manque son passage de 18 h (serveur au
-- repos), il n'y a pas de rattrapage — le balayage rejoue l'*envoi*, pas
-- l'*enfilage*. Acceptable à une box ; à revoir si l'hébergement dort.
create or replace function public.enqueue_class_reminders(p_now timestamptz default now())
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
    where c.deleted_at is null
      and c.status <> 'CANCELLED'
      and extract(hour from (p_now at time zone t.timezone)) = 18
      and (c.starts_at at time zone t.timezone)::date = (p_now at time zone t.timezone)::date + 1
  loop
    if public.enqueue_push(
      r.membership_id,
      r.tenant_id,
      'CLASS_REMINDER',
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

comment on function public.enqueue_class_reminders(timestamptz) is
  'Rappel J-1 : à 18 h locales d''une box, enfile un CLASS_REMINDER par réservation confirmée des cours de demain. security definer, appelée par pg_cron.';

revoke all on function public.enqueue_class_reminders(timestamptz) from public, anon, authenticated;

-- Au top de chaque heure : le seul passage où une box peut être à 18 h pile.
select cron.schedule(
  'rack-enqueue-class-reminders',
  '0 * * * *',
  $$select public.enqueue_class_reminders();$$
);

-- ---------------------------------------------------------------------------
-- cancel_class_bookings — recréée pour enfiler l'annulation
-- ---------------------------------------------------------------------------
--
-- **La sœur, nommée pour ne pas être oubliée** (règle des sœurs, database.md) :
-- `cancel_booking` (annulation individuelle par le membre) et
-- `cancel_class_bookings` (annulation d'un cours entier par la box) sont
-- jumelles. Seule la seconde enfile un CLASS_CANCELLATION — c'est elle qui
-- correspond à la microcopie `planning.cancel_no_notification` de la grille du
-- planning (« les membres inscrits ne sont pas prévenus »), qui disparaît avec
-- ce lot. `cancel_booking` n'enfile rien : personne ne se prévient soi-même, et
-- son aval — prévenir la liste d'attente qu'une place s'ouvre — est un
-- WAITLIST_PROMOTION porté par `promote_waitlist` (P1-006).
--
-- Le corps est repris **tel quel** de `20260905100000_cancel_booking.sql` (un
-- `create or replace` ne peut pas être partiel) : verrou + garde de rôle dans le
-- `where`, `returning` pour l'ensemble exact annulé, `booked_count` recalculé et
-- non décrémenté, restitution par réservation. La seule addition est l'enfilage,
-- après que l'état est stable, sur ce même ensemble exact.
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
  -- La garde est dans le `where`, pas après le verrou : un cours d'une autre box
  -- n'est pas même verrouillé, et `current_admin_tenant_ids()` remplace tout
  -- prédicat de rôle recopié. Cours inconnu, cours d'une autre box et rôle
  -- insuffisant rendent la même réponse.
  select c.tenant_id into v_tenant_id
  from public.classes c
  where c.id = p_class_id
    and c.tenant_id in (select public.current_admin_tenant_ids())
  for update;

  if v_tenant_id is null then
    perform public.app_error(
      'FORBIDDEN_ROLE',
      'Ce cours n''existe pas, ou n''est pas accessible.',
      '42501'
    );
  end if;

  -- Le contexte de la notification, lu une fois sous le verrou : le nom du type
  -- de cours (les deux langues) et l'instant/fuseau pour l'émetteur.
  select ct.name_i18n, c.starts_at, t.timezone
  into v_class_name_i18n, v_starts_at, v_box_tz
  from public.classes c
  join public.class_types ct on ct.id = c.class_type_id
  join public.tenants t on t.id = c.tenant_id
  where c.id = p_class_id;

  -- `returning` plutôt qu'une fenêtre d'horloge : l'ensemble annulé est connu
  -- exactement, id **et** appartenance, ce dont la restitution comme l'enfilage
  -- ont besoin. Une heuristique `cancelled_at >= now() - 1s` raterait une ligne
  -- sous charge, ou en prendrait une de trop. Deux tableaux parallèles, pas une
  -- table temporaire : `cancel_class_bookings` doit rester ré-entrante — deux
  -- annulations dans une même transaction butaient sinon sur un `_annulees` déjà
  -- existant (une table temporaire `on commit drop` survit jusqu'au commit).
  with annulees as (
    update public.bookings
    set status = 'CANCELLED',
        cancelled_at = now(),
        -- Subie, donc jamais tardive.
        cancelled_within_window = true
    where class_id = p_class_id
      and status = 'CONFIRMED'
    returning id, membership_id
  )
  select array_agg(id), array_agg(membership_id)
  into v_ids, v_membership_ids
  from annulees;

  v_cancelled := coalesce(cardinality(v_ids), 0);

  -- Le compteur est **recalculé**, pas décrémenté : on réaffirme l'invariant
  -- sous le verrou plutôt que de propager une éventuelle dérive.
  update public.classes
  set booked_count = (
    select count(*) from public.bookings b
    where b.class_id = p_class_id and b.status = 'CONFIRMED'
  )
  where id = p_class_id;

  -- La restitution (vide au pilote) **et** l'enfilage de l'annulation, sur
  -- l'ensemble exact. CLASS_CANCELLATION est exempté des quiet hours : on
  -- prévient d'un cours annulé quelle que soit l'heure (classifieur immuable du
  -- lot 1). `enqueue_push` filtre quand même le consentement PUSH et la
  -- préférence de catégorie.
  if v_cancelled > 0 then
    v_context := jsonb_build_object(
      'class_id', p_class_id,
      'class_name_i18n', v_class_name_i18n,
      'starts_at', v_starts_at,
      'timezone', v_box_tz
    );
    for i in 1 .. v_cancelled loop
      perform public.restore_booking_entitlement(v_ids[i], true);
      perform public.enqueue_push(
        v_membership_ids[i],
        v_tenant_id,
        'CLASS_CANCELLATION',
        v_context
      );
    end loop;
    -- Un seul coup de sonnette pour tout le lot annulé.
    perform public.kick_push_emitter();
  end if;

  return v_cancelled;
end;
$$;

comment on function public.cancel_class_bookings(uuid) is
  'Annule les réservations d''un cours annulé par la box, recalcule booked_count, restitue, et enfile un CLASS_CANCELLATION par membre. Sœur de cancel_booking, qui n''enfile pas (son aval est promote_waitlist, P1-006).';

-- Droits inchangés par rapport à la définition d'origine.
revoke all on function public.cancel_class_bookings(uuid) from public, anon;
grant execute on function public.cancel_class_bookings(uuid) to authenticated;
