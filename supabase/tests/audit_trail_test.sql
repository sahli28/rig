-- Le journal d'audit : ce qui y entre, qui y est enregistré, et ce qui ne doit
-- jamais s'y trouver.
--
-- `log_audit()` existait depuis P0-004 sans aucun appelant. Ce fichier est la
-- preuve que les six mutations d'appartenance l'appellent désormais, et surtout
-- **qu'elles y écrivent la bonne chose** : `audit_logs` est append-only, une
-- erreur y est définitive.

begin;
select plan(18);

-- Un arrivant tout neuf, destinataire de l'invitation nominative du seed.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '99999999-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'nouveau@example.com', '',
  now(), now(), now(), '{}', '{}', false, '', '', '', ''
);

-- ---------------------------------------------------------------------------
-- Marc — OWNER de Rueil
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select lives_ok(
  $$select public.set_member_role('a3000000-0000-4000-8000-000000000002', 'COACH')$$,
  'un OWNER change le rôle d''un membre'
);

-- **L'acteur enregistré est l'appelant.** `log_audit()` le déduit d'`auth.uid()`
-- et se fait appeler depuis une fonction `security definer` : ça marche parce
-- qu'`auth.uid()` lit le claim de session et non le rôle courant — mais c'est
-- exactement ce qui enregistrerait silencieusement le mauvais acteur si ça
-- changeait un jour.
select is(
  (select actor_membership_id from public.audit_logs
   where action = 'membership.role_changed' order by id desc limit 1),
  'a3000000-0000-4000-8000-000000000001'::uuid,
  'l''entrée porte l''appartenance de Marc, pas celle de la cible'
);

select is(
  (select diff ->> 'from' from public.audit_logs
   where action = 'membership.role_changed' order by id desc limit 1),
  'MEMBER',
  'le diff porte le rôle d''avant'
);

select is(
  (select diff ->> 'to' from public.audit_logs
   where action = 'membership.role_changed' order by id desc limit 1),
  'COACH',
  '…et celui d''après'
);

select lives_ok(
  $$select public.remove_member('a3000000-0000-4000-8000-000000000004')$$,
  'un OWNER retire un membre'
);

select is(
  (select diff ->> 'previous_role' from public.audit_logs
   where action = 'membership.removed' order by id desc limit 1),
  'MEMBER',
  'le retrait consigne le rôle qu''avait la personne'
);

select is(
  (select diff ->> 'previous_status' from public.audit_logs
   where action = 'membership.removed' order by id desc limit 1),
  'ACTIVE',
  '…et le statut qu''elle avait — un retrait n''est pas un départ'
);

select lives_ok(
  $$select public.create_invitation(
      'aaaaaaaa-0000-4000-8000-000000000001', 'coach@example.com', 'COACH')$$,
  'un OWNER émet une invitation nominative'
);

select is(
  (select diff ->> 'nominative' from public.audit_logs
   where action = 'invitation.created' order by id desc limit 1),
  'true',
  'un booléen distingue l''invitation nominative du QR mural — sans l''adresse'
);

select lives_ok(
  $$select public.create_tenant('CrossFit Audit', 'crossfit-audit')$$,
  'un OWNER crée une seconde box'
);

select is(
  (select diff ->> 'slug' from public.audit_logs
   where action = 'tenant.created' order by id desc limit 1),
  'crossfit-audit',
  'la création de box est tracée dans la box créée'
);

-- ---------------------------------------------------------------------------
-- L'arrivant — accept_invitation journalise APRÈS l'appartenance
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"99999999-0000-4000-8000-000000000001","role":"authenticated","email":"nouveau@example.com"}';

select lives_ok(
  $$select public.accept_invitation('inv-rueil-0001')$$,
  'une invitation s''accepte'
);

-- ---------------------------------------------------------------------------
-- Léa quitte la box — le cas où l'ordre est une question de correction
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select lives_ok(
  $$select public.leave_tenant('aaaaaaaa-0000-4000-8000-000000000001')$$,
  'un membre quitte sa box'
);

-- ---------------------------------------------------------------------------
-- Les deux contrôles négatifs
--
-- `audit_logs` est append-only : ce qui y entre par erreur ne s'en retire pas.
-- Ces deux assertions valent plus que toutes les précédentes réunies.
-- ---------------------------------------------------------------------------

-- Les lectures qui suivent se font **hors session applicative**. Ce n'est pas
-- un contournement : sous la session de l'arrivant ou de Léa — des MEMBER —
-- `audit_logs_owner_select` ne rend aucune ligne, et une appartenance `LEFT`
-- sort de `current_tenant_ids()`, donc même sa propre ligne devient invisible.
-- Ce que ces assertions vérifient est ce que la base **a écrit**, pas ce qu'un
-- rôle donné a le droit de lire — les tests de lecture, eux, vivent dans
-- `member_directory_test.sql` et `role_isolation_test.sql`.
reset role;

-- Avant l'insertion de l'appartenance, `log_audit()` aurait refusé : on ne
-- journalise pas dans une box dont on n'est pas membre. C'est sa garantie, et
-- c'est ce qui impose l'ordre dans `accept_invitation()`.
select is(
  (select a.actor_membership_id from public.audit_logs a
   where a.action = 'invitation.accepted' order by a.id desc limit 1),
  (select m.id from public.memberships m
   where m.user_id = '99999999-0000-4000-8000-000000000001'
     and m.tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'l''acteur est l''arrivant lui-même, dont l''appartenance vient d''être créée'
);

select is(
  (select diff ->> 'previous_role' from public.audit_logs
   where action = 'membership.left' order by id desc limit 1),
  'COACH',
  'le départ consigne le rôle qu''avait la personne'
);

-- Le test qui compte vraiment : si la journalisation avait lieu **après** la
-- mise à jour, l'appelant ne serait plus membre actif, `log_audit()` lèverait,
-- et ce départ légitime aurait été annulé avec elle.
select is(
  (select status::text from public.memberships
   where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'
     and user_id = '33333333-0000-4000-8000-000000000001'),
  'LEFT',
  'le départ a bien eu lieu : journaliser ne l''a pas annulé'
);

select is(
  (select count(*) from public.audit_logs where diff::text ~ '[0-9a-f]{48}')::int,
  0,
  'aucun jeton d''invitation dans le journal — D-005 les a chassés de la base, ils n''y rentrent pas par cette porte'
);

select is(
  (select count(*) from public.audit_logs where diff::text like '%@%')::int,
  0,
  'aucune adresse e-mail dans le journal (privacy.md : la base ne filtre pas ce contenu)'
);

select * from finish();
rollback;
