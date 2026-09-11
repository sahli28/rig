-- P1-006 — Lot 1 : le modèle de données de la liste d'attente.
--
-- `waitlist_entries` est à `promote_waitlist` ce que `bookings` est à
-- `book_class` : son unique écrivain est une fonction `security definer` (Lot 2),
-- donc elle n'a **aucune policy d'écriture** et un `grant select` seul. Calquée
-- sur `bookings` trait pour trait.
--
-- Le siège d'une place libérée est **tenu par `booked_count`** tant qu'une offre
-- court (modèle A) : `book_class` reste inchangé, sa porte `booked_count >=
-- capacity` bloque naturellement quiconque voudrait rafler le siège tenu.
-- `classes.waitlist_count` (ajouté en fin de fichier) est le compteur temps réel,
-- qui voyage dans la publication `supabase_realtime` **déjà** posée sur `classes`
-- — aucun `alter publication`, donc `realtime_publication_test` reste vert.

-- ---------------------------------------------------------------------------
-- Statuts — les six d'emblée
-- ---------------------------------------------------------------------------
-- `alter type … add value` est irréversible et force un rebuild d'index (même
-- raison que `booking_status`). On pose donc tout le cycle de vie maintenant :
--   WAITING        en file, en attente d'un siège
--   OFFERED        un siège lui est réservé ; `expires_at` court (60 min)
--   ACCEPTED       a confirmé (ou auto-promu < 12 h) → une réservation existe
--   EXPIRED        l'offre a expiré sans confirmation → le siège est passé plus loin
--   LEFT           a quitté la file, ou a décliné une offre
--   CLASS_CANCELLED la box a annulé le cours ; il n'y a plus de siège à tenir
create type public.waitlist_status as enum (
  'WAITING',
  'OFFERED',
  'ACCEPTED',
  'EXPIRED',
  'LEFT',
  'CLASS_CANCELLED'
);

-- ---------------------------------------------------------------------------
-- La table
-- ---------------------------------------------------------------------------
create table public.waitlist_entries (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  class_id uuid not null,
  membership_id uuid not null,
  status public.waitlist_status not null default 'WAITING',

  -- Clé d'insertion **immuable** : `coalesce(max(position),0)+1` sur toutes les
  -- lignes du cours (terminales comprises → jamais de collision après un retrait).
  -- La tête est `min(position) where status='WAITING'`. Le rang affiché est
  -- **dérivé** (nombre d'actives de position inférieure), jamais stocké — quitter
  -- ou promouvoir ne réécrit donc aucune ligne sœur.
  position integer not null,

  -- Idempotence du join (règle 4), obligatoire et bornée au membre comme
  -- `bookings` : un double tap sur réseau lent est le cas nominal.
  idempotency_key text not null,

  -- Cycle de l'offre. `offered_at`/`expires_at` : non nuls seulement en `OFFERED`.
  -- `promoted_at` : posé à l'acceptation (spec §866). `booking_id` : lien vers la
  -- réservation CONFIRMED créée à l'acceptation (pas de FK — elle vit sa vie).
  offered_at timestamptz,
  expires_at timestamptz,
  promoted_at timestamptz,
  booking_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Convention (règle 10). Le cycle de vie réel est porté par `status` ; ce
  -- champ reste pour l'homogénéité du schéma, non pour un filtrage.
  deleted_at timestamptz,

  constraint waitlist_idempotency_key_not_blank check (btrim(idempotency_key) <> ''),

  -- FK composites (piège 4) : une entrée de la box A ne peut pointer un cours ou
  -- une appartenance de la box B. `restrict`, comme `bookings`.
  constraint waitlist_class_same_tenant
    foreign key (class_id, tenant_id)
    references public.classes (id, tenant_id) on delete restrict,
  constraint waitlist_membership_same_tenant
    foreign key (membership_id, tenant_id)
    references public.memberships (id, tenant_id) on delete restrict
);

-- **Une seule entrée ACTIVE par membre et par cours.** Partielle, comme
-- `bookings_one_confirmed_per_member` : elle laisse cohabiter des entrées
-- terminales (LEFT, EXPIRED…) et une active, donc quitter-puis-revenir reste
-- possible. (Écart assumé vs le unique total de la spec §866, pour cette raison.)
create unique index waitlist_one_active_per_member
  on public.waitlist_entries (class_id, membership_id)
  where status in ('WAITING', 'OFFERED');

-- Idempotence portée par l'appartenance, jamais globale (même fuite évitée que
-- `bookings_idempotency_per_member`).
create unique index waitlist_idempotency_per_member
  on public.waitlist_entries (membership_id, idempotency_key);

-- Sélection de la tête + ordre FIFO (spec §866).
create index waitlist_class_position_idx
  on public.waitlist_entries (class_id, position);
-- Balayage borné des offres à expirer (Lot 3).
create index waitlist_expiring_idx
  on public.waitlist_entries (class_id, expires_at)
  where status = 'OFFERED';
-- Convention tenant.
create index waitlist_tenant_idx
  on public.waitlist_entries (tenant_id, created_at desc);

create trigger waitlist_entries_set_updated_at before update on public.waitlist_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS et droits — un membre voit **sa** file ; personne n'écrit en direct
-- ---------------------------------------------------------------------------
alter table public.waitlist_entries enable row level security;
alter table public.waitlist_entries force row level security;

-- Un membre voit ses propres entrées (sa position, ses offres). Pas de vue
-- staff « qui attend » pour l'instant : les critères de P1-006 ne la demandent
-- pas, et une audience de plus est une décision d'exposition à prendre à part.
create policy waitlist_own_select on public.waitlist_entries for select to authenticated
  using (
    membership_id in (
      select m.id from public.memberships m where m.user_id = (select auth.uid())
    )
  );

-- **Aucune policy d'écriture, et c'est le sujet.** `join_waitlist`,
-- `promote_waitlist`, `confirm_promotion`, `leave_waitlist` (Lot 2) sont
-- `security definer` ; l'absence de policy garantit qu'aucun autre chemin
-- n'existe, exactement comme pour `bookings`.
grant select on public.waitlist_entries to authenticated;

-- ---------------------------------------------------------------------------
-- classes.waitlist_count — le compteur temps réel
-- ---------------------------------------------------------------------------
-- Nombre d'entrées WAITING + OFFERED, maintenu sous le verrou du cours par
-- chaque fonction du Lot 2. Il voyage dans la ligne `classes` déjà publiée
-- (`20260906200000_realtime_classes.sql`) : `waitlist_length` en temps réel sans
-- publier `waitlist_entries` — donc sans liste de colonnes ni churn du test de
-- gel. `check (booked_count between 0 and capacity)` reste inchangée.
alter table public.classes
  add column waitlist_count integer not null default 0;
alter table public.classes
  add constraint classes_waitlist_count_nonneg check (waitlist_count >= 0);
