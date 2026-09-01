-- `member_admin_directory` — l'annuaire administratif d'une box.
--
-- La vue est en `security_invoker = false` : elle contourne la RLS de `users` et
-- son `WHERE` est **la seule chose** entre un membre et la table entière, tous
-- tenants confondus. Ces tests sont donc le contrôle de ce `WHERE`, pas un
-- confort.
--
-- Ils vérifient les deux sens, comme le demandent les critères de D-001 : ce que
-- l'annuaire montre à qui de droit, et ce qu'il refuse à tous les autres — y
-- compris au COACH, dont l'exclusion est un choix et non un oubli.

begin;
select plan(14);

-- ---------------------------------------------------------------------------
-- Marc — OWNER de la box A (Rueil)
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select is(
  (select count(*) from public.member_admin_directory)::int,
  5,
  'un OWNER voit les cinq appartenances de sa box, tous rôles et statuts confondus'
);

select is(
  (select count(*) from public.member_admin_directory
   where tenant_id <> 'aaaaaaaa-0000-4000-8000-000000000001')::int,
  0,
  'et rien d''une autre box — le WHERE de la vue tient'
);

-- L'e-mail est la raison d'être de cette vue-ci plutôt que de la vue des pairs :
-- l'OWNER est responsable de traitement, la spec §5.2 lui accorde l'export des
-- données membres, et l'import CSV de P1-001 en dépend.
select is(
  (select email from public.member_admin_directory
   where user_id = '33333333-0000-4000-8000-000000000001'),
  'lea@example.com',
  'un OWNER lit l''e-mail de ses membres'
);

-- ---------------------------------------------------------------------------
-- Hugo — MANAGER de la même box
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"77777777-0000-4000-8000-000000000001","role":"authenticated","email":"hugo@rueil.example"}';

select is(
  (select count(*) from public.member_admin_directory)::int,
  5,
  'un MANAGER voit le même annuaire : Staff & Roles est son écran'
);

-- Hugo administre Rueil et n'est que **membre** de Nanterre. C'est la seule
-- fixture où « autorisé quelque part » et « autorisé ici » divergent dans une
-- même requête — et donc le seul cas qui distingue `current_admin_tenant_ids()`
-- de `current_tenant_ids()`. Chez Marc (propriétaire d'une seule box) et chez
-- Julie (membre des deux, sans rôle), appartenance et rôle coïncident.
select is(
  (select count(*) from public.tenants)::int,
  2,
  'Hugo appartient bien aux deux boxes — sans quoi l''assertion suivante serait vide de sens'
);

select is(
  (select count(*) from public.member_admin_directory
   where tenant_id <> 'aaaaaaaa-0000-4000-8000-000000000001')::int,
  0,
  'mais il ne voit aucun membre de la box où il n''est que membre'
);

-- ---------------------------------------------------------------------------
-- Sarah — COACH de la même box
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"44444444-0000-4000-8000-000000000001","role":"authenticated","email":"sarah@example.com"}';

-- Le refus est le comportement voulu, pas une lacune. Un coach a besoin de noms
-- sur *sa feuille de cours* — ce qui arrive avec `bookings` en P1-003, et ce qui
-- justifiera son accès à ce moment-là. L'annuaire complet de la box, non.
select is(
  (select count(*) from public.member_admin_directory)::int,
  0,
  'un COACH ne voit rien : son besoin est la feuille de cours, pas l''annuaire'
);

-- ---------------------------------------------------------------------------
-- Léa — simple MEMBER de la box A
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select is(
  (select count(*) from public.member_admin_directory)::int,
  0,
  'un MEMBER ne voit rien de l''annuaire'
);

-- Le critère de D-001 dit « par aucun chemin » : la vue est un chemin, l'accès
-- direct en est un autre, et c'est celui-là qui existait avant.
select is(
  (select count(*) from public.users)::int,
  1,
  'et ne récupère l''e-mail d''un autre par aucun chemin : users ne rend qu''elle-même'
);

-- ---------------------------------------------------------------------------
-- Julie — MEMBER des DEUX boxes
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"66666666-0000-4000-8000-000000000001","role":"authenticated","email":"julie@example.com"}';

-- Le cas qui distingue « appartenance » de « rôle » : Julie appartient à deux
-- boxes, ce qui la ferait passer par `current_tenant_ids()` et par la policy
-- qu'on vient de corriger sur `ledger_entries`. Elle n'administre ni l'une ni
-- l'autre.
select is(
  (select count(*) from public.member_admin_directory)::int,
  0,
  'une double appartenance sans rôle d''administration ne donne accès à rien'
);

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------

set local role anon;

select throws_ok(
  'select count(*) from public.member_admin_directory',
  '42501',
  null,
  'anon ne peut pas lire l''annuaire : le grant s''arrête à authenticated'
);

-- ---------------------------------------------------------------------------
-- La vue ne s'écrit pas
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

-- Une vue jointe n'est pas auto-modifiable, et le grant s'arrête à `select` :
-- deux raisons plutôt qu'une, ce qui est voulu.
select throws_ok(
  $$update public.member_admin_directory set email = 'pirate@example.com'$$,
  null,
  null,
  'la vue ne s''écrit pas — ni par défaut de privilège, ni par nature'
);

-- ---------------------------------------------------------------------------
-- Comptes anonymisés
-- ---------------------------------------------------------------------------

reset role;
update public.users set deleted_at = now()
where id = '66666666-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

-- La RLS de `users` étant contournée, son filtre habituel ne s'applique pas :
-- le `deleted_at is null` de la vue est le seul. S'il tombait, une suppression
-- RGPD laisserait la personne visible dans l'annuaire de sa box.
select is(
  (select count(*) from public.member_admin_directory)::int,
  4,
  'un compte anonymisé disparaît de l''annuaire'
);

-- ---------------------------------------------------------------------------
-- La policy de `users` n'a pas bougé
-- ---------------------------------------------------------------------------

reset role;

-- Critère d'acceptation de D-001, encodé plutôt qu'espéré : la vue existe
-- précisément pour qu'on n'ait jamais à élargir cette policy. Si une policy de
-- `users` se met un jour à raisonner en tenant, c'est que quelqu'un a pris le
-- raccourci que ce ticket a refusé.
select is(
  (select count(*) from pg_policies
   where schemaname = 'public' and tablename = 'users'
     and (qual like '%current_tenant_ids%' or qual like '%tenant_id%'))::int,
  0,
  'aucune policy de users ne raisonne en tenant : elle reste id = auth.uid()'
);

select * from finish();
rollback;
