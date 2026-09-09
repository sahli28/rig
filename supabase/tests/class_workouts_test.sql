-- P1-015 — La séance du cours, écrite par le coach.
--
-- ---------------------------------------------------------------------------
-- Ce que ce fichier cherche en premier, et pourquoi
-- ---------------------------------------------------------------------------
--
-- **L'effacement silencieux.** `refresh_class_schedule()` archive les
-- occurrences d'une série avant de les rematérialiser. Deux protections
-- existaient — une occurrence **réservée** survit, une occurrence
-- **dérogatoire** aussi — et une occurrence qui porte une séance n'était ni
-- l'une ni l'autre.
--
-- Le geste qui coûte : le coach écrit son WOD du jeudi, le gérant corrige
-- l'horaire de la série, et le texte disparaît. Sans erreur, sans trace, et il
-- ne s'en aperçoit qu'en salle.
--
-- Trouvé par la section « ce que ce ticket suppose », **avant d'écrire une
-- ligne** — pas par un test, pas par un audit. Le test est ici pour que ça ne
-- redevienne jamais vrai.

begin;
select plan(30);

-- ---------------------------------------------------------------------------
-- 1. La forme
-- ---------------------------------------------------------------------------

select has_table('public', 'class_workouts', 'la séance du cours existe');
select has_column('public', 'class_workouts', 'tenant_id', 'et elle est tenant-scopée (règle 1)');
select has_column('public', 'class_workouts', 'body', 'le texte, libre');
select has_column('public', 'class_workouts', 'published_at', 'et sa publication');

select ok(
  (select relrowsecurity and relforcerowsecurity
     from pg_class where oid = 'public.class_workouts'::regclass),
  'RLS activée **et** forcée'
);

select has_function(
  'public',
  'current_staff_tenant_ids',
  'le helper qui inclut les COACH — sœur de current_admin_tenant_ids()'
);

-- **Une séance par occurrence.** Deux séances sur le même cours, ce serait deux
-- vérités affichables et aucune règle pour choisir.
select ok(
  exists (
    select 1
    from pg_index i
    join pg_class c on c.oid = i.indrelid
    where c.relname = 'class_workouts' and i.indisunique
      and pg_get_indexdef(i.indexrelid) like '%(class_id)%'
  ),
  'une seule séance vivante par occurrence'
);

-- ---------------------------------------------------------------------------
-- 2. Le décor : une occurrence de Rueil, sans réservation
-- ---------------------------------------------------------------------------

-- Sans réservation **et** sans dérogation : c'est exactement la ligne que
-- `refresh_class_schedule()` archivait. Le décor est le défaut.
--
-- **`starts_at > now()` n'est pas un détail de confort.** La réconciliation ne
-- touche que `greatest(p_from, current_date)` et au-delà : une occurrence passée
-- est épargnée **par sa date**, pas par ce qu'elle porte. Sans ce filtre, ce
-- fichier passait au vert **avec la troisième protection retirée** — le contrôle
-- négatif l'a montré, et c'est exactement le faux vert que ce dépôt traque.
create temporary table cible as
select id, schedule_id, starts_at
from public.classes
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'
  and schedule_id = 'a7000000-0000-4000-8000-000000000001'
  and booked_count = 0
  and is_override = false
  and deleted_at is null
  and starts_at > now()
order by starts_at
limit 1;
grant select on cible to authenticated;

select cmp_ok(
  (select count(*) from cible)::int, '=', 1,
  'le décor tient : une occurrence sans réservation et sans dérogation'
);

-- **La voisine**, du même type et de la même série : c'est elle qui prouve que
-- la séance ne déborde pas. Sans elle, « une séance par occurrence » n'est
-- qu'une affirmation.
create temporary table voisine as
select id from public.classes
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'
  and schedule_id = 'a7000000-0000-4000-8000-000000000001'
  and deleted_at is null
  and starts_at > now()
  and id <> (select id from cible)
order by starts_at
limit 1;
grant select on voisine to authenticated;

select cmp_ok(
  (select count(*) from voisine)::int, '=', 1,
  'et une voisine existe pour servir de témoin'
);

-- ---------------------------------------------------------------------------
-- 3. Qui écrit — le coach, et lui seul parmi les non-administrateurs
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"44444444-0000-4000-8000-000000000001","role":"authenticated","email":"sarah@example.com"}';

select lives_ok(
  $$insert into public.class_workouts (tenant_id, class_id, title, body)
    values ('aaaaaaaa-0000-4000-8000-000000000001', (select id from cible),
            'Jeudi endurance', 'Échauffement 10 min' || chr(10) || 'Metcon : 5 rounds')$$,
  'un COACH écrit la séance de sa box'
);

set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select throws_ok(
  $$insert into public.class_workouts (tenant_id, class_id, body)
    values ('aaaaaaaa-0000-4000-8000-000000000001', (select id from cible), 'Écrit par un membre')$$,
  '42501',
  null,
  'un MEMBER n''écrit pas de séance'
);

-- ---------------------------------------------------------------------------
-- 4. Qui lit — et la publication décide
-- ---------------------------------------------------------------------------

-- Non publiée, elle n'existe pas pour un membre. C'est le brouillon du coach :
-- le lire reviendrait à publier ce qu'il n'a pas publié.
select is(
  (select count(*) from public.class_workouts where class_id = (select id from cible))::int,
  0,
  'une séance non publiée est invisible d''un membre'
);

reset role;
update public.class_workouts set published_at = now() where class_id = (select id from cible);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select is(
  (select body from public.class_workouts where class_id = (select id from cible)),
  'Échauffement 10 min' || chr(10) || 'Metcon : 5 rounds',
  'publiée, elle se lit — **et les sauts de ligne sont conservés tels quels**'
);

-- **La promesse de la décision par occurrence, avec son témoin.**
--
-- C'est la raison exacte pour laquelle le rattachement au couple (date, type)
-- a été écarté : il aurait fait suivre le cours du matin quand le coach allège
-- celui du soir. Sans témoin, ce fichier **affirme** cette propriété au lieu de
-- la prouver — et une promesse sans témoin est le sujet de la règle 10.
select is(
  (select count(*) from public.class_workouts
   where class_id = (select id from voisine))::int,
  0,
  'la séance écrite sur une occurrence n''apparaît pas sur sa voisine du même type'
);

-- ---------------------------------------------------------------------------
-- L'isolation, **dans les deux sens et avec de quoi voir**
-- ---------------------------------------------------------------------------
--
-- Observer « rien de Nanterre » quand Nanterre n'a rien serait vert **par
-- absence**, pas par cloisonnement. On pose donc une séance de chaque côté :
-- le contrôle positif est alors dans la mesure elle-même, comme la sonde de
-- P1-005a qui reçoit bien un événement avant qu'on croie à son silence.
reset role;

insert into public.class_workouts (tenant_id, class_id, body, published_at)
select 'bbbbbbbb-0000-4000-8000-000000000001', c.id, 'Séance de Nanterre', now()
from public.classes c
where c.tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001'
  and c.deleted_at is null
order by c.starts_at
limit 1;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select is(
  (select count(*) from public.class_workouts)::int,
  1,
  'Léa voit **une** séance — la sienne : sans ce compte, le silence d''en face ne prouverait rien'
);

select is(
  (select body from public.class_workouts),
  'Échauffement 10 min' || chr(10) || 'Metcon : 5 rounds',
  'et c''est bien celle de Rueil, pas celle de Nanterre'
);

set local request.jwt.claims =
  '{"sub":"55555555-0000-4000-8000-000000000001","role":"authenticated","email":"thomas@example.com"}';

select is(
  (select body from public.class_workouts),
  'Séance de Nanterre',
  'et Thomas ne voit que la sienne — le cloisonnement joue **dans les deux sens**'
);

set local request.jwt.claims =
  '{"sub":"22222222-0000-4000-8000-000000000001","role":"authenticated","email":"claire@nanterre.example"}';

select throws_ok(
  $$insert into public.class_workouts (tenant_id, class_id, body)
    values ('aaaaaaaa-0000-4000-8000-000000000001', (select id from cible), 'Écrit d''ailleurs')$$,
  '42501',
  null,
  'et la propriétaire d''une autre box n''y écrit pas non plus'
);

-- ---------------------------------------------------------------------------
-- 5. **Le test qui compte** : la séance survit au rafraîchissement de série
-- ---------------------------------------------------------------------------

-- **Sous l'identité du gérant, et pas sous `postgres`.** La fonction vérifie
-- `auth.uid()` contre les appartenances : jouée en superutilisateur elle lève
-- `42501`, et le test échouerait sur son décor au lieu de son sujet.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

-- Le geste réel : le gérant corrige l'horaire de la série, ce qui rejoue la
-- réconciliation sur tout l'horizon.
select lives_ok(
  $$select public.refresh_class_schedule(
      'a7000000-0000-4000-8000-000000000001',
      current_date,
      current_date + 56
    )$$,
  'le gérant rafraîchit la série'
);

-- `classes_select` masque les lignes archivées : lire `deleted_at` sous
-- `authenticated` rendrait toujours « rien », ce qui passerait pour un vert.
reset role;

select is(
  (select deleted_at from public.classes where id = (select id from cible)),
  null,
  'l''occurrence qui porte une séance **n''est pas archivée** — troisième protection'
);

select is(
  (select count(*) from public.class_workouts where class_id = (select id from cible))::int,
  1,
  'et la séance est toujours là'
);

-- Le contrôle négatif, sans lequel le précédent ne prouve rien : une occurrence
-- **sans** séance, elle, est bien archivée. Si les deux survivaient, on aurait
-- cassé la réconciliation au lieu de la corriger.
create temporary table temoin as
select id from public.classes
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'
  and schedule_id = 'a7000000-0000-4000-8000-000000000001'
  and booked_count = 0
  and is_override = false
  and deleted_at is null
  and starts_at > now()
  and id <> (select id from cible)
order by starts_at
limit 1;

select cmp_ok(
  (select count(*) from temoin)::int, '=', 1,
  'un témoin sans séance existe'
);

-- On le fait disparaître de la série en déplaçant l'horaire : la
-- rematérialisation ne le recrée pas à l'identique, donc l'ancien est archivé.
update public.class_schedules
set starts_at_local = '19:45'
where id = 'a7000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select lives_ok(
  $$select public.refresh_class_schedule(
      'a7000000-0000-4000-8000-000000000001',
      current_date,
      current_date + 56
    )$$,
  'la série change d''horaire'
);

reset role;

select isnt(
  (select deleted_at from public.classes where id = (select id from temoin)),
  null,
  'le témoin sans séance est archivé — la réconciliation fait toujours son travail'
);

select is(
  (select deleted_at from public.classes where id = (select id from cible)),
  null,
  'et celle qui porte la séance survit même à un changement d''horaire'
);

-- ---------------------------------------------------------------------------
-- 6. La sœur du geste : **supprimer** la série, ce n'est pas la corriger
-- ---------------------------------------------------------------------------
--
-- Trouvée par `spec-keeper` après coup, et c'est la règle des sœurs : le ticket
-- n'avait raisonné que sur « le gérant corrige l'horaire ». **`archiveSchedule()`
-- passe par la même fonction**, et sans borne la protection aurait laissé
-- derrière une série supprimée des occurrences `SCHEDULED`, **réservables**, sans
-- série derrière. Un fantôme qu'un membre aurait pu réserver.

-- Le vrai geste de `archiveSchedule()` : la série est archivée **puis** la
-- réconciliation est rejouée. L'archivage se pose ici sous `postgres` — c'est du
-- décor, et le droit de l'action est déjà éprouvé ailleurs ; ce qui nous
-- intéresse est ce que la réconciliation fait **ensuite**.
update public.class_schedules
set deleted_at = now()
where id = 'a7000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select lives_ok(
  $$select public.refresh_class_schedule(
      'a7000000-0000-4000-8000-000000000001',
      current_date,
      current_date + 56
    )$$,
  'le gérant supprime la série'
);

reset role;

select isnt(
  (select deleted_at from public.classes where id = (select id from cible)),
  null,
  'la série supprimée emporte **aussi** l''occurrence qui portait une séance — pas de cours fantôme'
);

-- ---------------------------------------------------------------------------
-- 7. Effacer sa séance — le geste 7 de la passe, rouge le 9 septembre 2026
-- ---------------------------------------------------------------------------
--
-- Le coach vide le champ, confirme, et l'écran répondait « une erreur est
-- survenue » : `update … set deleted_at` était refusé par **la policy de
-- lecture**. Sur PostgreSQL 17, la ligne mise à jour doit rester visible de
-- celui qui la met à jour ; `deleted_at is null` pour tout le monde dans
-- `class_workouts_select` rendait l'archivage impossible à quiconque n'est pas
-- `security definer`. Mesuré sur le moteur du produit, pas déduit d'une doc —
-- et la sœur exacte vivait dans `class_schedules_select` depuis P1-002
-- (`database.md`, piège 13).
--
-- **Sous l'identité du coach, et sur un update nu** : c'est le chemin de
-- `saveWorkout()`, pas celui d'une fonction qui contournerait la RLS. Joué sous
-- `postgres`, ce test serait vert avec la policy d'avant.
reset role;

create temporary table autre as
select id
from public.classes
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'
  and deleted_at is null
  and status = 'SCHEDULED'
  and starts_at > now()
  and schedule_id is distinct from 'a7000000-0000-4000-8000-000000000001'
order by starts_at
limit 1;

-- Une table temporaire créée sous `postgres` n'est pas lisible sous
-- `authenticated` : sans ce grant, la section meurt sur « permission denied »
-- avant sa première assertion — et un plan de 30 pour 27 joués.
grant select on autre to authenticated;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"44444444-0000-4000-8000-000000000001","role":"authenticated","email":"sarah@example.com"}';

insert into public.class_workouts (tenant_id, class_id, body, published_at)
values ('aaaaaaaa-0000-4000-8000-000000000001', (select id from autre), 'À effacer', now());

select lives_ok(
  $$update public.class_workouts set deleted_at = now()
    where class_id = (select id from autre) and deleted_at is null$$,
  'le coach efface sa séance — sous son identité, par un update, comme l''écran le fait'
);

set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select is(
  (select count(*) from public.class_workouts where class_id = (select id from autre))::int,
  0,
  'effacée, elle n''existe plus pour un membre — même publiée'
);

set local request.jwt.claims =
  '{"sub":"44444444-0000-4000-8000-000000000001","role":"authenticated","email":"sarah@example.com"}';

select lives_ok(
  $$insert into public.class_workouts (tenant_id, class_id, body)
    values ('aaaaaaaa-0000-4000-8000-000000000001', (select id from autre), 'La suivante')$$,
  'et il en écrit une nouvelle sur la même occurrence : l''unicité ne compte que les vivantes'
);

reset role;

select * from finish();
rollback;
