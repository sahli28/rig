-- `tenant_coaches` — les coachs d'une box, vus par ses membres.
--
-- La vue est en `security_invoker = false` : elle contourne la RLS de `users` et
-- son `WHERE` est **la seule chose** entre un membre et la table entière, tous
-- tenants confondus. Ces tests sont donc le contrôle de ce `WHERE`.
--
-- Ils vérifient les deux sens, et surtout le **négatif** : ce qui ne doit pas
-- sortir par ce chemin. C'est la troisième vue d'exposition d'identité du
-- produit ; la règle qui les gouverne est dans `.claude/rules/privacy.md`.

begin;
select plan(12);

-- ---------------------------------------------------------------------------
-- Léa — simple MEMBER de Rueil. C'est elle l'audience de cette vue.
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select isnt(
  (select count(*) from public.tenant_coaches)::int,
  0,
  'un simple MEMBER lit les coachs de sa box — c''est toute la raison de cette vue'
);

select is(
  (select count(*) from public.tenant_coaches
   where tenant_id <> 'aaaaaaaa-0000-4000-8000-000000000001')::int,
  0,
  'et personne d''une autre box — le WHERE de la vue tient'
);

-- Le prénom, oui. C'est ce que le planning affiche, et ce que le planning au mur
-- affiche déjà.
select is(
  (select first_name from public.tenant_coaches
   where membership_id = 'a3000000-0000-4000-8000-000000000003'),
  'Sarah',
  'le prénom du coach est lisible'
);

-- L'initiale, pas le nom. Une vue qui ne transporte qu'un caractère ne peut pas
-- laisser fuir un patronyme.
select is(
  (select last_initial from public.tenant_coaches
   where membership_id = 'a3000000-0000-4000-8000-000000000003'),
  'D',
  'le nom est réduit à son initiale'
);

select is(
  (select count(*) from public.tenant_coaches
   where length(last_initial) > 1)::int,
  0,
  'aucune ligne ne porte plus d''un caractère de nom'
);

-- ---------------------------------------------------------------------------
-- Les contrôles négatifs : ce qui ne doit **pas** sortir par ce chemin
-- ---------------------------------------------------------------------------

-- La colonne n'existe pas, et c'est mieux qu'une colonne vide : ce qui n'est pas
-- dans la vue ne peut pas y revenir par un `select *` distrait.
select hasnt_column(
  'public', 'tenant_coaches', 'email',
  'aucune adresse e-mail ne sort par l''annuaire des coachs'
);

select hasnt_column(
  'public', 'tenant_coaches', 'last_name',
  'le nom complet n''est pas exposé'
);

select hasnt_column(
  'public', 'tenant_coaches', 'birthdate',
  'la date de naissance n''est pas exposée'
);

-- Un simple membre n'anime rien : il n'a pas à figurer dans l'annuaire des
-- coachs de sa propre box.
select is(
  (select count(*) from public.tenant_coaches
   where membership_id = 'a3000000-0000-4000-8000-000000000002')::int,
  0,
  'un simple MEMBER n''apparaît pas comme coach'
);

-- ---------------------------------------------------------------------------
-- Thomas — MEMBER de Nanterre. La preuve dans l'autre sens.
-- ---------------------------------------------------------------------------

set local request.jwt.claims =
  '{"sub":"55555555-0000-4000-8000-000000000001","role":"authenticated","email":"thomas@example.com"}';

select is(
  (select count(*) from public.tenant_coaches
   where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int,
  0,
  'un membre de Nanterre ne lit aucun coach de Rueil'
);

select isnt(
  (select count(*) from public.tenant_coaches
   where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001')::int,
  0,
  'et lit bien les siens — un test d''isolation qui rend zéro des deux côtés ne prouve rien'
);

-- ---------------------------------------------------------------------------
-- Anonyme : la vue n'est pas une porte publique
-- ---------------------------------------------------------------------------

reset role;
set local role anon;

-- `throws_ok` et non « rend zéro ligne » : la première version de ce test
-- attendait un compte nul et a échoué sur `permission denied`. C'était le bon
-- comportement mal formulé — `anon` n'a **aucun** grant sur cette vue, donc il
-- ne lit pas zéro ligne, il ne lit rien du tout. Un refus au niveau du droit est
-- plus fort qu'un filtre qui rend vide, et le test doit dire lequel des deux
-- protège.
select throws_ok(
  'select count(*) from public.tenant_coaches',
  '42501',
  null,
  'un visiteur anonyme n''a aucun droit sur l''annuaire des coachs'
);

reset role;
select * from finish();
rollback;
