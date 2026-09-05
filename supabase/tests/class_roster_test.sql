-- `class_roster` — les inscrits d'un cours, vus par un autre inscrit.
--
-- **Quatrième vue d'exposition d'identité**, et la première dont la base
-- juridique n'est pas l'exécution d'un contrat : intérêt légitime, avec
-- opposition. Comme ses sœurs, elle est en `security_invoker = false`, donc son
-- `WHERE` est **la seule chose** entre un membre et la table `users` entière.
-- Ces tests sont le contrôle de ce `WHERE`.
--
-- Deux propriétés lui sont propres, et ce sont elles qui distinguent une feuille
-- d'inscrits d'un annuaire :
--
--   1. **il faut être inscrit au cours pour voir qui l'est.** « Les gens que je
--      croise », pas « toute la box » (D-001, décision 1) ;
--   2. **l'opposition retire la ligne**, elle ne la vide pas.

begin;
select plan(20);

-- ---------------------------------------------------------------------------
-- Décor : un cours de Rueil, deux inscrites, un coach qui ne l'est pas
-- ---------------------------------------------------------------------------

insert into public.class_schedules (
  id, tenant_id, class_type_id, room_id, coach_membership_id,
  starts_on, starts_at_local, rrule, capacity
) values (
  'd1000000-0000-4000-8000-000000000001',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000003',
  current_date, '17:15', 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU', 20
);

select public.materialize_class_occurrences(
  current_date, current_date + 14, 'd1000000-0000-4000-8000-000000000001'
);

create temporary table cible as
select id
from public.classes
where schedule_id = 'd1000000-0000-4000-8000-000000000001'
  and starts_at > now() + interval '1 hour'
order by starts_at
limit 1;

grant select on cible to authenticated;

-- Léa et Julie s'inscrivent. Les réservations sont posées directement : ce
-- fichier teste la **vue**, pas `book_class()`, qui a le sien.
insert into public.bookings (tenant_id, class_id, membership_id, idempotency_key)
select 'aaaaaaaa-0000-4000-8000-000000000001', c.id, m.id, 'roster-' || m.id::text
from cible c
cross join (values
  ('a3000000-0000-4000-8000-000000000002'::uuid),  -- Léa, MEMBER
  ('a3000000-0000-4000-8000-000000000004'::uuid)   -- Julie, MEMBER
) as m(id);

-- ---------------------------------------------------------------------------
-- 1. La forme, et ce qui n'y est pas
-- ---------------------------------------------------------------------------

select has_view('public', 'class_roster', 'la feuille d''inscrits existe');

select has_column(
  'public', 'memberships', 'hidden_from_roster',
  'l''opposition vit sur l''appartenance, donc par box'
);

-- Ce qui n'est pas dans la vue ne peut pas y revenir par un `select *` distrait.
select hasnt_column(
  'public', 'class_roster', 'email',
  'aucune adresse e-mail ne sort par la feuille d''inscrits'
);

select hasnt_column(
  'public', 'class_roster', 'last_name',
  'le nom complet n''est pas exposé'
);

-- ---------------------------------------------------------------------------
-- 2. Léa, inscrite : elle voit ses pairs
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select is(
  (select count(*) from public.class_roster
   where class_id = (select id from cible))::int,
  2,
  'une inscrite voit les deux inscrites du cours, elle comprise'
);

select is(
  (select first_name from public.class_roster
   where membership_id = 'a3000000-0000-4000-8000-000000000004'),
  'Julie',
  'le prénom d''un pair est lisible'
);

select is(
  (select last_initial from public.class_roster
   where membership_id = 'a3000000-0000-4000-8000-000000000004'),
  'K',
  'son nom est réduit à son initiale'
);

select is(
  (select count(*) from public.class_roster where length(last_initial) > 1)::int,
  0,
  'aucune ligne ne porte plus d''un caractère de nom'
);

-- ---------------------------------------------------------------------------
-- 3. Le contrôle qui fait la différence avec un annuaire
-- ---------------------------------------------------------------------------

-- Sarah **coache** ce cours et n'y est pas inscrite. Elle ne voit donc rien par
-- ce chemin : la feuille de présence d'un coach est une **quatrième audience**,
-- avec ses propres raisons, et elle n'existe pas encore. Ce test est la preuve
-- qu'on ne la lui a pas donnée par accident.
set local request.jwt.claims =
  '{"sub":"44444444-0000-4000-8000-000000000001","role":"authenticated","email":"sarah@example.com"}';

select is(
  (select count(*) from public.class_roster
   where class_id = (select id from cible))::int,
  0,
  'le coach du cours ne voit pas la feuille : il n''y est pas inscrit'
);

-- Hugo est membre de la même box et inscrit à **un autre** cours (fixture du
-- seed). Il ne voit donc pas celui-ci : la vue n'est pas « tous les inscrits de
-- ma box », c'est « les inscrits des cours où je suis ».
set local request.jwt.claims =
  '{"sub":"77777777-0000-4000-8000-000000000001","role":"authenticated","email":"hugo@example.com"}';

select is(
  (select count(*) from public.class_roster
   where class_id = (select id from cible))::int,
  0,
  'un membre de la box non inscrit à ce cours ne voit pas sa feuille'
);

-- ---------------------------------------------------------------------------
-- 4. L'isolation, dans les deux sens
-- ---------------------------------------------------------------------------

set local request.jwt.claims =
  '{"sub":"55555555-0000-4000-8000-000000000001","role":"authenticated","email":"thomas@example.com"}';

select is(
  (select count(*) from public.class_roster)::int,
  0,
  'un membre de Nanterre ne lit aucune feuille de Rueil'
);

-- ---------------------------------------------------------------------------
-- 5. L'opposition — elle retire la ligne, et elle ne s'exerce que sur soi
-- ---------------------------------------------------------------------------

set local request.jwt.claims =
  '{"sub":"66666666-0000-4000-8000-000000000001","role":"authenticated","email":"julie@example.com"}';

select lives_ok(
  $$select public.set_roster_visibility(
      'aaaaaaaa-0000-4000-8000-000000000001', true
    )$$,
  'un membre peut s''opposer à figurer dans la feuille de sa box'
);

-- Julie est membre des deux boxes ; Thomas n'est membre que de Nanterre. Une
-- fonction qui accepterait un `tenant_id` quelconque laisserait modifier
-- l'appartenance d'autrui — c'est la règle 2, prise par son côté écriture.
set local request.jwt.claims =
  '{"sub":"55555555-0000-4000-8000-000000000001","role":"authenticated","email":"thomas@example.com"}';

select throws_ok(
  $$select public.set_roster_visibility(
      'aaaaaaaa-0000-4000-8000-000000000001', true
    )$$,
  '42501', null,
  'on ne s''oppose que dans une box dont on est membre'
);

set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select is(
  (select count(*) from public.class_roster
   where class_id = (select id from cible))::int,
  1,
  'après opposition, Julie a disparu de la feuille — et Léa s''y voit toujours'
);

select is(
  (select count(*) from public.class_roster
   where membership_id = 'a3000000-0000-4000-8000-000000000004')::int,
  0,
  'aucune ligne fantôme : l''opposition retire, elle ne vide pas'
);

-- ---------------------------------------------------------------------------
-- 5 bis. La sœur : l'opposition ne se lit pas non plus par la table brute
-- ---------------------------------------------------------------------------
--
-- **Le test qui manquait, et sans lequel le reste était un faux vert.**
-- `memberships` rend toutes ses colonnes à tout membre du tenant depuis P0-004 ;
-- y ajouter une opposition RGPD la rendait lisible par les pairs — c'est-à-dire
-- exactement ce que la vue ci-dessus existe pour empêcher. Trouvé par
-- `rls-auditor`, reproduit à la main, corrigé par un grant de colonne.

select is(
  (select count(*) from public.memberships
   where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int,
  5,
  'un pair lit bien les lignes d''appartenance de sa box — ce n''est pas ça qu''on ferme'
);

select throws_ok(
  $$select hidden_from_roster from public.memberships
    where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', null,
  'mais pas la colonne d''opposition : elle est hors du grant de lecture'
);

-- Et on lit la sienne, par le seul chemin prévu pour ça.
select is(
  public.get_roster_visibility('aaaaaaaa-0000-4000-8000-000000000001'),
  false,
  'chacun lit sa propre opposition, et Léa ne s''est opposée à rien'
);

-- ---------------------------------------------------------------------------
-- 6. La trace, et l'anonyme
-- ---------------------------------------------------------------------------

-- Une opposition sous intérêt légitime n'est pas un consentement, donc elle
-- n'entre pas dans `consents` — mais elle laisse une trace, sinon personne ne
-- peut dire quand elle a été exercée.
reset role;

select is(
  (select count(*) from public.audit_logs
   where action = 'membership.roster_visibility_changed')::int,
  1,
  'la bascule est journalisée — une seule fois, la seconde n''ayant rien changé'
);

set local role anon;

select throws_ok(
  'select count(*) from public.class_roster',
  '42501',
  null,
  'un visiteur anonyme n''a aucun droit sur la feuille d''inscrits'
);

select * from finish();
rollback;
