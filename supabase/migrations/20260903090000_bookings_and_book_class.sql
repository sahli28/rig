-- P1-003 — Réservation transactionnelle.
--
-- « Un seul double-booking en production détruit la confiance de façon
-- irréversible. » Tout ce fichier sert cette phrase.
--
-- Trois lignes de défense, et **aucune n'est redondante** :
--
-- 1. le **verrou de ligne** sur `classes` sérialise les candidats à la dernière
--    place. C'est lui qui fait le travail ;
-- 2. le `check (booked_count between 0 and capacity)`, posé en P1-002, rattrape
--    un chemin d'écriture qui oublierait le verrou. Il ne remplace pas le
--    verrou : sans lui, deux transactions liraient le même compteur et
--    écriraient la même valeur, chacune persuadée d'avoir eu la place ;
-- 3. l'**index unique partiel** `(class_id, membership_id) where CONFIRMED`
--    interdit la double réservation même si la logique se trompe.
--
-- Ce qui n'y est pas, et c'est délibéré : aucune vérification côté client ne
-- fait autorité (RM2.1), et `booked_count` reste hors des `grant update` —
-- seule cette fonction, `security definer`, peut le bouger.

-- ---------------------------------------------------------------------------
-- Le statut d'une réservation
-- ---------------------------------------------------------------------------

-- `CANCELLED` existe dès maintenant bien que P1-004 seule l'écrira : l'index
-- unique partiel en dépend, et une valeur d'enum ajoutée plus tard obligerait à
-- recréer l'index. Contrairement à `HYROX_PREP` en P2-009, cette valeur a un
-- usage **immédiat** dans une contrainte — ce n'est pas une promesse, c'est une
-- pièce du mécanisme.
create type public.booking_status as enum ('CONFIRMED', 'CANCELLED');

-- Posée **avant** `bookings` : une FK composite exige que la clé référencée
-- existe déjà. `class_schedules` avait la sienne dès P1-002 ; `classes` non,
-- parce que rien ne la référençait encore.
alter table public.classes add constraint classes_id_tenant_key unique (id, tenant_id);

create table public.bookings (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  class_id uuid not null,
  membership_id uuid not null,
  status public.booking_status not null default 'CONFIRMED',
  -- La clé d'idempotence de l'appelant (règle 4 de `CLAUDE.md`). Elle est
  -- **obligatoire**, pas facultative : un double tap sur un réseau lent est le
  -- cas nominal, pas le cas limite.
  idempotency_key text not null,
  booked_at timestamptz not null default now(),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bookings_idempotency_key_not_blank check (btrim(idempotency_key) <> ''),

  -- FK composites : sans elles, une réservation de la box A pourrait pointer un
  -- cours de la box B, et un `on delete cascade` côté B détruirait des lignes de
  -- A (règle 4 de `.claude/rules/database.md`).
  constraint bookings_class_same_tenant
    foreign key (class_id, tenant_id)
    references public.classes (id, tenant_id) on delete restrict,
  constraint bookings_membership_same_tenant
    foreign key (membership_id, tenant_id)
    references public.memberships (id, tenant_id) on delete restrict
);

-- **La contrainte qui rend le double-booking impossible.** Partielle, pour
-- qu'annuler puis re-réserver reste possible (P1-004) : deux lignes `CANCELLED`
-- et une `CONFIRMED` cohabitent, deux `CONFIRMED` jamais.
create unique index bookings_one_confirmed_per_member
  on public.bookings (class_id, membership_id)
  where status = 'CONFIRMED';

-- L'unicité de la clé d'idempotence est **portée par l'appartenance**, pas
-- globale. Une clé globale laisserait un client rejouer la clé d'une autre
-- personne et recevoir l'identifiant de **sa** réservation — une fuite ouverte
-- par une contrainte censée protéger. Bornée au membre, le rejeu ne peut rendre
-- que sa propre réservation, par construction.
create unique index bookings_idempotency_per_member
  on public.bookings (membership_id, idempotency_key);

create index bookings_class_idx on public.bookings (class_id) where status = 'CONFIRMED';
create index bookings_member_upcoming_idx on public.bookings (membership_id, booked_at desc);
create index bookings_tenant_idx on public.bookings (tenant_id, booked_at desc);

create trigger bookings_set_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

comment on table public.bookings is
  'Réservations. Écrites uniquement par book_class(), sous verrou de ligne sur classes.';
comment on column public.bookings.idempotency_key is
  'Clé de l''appelant, unique par appartenance. Un rejeu rend la réservation d''origine.';

-- ---------------------------------------------------------------------------
-- Les droits — le point de couture de P2-006 et P2-007
-- ---------------------------------------------------------------------------

-- En phase pilote, « avoir des droits » veut dire « être membre actif » : la
-- box accorde à la main, en invitant. C'est le hors-périmètre du ticket, et
-- c'est un choix, pas un manque.
--
-- **P2-006 et P2-007 remplacent le corps de cette fonction**, ils n'en ajoutent
-- pas une seconde : l'abonnement dont la période couvre `p_class_starts_at`
-- (RM2.8), ou un portefeuille de crédits suffisant. Le paramètre ne sert à rien
-- aujourd'hui et existe pour ça — une signature qu'on n'aura pas à changer
-- coûte une ligne maintenant et évite de rouvrir la fonction la plus dangereuse
-- du produit le jour où elle portera de l'argent.
create or replace function public.member_has_booking_right(
  p_membership_id uuid,
  p_class_starts_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.id = p_membership_id
      and m.status = 'ACTIVE'
      and m.left_at is null
  );
$$;

comment on function public.member_has_booking_right(uuid, timestamptz) is
  'Droits de réservation. Pilote : appartenance active. P2-006 y met l''abonnement (RM2.8), P2-007 le portefeuille.';

-- ---------------------------------------------------------------------------
-- book_class — une seule transaction, un seul verrou
-- ---------------------------------------------------------------------------

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

  -- 2. On ne réserve que pour soi. Ce n'est pas de l'ergonomie : sans ce
  --    contrôle, n'importe qui inscrirait n'importe qui, et la fonction est
  --    `security definer`, donc la RLS ne le rattraperait pas.
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

  -- 3. Le rejeu, avant tout travail. Il est borné à l'appartenance : on ne peut
  --    rendre que sa propre réservation.
  select b.id into v_existing
  from public.bookings b
  where b.membership_id = p_membership_id
    and b.idempotency_key = p_idempotency_key;

  if v_existing is not null then
    return v_existing;
  end if;

  -- 4. **Le verrou.** Tout ce qui suit lit un état que personne d'autre ne peut
  --    modifier jusqu'au `commit`. C'est la ligne qui empêche le double-booking ;
  --    les contraintes en aval ne sont que des filets.
  --
  --    Le filtre de tenant est ici, et pas seulement dans la clause de
  --    l'appartenance : un cours d'une autre box ne doit pas même être verrouillé.
  select c.id, c.starts_at, c.capacity, c.booked_count, c.status
  into v_class
  from public.classes c
  where c.id = p_class_id
    and c.tenant_id = v_tenant_id
    and c.deleted_at is null
  for update;

  -- Cours inconnu et cours d'une autre box rendent la **même** réponse :
  -- confirmer l'existence d'un cours qu'on n'a pas le droit de voir serait déjà
  -- une divulgation (même raisonnement que « box inconnue / accès refusé »).
  if v_class.id is null then
    perform public.app_error(
      'FORBIDDEN_ROLE',
      'Ce cours n''existe pas, ou n''est pas accessible.',
      '42501'
    );
  end if;

  if v_class.status <> 'SCHEDULED' then
    perform public.app_error(
      'BOOKING_WINDOW_CLOSED',
      'Ce cours est annulé.',
      '23514'
    );
  end if;

  -- 5. **Déjà réservé, avant tout le reste.** L'ordre n'est pas cosmétique :
  --    placé après le contrôle de capacité, il faisait répondre « ce cours est
  --    complet » à quelqu'un qui **a** sa place et retape avec une nouvelle clé.
  --    Un message faux, sur le parcours le plus fréquent — trouvé par le test,
  --    pas par la relecture.
  --
  --    Il vient aussi avant les fenêtres et les droits, pour la même raison :
  --    qui a déjà sa place n'a pas à s'entendre dire qu'elle est fermée.
  --
  --    Ce `select` puis `insert` n'est pas la lecture-puis-écriture que la
  --    règle 3 interdit : il est **sous le verrou** de la ligne `classes`, donc
  --    aucune transaction concurrente ne peut insérer une réservation sur ce
  --    cours entre les deux. Et l'index unique partiel reste l'invariant, lui
  --    qui ne dépend d'aucun ordre d'instructions.
  if exists (
    select 1 from public.bookings b
    where b.class_id = p_class_id
      and b.membership_id = p_membership_id
      and b.status = 'CONFIRMED'
  ) then
    perform public.app_error(
      'ALREADY_BOOKED',
      'Tu as déjà réservé ce cours.',
      '23505'
    );
  end if;

  -- 6. Les droits. Une seule fonction, remplacée par P2-006 et P2-007.
  if not public.member_has_booking_right(p_membership_id, v_class.starts_at) then
    perform public.app_error(
      'NO_VALID_ENTITLEMENT',
      'Aucun droit de réservation valide.',
      '42501'
    );
  end if;

  select ts.open_days_before, ts.close_minutes_before, ts.max_upcoming_bookings
  into v_settings
  from public.tenant_settings ts
  where ts.tenant_id = v_tenant_id;

  -- 7. Les fenêtres (RM2.3). Elles se comparent en **instants**, ce qui est
  --    exact et indépendant du fuseau : `starts_at` porte déjà l'heure locale de
  --    la box convertie à la matérialisation. Le fuseau importe pour *afficher*
  --    un créneau, pas pour mesurer une durée qui l'en sépare.
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

  -- 9. La capacité, lue **sous le verrou**. C'est ici que la sérialisation paie.
  if v_class.booked_count >= v_class.capacity then
    perform public.app_error(
      'CLASS_FULL',
      'Ce cours est complet.',
      '23514'
    );
  end if;

  -- 10. L'insertion. La violation de `bookings_one_confirmed_per_member` remonte
  --    en 23505 : c'est ALREADY_BOOKED, et on la laisse parler plutôt que de
  --    faire un `select` préalable qui serait une lecture-puis-écriture — le
  --    motif que la règle 3 de `CLAUDE.md` interdit.
  insert into public.bookings (tenant_id, class_id, membership_id, idempotency_key)
  values (v_tenant_id, p_class_id, p_membership_id, p_idempotency_key)
  returning id into v_existing;

  -- 11. Le compteur, dans la même transaction. Le `check` de `classes` refuse un
  --     dépassement même si le verrou avait été oublié.
  update public.classes
  set booked_count = booked_count + 1
  where id = p_class_id;

  return v_existing;
exception
  when unique_violation then
    -- Deux cas, et un seul message : la réservation existe déjà. Distinguer
    -- « déjà réservé » de « clé rejouée en parallèle » n'apporterait rien à
    -- l'appelant, qui dans les deux cas a sa place.
    perform public.app_error(
      'ALREADY_BOOKED',
      'Tu as déjà réservé ce cours.',
      '23505'
    );
    return null;
end;
$$;

comment on function public.book_class(uuid, uuid, text) is
  'Réserve une place. Verrou de ligne sur classes, idempotent par (appartenance, clé). Seule écriture autorisée de bookings.';

-- `security definer` obligatoire : la fonction écrit `booked_count`, que
-- `authenticated` ne peut pas modifier — et c'est exactement ce qu'on veut.
revoke all on function public.member_has_booking_right(uuid, timestamptz) from public, anon;
revoke all on function public.book_class(uuid, uuid, text) from public, anon;
grant execute on function public.book_class(uuid, uuid, text) to authenticated;
grant execute on function public.member_has_booking_right(uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS et droits de table
-- ---------------------------------------------------------------------------

alter table public.bookings enable row level security;
alter table public.bookings force row level security;

-- Un membre voit **ses** réservations ; le staff voit celles de sa box, parce
-- qu'une feuille d'inscrits est son travail. La vue des pairs — ce qu'un membre
-- voit des autres inscrits — n'est **pas** ici : c'est une décision de
-- confidentialité qui se prend avec l'écran sous les yeux (voir P1-003, section
-- « la vue des pairs », et `.claude/rules/privacy.md`).
create policy bookings_own_select on public.bookings for select to authenticated
  using (
    membership_id in (
      select m.id from public.memberships m where m.user_id = (select auth.uid())
    )
  );

create policy bookings_staff_select on public.bookings for select to authenticated
  using (tenant_id in (select public.current_admin_tenant_ids()));

-- **Aucune policy d'écriture, et c'est le sujet.** `book_class()` est
-- `security definer` : elle n'a pas besoin de policy, et son absence garantit
-- qu'aucun autre chemin n'existe. Une policy `insert` ici, si permissive
-- soit-elle, rouvrirait la porte que le verrou referme.
grant select on public.bookings to authenticated;
