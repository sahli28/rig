-- Les fonctions `security definer` qui percent volontairement la RLS, et les
-- gardes de rôle sur les deux tables qui portent l'autorisation.
--
-- Ce sont les seules portes du schéma : un défaut ici contourne toute
-- l'isolation, elles méritent donc d'être attaquées plus que le reste. Chacun
-- des scénarios ci-dessous **réussissait** avant l'audit du ticket P0-004.

begin;
select plan(25);

-- Un utilisateur tout neuf, membre d'aucune box.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
) values (
  '00000000-0000-0000-0000-000000000000',
  '99999999-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'nouveau@example.com', '',
  now(), now(), now(), '{}', '{}', false
);
-- Pas d'insertion dans `public.users` : c'est le trigger `on_auth_user_created`
-- qui doit l'avoir fait. Le vérifier ici, c'est tester le parcours d'inscription
-- réel — celui que les tests court-circuitaient jusqu'à présent, ce qui masquait
-- son impossibilité.
select is(
  (select email::text from public.users where id = '99999999-0000-4000-8000-000000000001'),
  'nouveau@example.com',
  'l''inscription crée automatiquement la fiche utilisateur'
);

-- ---------------------------------------------------------------------------
-- create_tenant()
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-0000-4000-8000-000000000001","role":"authenticated","email":"nouveau@example.com"}';

select is(
  (select count(*) from public.tenants)::int,
  0,
  'un utilisateur sans appartenance ne voit aucune box'
);

select lives_ok(
  $$select public.create_tenant('CrossFit Test', 'crossfit-test')$$,
  'create_tenant() réussit pour un utilisateur sans appartenance'
);

select is(
  (select count(*) from public.tenants)::int,
  1,
  'la box créée devient immédiatement visible à son créateur'
);

select is(
  (select role::text from public.memberships
   where user_id = '99999999-0000-4000-8000-000000000001'),
  'OWNER',
  'le créateur est installé comme OWNER'
);

select is(
  (select count(*) from public.tenant_settings)::int,
  1,
  'les réglages par défaut sont créés dans la même transaction'
);

select throws_ok(
  $$select public.create_tenant('Mauvais slug', 'Pas Un Slug')$$,
  '23514',
  null,
  'un slug invalide est refusé par la fonction elle-même'
);

select throws_ok(
  $$select public.create_tenant('   ', 'nom-vide')$$,
  '23514',
  null,
  'un nom vide est refusé'
);

reset role;

-- ---------------------------------------------------------------------------
-- accept_invitation() — les trois façons de forcer la porte
-- ---------------------------------------------------------------------------

insert into public.invitations (tenant_id, email, role, token_hash, expires_at) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'nouveau@example.com', 'MEMBER',
   encode(extensions.digest('tok-valide','sha256'),'hex'), now() + interval '7 days'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'nouveau@example.com', 'MEMBER',
   encode(extensions.digest('tok-expire','sha256'),'hex'), now() - interval '1 day'),
  -- Invitation destinée à quelqu'un d'autre : c'est le cas du lien transféré,
  -- capté dans un `Referer` ou pris en capture d'écran.
  ('bbbbbbbb-0000-4000-8000-000000000001', 'quelquun.dautre@example.com', 'MEMBER',
   encode(extensions.digest('tok-autrui','sha256'),'hex'), now() + interval '7 days');

set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-0000-4000-8000-000000000001","role":"authenticated","email":"nouveau@example.com"}';

select throws_ok(
  $$select public.accept_invitation('tok-expire')$$,
  '23514',
  null,
  'une invitation expirée est refusée'
);

select throws_ok(
  $$select public.accept_invitation('tok-inexistant')$$,
  'P0002',
  null,
  'un jeton inconnu est refusé'
);

select throws_ok(
  $$select public.accept_invitation('tok-autrui')$$,
  '42501',
  null,
  'une invitation nominative adressée à quelqu''un d''autre est refusée'
);

-- La parade évidente : se donner l'adresse de l'invité, puis réutiliser le
-- jeton capté. Elle fonctionnait tant que le contrôle comparait à
-- `public.users.email` — une colonne que l'utilisateur écrit lui-même.
select throws_ok(
  $$update public.users set email = 'quelquun.dautre@example.com'
    where id = '99999999-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'usurper l''adresse d''un invité est refusé : l''e-mail n''est pas modifiable ici'
);

select lives_ok(
  $$select public.accept_invitation('tok-valide')$$,
  'une invitation valide crée l''appartenance'
);

reset role;

reset role;

-- Le cas réel : une adhérente devient coach, la box lui envoie une invitation
-- nominative COACH. Sans refus explicite, elle cliquait, voyait « bienvenue »,
-- restait MEMBER, et le jeton était brûlé — un succès silencieux.
insert into public.invitations (tenant_id, email, role, token_hash, expires_at) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'nouveau@example.com', 'COACH',
   encode(extensions.digest('tok-promotion','sha256'),'hex'), now() + interval '7 days');

set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-0000-4000-8000-000000000001","role":"authenticated","email":"nouveau@example.com"}';

select throws_ok(
  $$select public.accept_invitation('tok-promotion')$$,
  '23505',
  null,
  'accepter une invitation quand on est déjà membre actif lève au lieu de ne rien faire'
);

reset role;

select is(
  (select status::text from public.invitations where token_hash = encode(extensions.digest('tok-promotion','sha256'),'hex')),
  'PENDING',
  'le jeton n''est pas consommé par une acceptation refusée'
);

-- Le gel de l'e-mail ne doit pas interdire la **rectification**, qui est un
-- droit RGPD. Le chemin légitime passe par le fournisseur d'identité, puis se
-- propage. Une première version bloquait tout changement, y compris celui-là.
update auth.users set email = 'nouvelle-adresse@example.com'
where id = '99999999-0000-4000-8000-000000000001';

select is(
  (select email::text from public.users where id = '99999999-0000-4000-8000-000000000001'),
  'nouvelle-adresse@example.com',
  'un changement d''adresse validé chez le fournisseur se propage bien'
);

-- Suspension par la box, puis tentative de réactivation par l'invitation.
update public.memberships set status = 'SUSPENDED'
where user_id = '99999999-0000-4000-8000-000000000001'
  and tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001';

insert into public.invitations (tenant_id, email, role, token_hash, expires_at) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'nouveau@example.com', 'MEMBER',
   encode(extensions.digest('tok-rentrer','sha256'),'hex'), now() + interval '7 days');

set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-0000-4000-8000-000000000001","role":"authenticated","email":"nouveau@example.com"}';

select throws_ok(
  $$select public.accept_invitation('tok-rentrer')$$,
  '42501',
  null,
  'une appartenance suspendue ne se réactive pas par une nouvelle invitation'
);

reset role;

-- ---------------------------------------------------------------------------
-- Élévation de privilège — les deux chemins fermés par l'audit
-- ---------------------------------------------------------------------------

-- Léa est MEMBER de la box A.
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

-- Chemin 1 : se promouvoir directement.
--
-- Le refus a changé de couche avec D-006. Il venait de la policy `using`, qui
-- masquait la ligne : l'UPDATE ne levait pas, il n'affectait rien, et c'était le
-- rôle inchangé qui prouvait la garde. `memberships` n'accorde plus que
-- `select`, donc l'ordre lève désormais avant même d'atteindre la policy — qui
-- reste en place derrière, comme seconde couche.
select throws_ok(
  $$update public.memberships set role = 'OWNER'
    where user_id = '33333333-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'un MEMBER ne peut pas se promouvoir OWNER'
);

-- Chemin 2 : forger une invitation OWNER, à faire accepter par un complice.
--
-- La porte a changé avec D-005 : l'`insert` direct n'existe plus, ni comme
-- policy ni comme droit. Le test vise donc la nouvelle porte, `create_invitation()`,
-- où la même matrice de rôles est rejouée — c'est le même scénario d'attaque, sur
-- le mécanisme qui le reçoit désormais.
select throws_ok(
  $$insert into public.invitations (tenant_id, role, token_hash, expires_at)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'OWNER', 'peu importe',
            now() + interval '7 days')$$,
  '42501',
  null,
  'l''insertion directe d''une invitation est fermée à tous, quel que soit le rôle'
);

select throws_ok(
  $$select public.create_invitation('aaaaaaaa-0000-4000-8000-000000000001', null, 'OWNER')$$,
  '42501',
  null,
  'un MEMBER ne peut pas créer d''invitation, encore moins avec le rôle OWNER'
);

select is(
  (select count(*) from public.invitations)::int,
  0,
  'un MEMBER ne voit même pas les invitations de sa box (elles portent des e-mails)'
);

reset role;

-- Marc est OWNER de la box A : lui, il peut.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select lives_ok(
  $$select public.create_invitation('aaaaaaaa-0000-4000-8000-000000000001',
                                    'coach@example.com', 'COACH')$$,
  'un OWNER crée bien une invitation dans sa box'
);

reset role;

-- ---------------------------------------------------------------------------
-- Une exclusion ne s'annule pas d'un scan de QR
-- ---------------------------------------------------------------------------

-- Le QR d'affiliation affiché au mur d'une box est une invitation **sans
-- e-mail**, `PENDING` en permanence. S'il pouvait réactiver une exclusion,
-- `remove_member()` n'aurait aucun effet dans la configuration normale d'une box.
insert into public.invitations (tenant_id, email, role, token_hash, expires_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', null, 'MEMBER',
   encode(extensions.digest('qr-mural-a', 'sha256'), 'hex'),
   now() + interval '365 days');

-- Marc exclut Léa.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';
select public.remove_member('a3000000-0000-4000-8000-000000000002');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select throws_ok(
  $$select public.accept_invitation('qr-mural-a')$$,
  '42501',
  null,
  'une personne exclue ne revient pas en scannant le QR d''affiliation'
);

reset role;

-- En revanche la box peut la réinviter nommément : c'est un geste délibéré.
insert into public.invitations (tenant_id, email, role, token_hash, expires_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'lea@example.com', 'MEMBER', encode(extensions.digest('tok-retour','sha256'),'hex'),
   now() + interval '7 days');

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select lives_ok(
  $$select public.accept_invitation('tok-retour')$$,
  'une réinvitation nominative permet le retour après exclusion'
);

reset role;

select is(
  (select status::text from public.memberships
   where id = 'a3000000-0000-4000-8000-000000000002'),
  'ACTIVE',
  'l''appartenance est réactivée'
);

select * from finish();
rollback;
