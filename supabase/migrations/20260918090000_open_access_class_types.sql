-- P2-020 — Open gym qui chevauche un cours, explicitement.
--
-- Demande commanditaire (16 sept. 2026) : l'accès libre occupe la même salle,
-- à la même heure, qu'un cours coaché — un cas **prévu et étiqueté**, pas un
-- chevauchement subi. Il n'existe aucun garde dur d'occupation de salle
-- (constat P1-026) et ce fichier n'en construit pas : il rend la règle
-- explicite — **signaler** deux cours coachés au même endroit, ne jamais
-- bloquer, et ne rien signaler dès qu'un des deux est en accès libre.
--
-- La règle repose sur une propriété du type (`is_open_access`), jamais sur le
-- nom « Open gym » : une box renomme son type sans casser le comportement.

-- Décision d'exposition, sans enjeu mais écrite (database.md) : `class_types`
-- est lisible par tout membre depuis P0-004 — c'est le catalogue qui peint le
-- planning — et un booléen d'accès libre est une propriété publique du cours,
-- pas une donnée personnelle. Les grants de table entière couvrent la colonne.
alter table public.class_types add column is_open_access boolean not null default false;

comment on column public.class_types.is_open_access is
  'Accès libre (open gym) : ce type peut occuper une salle en même temps qu''un cours coaché sans avertissement (P2-020). La règle de chevauchement repose sur cette colonne, pas sur le nom du type.';

-- ---------------------------------------------------------------------------
-- La règle, en SQL, à un seul endroit — et en SECURITY INVOKER
-- ---------------------------------------------------------------------------
--
-- Ces fonctions prennent un identifiant du client. En `security definer` elles
-- seraient un oracle d'existence inter-tenant — exactement ce que
-- `close_booking_right_oracle` (20260903100000) a fermé sur l'oracle des
-- droits. En invoker, la RLS de l'appelant s'applique **dans** la fonction :
-- un id d'une autre box ne joint aucune ligne et rend 0, indiscernable d'un
-- créneau libre. Le grant à authenticated ne révèle donc que ce que la RLS
-- montre déjà.

-- Les cours coachés qui chevauchent celui-ci, dans la même salle. 0 dès que
-- l'un des deux côtés est en accès libre — « au moins l'un », symétrique.
-- Les annulés et archivés ne comptent pas : on n'avertit pas sur un fantôme.
create or replace function public.coached_room_conflicts_for_class(
  p_class_id uuid
)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.classes a
  join public.class_types ta on ta.id = a.class_type_id
  join public.classes b
    on b.tenant_id = a.tenant_id
   and b.room_id = a.room_id
   and b.id <> a.id
   and a.starts_at < b.ends_at
   and b.starts_at < a.ends_at
  join public.class_types tb on tb.id = b.class_type_id
  where a.id = p_class_id
    and a.status = 'SCHEDULED' and a.deleted_at is null
    and b.status = 'SCHEDULED' and b.deleted_at is null
    and not ta.is_open_access
    and not tb.is_open_access;
$$;

-- Le même regard sur une série : combien de ses occurrences sont en conflit
-- coaché. On compte les **occurrences à signaler**, pas les paires — une
-- occurrence posée sur deux cours reste un seul avertissement. Les occurrences
-- d'une même série ne se comptent pas entre elles.
create or replace function public.coached_room_conflicts_for_schedule(
  p_schedule_id uuid
)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.classes c
  join public.class_types tc on tc.id = c.class_type_id
  where c.schedule_id = p_schedule_id
    and c.status = 'SCHEDULED' and c.deleted_at is null
    and not tc.is_open_access
    and exists (
      select 1
      from public.classes o
      join public.class_types t_autre on t_autre.id = o.class_type_id
      where o.tenant_id = c.tenant_id
        and o.room_id = c.room_id
        and o.id <> c.id
        and o.schedule_id is distinct from c.schedule_id
        and o.status = 'SCHEDULED' and o.deleted_at is null
        and c.starts_at < o.ends_at
        and o.starts_at < c.ends_at
        and not t_autre.is_open_access
    );
$$;

comment on function public.coached_room_conflicts_for_class(uuid) is
  'Cours coachés chevauchant celui-ci dans la même salle (P2-020). 0 si l''un des deux est en accès libre. Security invoker : la RLS de l''appelant s''applique, un id d''une autre box rend 0. Sert l''avertissement du planning — jamais un blocage.';
comment on function public.coached_room_conflicts_for_schedule(uuid) is
  'Occurrences de la série en conflit coaché de salle (P2-020). Même règles et même sécurité que la variante par cours.';

revoke all on function public.coached_room_conflicts_for_class(uuid) from public, anon;
revoke all on function public.coached_room_conflicts_for_schedule(uuid) from public, anon;
grant execute on function public.coached_room_conflicts_for_class(uuid) to authenticated;
grant execute on function public.coached_room_conflicts_for_schedule(uuid) to authenticated;
