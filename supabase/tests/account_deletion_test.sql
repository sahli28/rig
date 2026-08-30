-- Suppression de compte — obligation RGPD, et deux pièges déjà rencontrés.
--
-- 1. Une première version des clés étrangères composites la cassait
--    silencieusement : `on delete set null` **sans liste de colonnes** annule
--    toutes les colonnes de la clé, `tenant_id` compris, qui est `not null`.
-- 2. Elle laissait une box sans propriétaire, donc ingérable à vie — sans que
--    personne l'ait décidé. Le comportement est désormais explicite.

begin;
select plan(10);

-- Marc est le seul propriétaire de la box A, et il a invité et journalisé.
update public.invitations
set invited_by = 'a3000000-0000-4000-8000-000000000001'
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select count(*) from public.memberships
   where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'
     and role = 'OWNER' and status = 'ACTIVE')::int,
  1,
  'la box A n''a qu''un seul propriétaire'
);

-- ---------------------------------------------------------------------------
-- Le propriétaire unique ne peut pas partir en laissant sa box derrière lui
-- ---------------------------------------------------------------------------

select throws_ok(
  $$delete from auth.users where id = '11111111-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'supprimer le compte du propriétaire unique est refusé'
);

-- Ce n'est pas un blocage du droit à l'effacement : c'est une étape préalable
-- que la personne satisfait en transmettant sa box. On le prouve en le faisant.
insert into public.memberships (tenant_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000001', 'OWNER')
on conflict (tenant_id, user_id) do update set role = 'OWNER', status = 'ACTIVE';

select is(
  (select count(*) from public.memberships
   where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'
     and role = 'OWNER' and status = 'ACTIVE')::int,
  2,
  'la propriété a été transmise, la box a deux propriétaires'
);

-- ---------------------------------------------------------------------------
-- Le vrai chemin RGPD : la suppression part de `auth.users` et cascade
-- ---------------------------------------------------------------------------

select lives_ok(
  $$delete from auth.users where id = '11111111-0000-4000-8000-000000000001'$$,
  'supprimer un compte ayant invité et journalisé réussit une fois la box transmise'
);

select is(
  (select count(*) from public.users
   where id = '11111111-0000-4000-8000-000000000001')::int,
  0,
  'la personne disparaît de public.users par cascade'
);

select is(
  (select invited_by from public.invitations
   where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  null,
  'l''invitation survit, son invitant passe à null sans emporter tenant_id'
);

-- Le journal d'audit n'a volontairement aucune FK vers `memberships` : une
-- trace doit survivre à la disparition de son auteur, sinon elle ne prouve rien.
select is(
  (select count(*) from public.audit_logs
   where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int,
  1,
  'l''entrée d''audit survit à la suppression de son auteur'
);

select is(
  (select count(*) from public.memberships
   where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'
     and role = 'OWNER' and status = 'ACTIVE')::int,
  1,
  'la box conserve un propriétaire après la suppression'
);

-- ---------------------------------------------------------------------------
-- La preuve de consentement survit à la suppression du compte
-- ---------------------------------------------------------------------------

-- Rendre `consents` append-only ne sert à rien si le seul chemin de suppression
-- restant — la cascade depuis le compte — détruit quand même la ligne. La box
-- est tenue de conserver cette preuve ; elle n'a donc pas de clé étrangère vers
-- la personne, comme le journal d'audit (piège 5).
insert into public.consents (user_id, tenant_id, purpose, granted, policy_version)
values ('55555555-0000-4000-8000-000000000001',
        'bbbbbbbb-0000-4000-8000-000000000001', 'BOX_TERMS', true, '2026-08-01');

select lives_ok(
  $$delete from auth.users where id = '55555555-0000-4000-8000-000000000001'$$,
  'supprimer le compte d''un membre ayant consenti réussit'
);

select is(
  (select count(*) from public.consents
   where user_id = '55555555-0000-4000-8000-000000000001'
     and tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001')::int,
  2,
  'la box conserve la preuve de consentement de son ancien membre'
);

select * from finish();
rollback;
