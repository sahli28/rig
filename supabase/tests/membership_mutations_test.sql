-- Mutations de `memberships` et journal d'audit.
--
-- `memberships` n'ayant aucune policy d'écriture, tout passe par des fonctions
-- `security definer`. Ce sont elles qui portent la matrice de permissions : si
-- une garde manque ici, elle ne manque nulle part ailleurs — il n'y a pas de
-- second rempart.

begin;
select plan(16);

-- ---------------------------------------------------------------------------
-- L'écriture directe est fermée, quel que soit le rôle
-- ---------------------------------------------------------------------------

-- Marc est OWNER de la box A : même lui ne peut pas écrire en direct.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

-- Le refus a changé de couche avec D-006. `memberships` n'a jamais eu de policy
-- d'écriture — l'ordre passait donc sans rien affecter, et c'était la valeur
-- inchangée qui prouvait la garde. La table n'accorde plus que `select` :
-- l'ordre lève avant d'atteindre la policy, qui reste derrière en seconde
-- couche. Deux protections au lieu d'une, et un échec bruyant au lieu d'un
-- succès trompeur — un client buggé croyait avoir écrit.
select throws_ok(
  $$update public.memberships set role = 'MEMBER'
    where id = 'a3000000-0000-4000-8000-000000000002'$$,
  '42501',
  null,
  'même un OWNER ne modifie pas une appartenance en direct'
);

-- Le scénario qui a motivé la fermeture : réécrire `user_id` d'une ligne OWNER
-- pour évincer le propriétaire et greffer un tiers.
select throws_ok(
  $$update public.memberships set user_id = '55555555-0000-4000-8000-000000000001'
    where id = 'a3000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'user_id d''une appartenance est intouchable par UPDATE direct'
);

select is(
  (select user_id::text from public.memberships where id = 'a3000000-0000-4000-8000-000000000001'),
  '11111111-0000-4000-8000-000000000001',
  'et le propriétaire est toujours en place'
);

reset role;

-- ---------------------------------------------------------------------------
-- set_member_role()
-- ---------------------------------------------------------------------------

-- Léa, simple MEMBER de la box A.
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select throws_ok(
  $$select public.set_member_role('a3000000-0000-4000-8000-000000000002', 'OWNER')$$,
  '42501',
  null,
  'un MEMBER ne peut pas changer de rôle'
);

reset role;

-- Marc, OWNER de la box A.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select lives_ok(
  $$select public.set_member_role('a3000000-0000-4000-8000-000000000002', 'COACH')$$,
  'un OWNER promeut un membre en COACH'
);

select is(
  (select role::text from public.memberships where id = 'a3000000-0000-4000-8000-000000000002'),
  'COACH',
  'le changement est appliqué'
);

select throws_ok(
  $$select public.set_member_role('a3000000-0000-4000-8000-000000000001', 'MEMBER')$$,
  '23514',
  null,
  'le dernier propriétaire de la box ne peut pas être rétrogradé'
);

select throws_ok(
  $$select public.set_member_role('b3000000-0000-4000-8000-000000000002', 'COACH')$$,
  '42501',
  null,
  'un OWNER de la box A ne touche pas aux appartenances de la box B'
);

-- On installe un MANAGER pour éprouver ses bornes.
select public.set_member_role('a3000000-0000-4000-8000-000000000003', 'MANAGER');
reset role;

-- Sarah, désormais MANAGER de la box A.
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-0000-4000-8000-000000000001","role":"authenticated","email":"sarah@example.com"}';

select throws_ok(
  $$select public.set_member_role('a3000000-0000-4000-8000-000000000002', 'OWNER')$$,
  '42501',
  null,
  'un MANAGER ne peut pas fabriquer un OWNER'
);

select throws_ok(
  $$select public.set_member_role('a3000000-0000-4000-8000-000000000003', 'OWNER')$$,
  '42501',
  null,
  'un MANAGER ne peut pas se promouvoir lui-même'
);

select throws_ok(
  $$select public.set_member_role('a3000000-0000-4000-8000-000000000001', 'MEMBER')$$,
  '42501',
  null,
  'un MANAGER ne peut pas rétrograder un OWNER'
);

reset role;

-- ---------------------------------------------------------------------------
-- remove_member() et leave_tenant()
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select lives_ok(
  $$select public.remove_member('a3000000-0000-4000-8000-000000000004')$$,
  'un OWNER retire un membre'
);

-- Suppression **logique** : la ligne demeure, son statut change (règle 10).
-- Et `REMOVED`, pas `LEFT` : les deux états doivent rester distincts, sinon
-- l'exclusion s'annule d'un scan du QR d'affiliation.
select is(
  (select status::text from public.memberships where id = 'a3000000-0000-4000-8000-000000000004'),
  'REMOVED',
  'le retrait est logique et distinct d''un départ volontaire'
);

select throws_ok(
  $$select public.leave_tenant('aaaaaaaa-0000-4000-8000-000000000001')$$,
  '23514',
  null,
  'le dernier propriétaire ne peut pas quitter sa box sans la transmettre'
);

reset role;

-- ---------------------------------------------------------------------------
-- log_audit() — seule voie d'écriture du journal
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select lives_ok(
  $$select public.log_audit('aaaaaaaa-0000-4000-8000-000000000001', 'test.action', 'membership')$$,
  'un membre journalise une action dans sa box'
);

select throws_ok(
  $$select public.log_audit('bbbbbbbb-0000-4000-8000-000000000001', 'test.action', 'membership')$$,
  '42501',
  null,
  'journaliser dans une box dont on n''est pas membre est refusé'
);

reset role;

select * from finish();
rollback;
