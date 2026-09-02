-- L'import d'un effectif, et la porte d'entrée sans jeton qu'il ouvre.
--
-- Deux choses se testent ici, et la seconde est la plus délicate :
--
--   1. l'import est **une transaction** — une ligne illisible et rien n'existe ;
--   2. `accept_pending_invitation()` est une **deuxième porte vers
--      `memberships`**, et elle doit refuser exactement ce que
--      `accept_invitation()` refuse. Les deux passent par `claim_invitation()`,
--      et ces tests sont ce qui prouve qu'aucun contrôle ne s'est perdu en route.

begin;
select plan(23);

-- ---------------------------------------------------------------------------
-- Marc importe un effectif
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select is(
  (select public.import_members(
     'aaaaaaaa-0000-4000-8000-000000000001',
     '[{"email":"anna@import.example","first_name":"Anna","last_name":"Roux"},
       {"email":"BRUNO@import.example","first_name":"Bruno","role":"COACH"},
       {"email":" chloe@import.example ","first_name":"Chloé"}]'::jsonb
   ) ->> 'created')::int,
  3,
  'trois lignes, trois invitations'
);

-- Adresses normalisées : un export de tableur mélange les casses et laisse des
-- espaces. Sans normalisation, le dédoublonnage du réimport ne verrait rien.
select is(
  (select count(*)::int from public.invitations
   where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'
     and email::text in ('anna@import.example', 'bruno@import.example', 'chloe@import.example')),
  3,
  'les adresses sont normalisées, casse et espaces compris'
);

select is(
  (select role::text from public.invitations where email::text = 'bruno@import.example'),
  'COACH',
  'le rôle de la ligne est respecté'
);

-- 90 jours et pas 30 : sur un effectif entier, celles et ceux qui ne se
-- connectent pas dans le mois seraient bloqués sans que la box le sache.
select ok(
  (select expires_at from public.invitations where email::text = 'anna@import.example')
    > now() + interval '80 days',
  'un import expire à 90 jours, pas à 30'
);

select is(
  (select first_name from public.invitations where email::text = 'chloe@import.example'),
  'Chloé',
  'le prénom voyage avec l''invitation — une box importe un effectif, pas une liste d''adresses'
);

-- ---------------------------------------------------------------------------
-- Réimporter est le cas normal, pas une erreur
-- ---------------------------------------------------------------------------

select is(
  (select public.import_members(
     'aaaaaaaa-0000-4000-8000-000000000001',
     '[{"email":"anna@import.example"},{"email":"lea@example.com"},{"email":"denis@import.example"}]'::jsonb
   ))::text,
  (jsonb_build_object(
     'rows', 3, 'created', 1, 'already_member', 1, 'already_invited', 1
   ))::text,
  'déjà invitée et déjà membre sont ignorées et comptées, la nouvelle est créée'
);

-- ---------------------------------------------------------------------------
-- Une ligne illisible annule tout
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.import_members(
      'aaaaaaaa-0000-4000-8000-000000000001',
      '[{"email":"emma@import.example"},{"email":"pas une adresse"}]'::jsonb)$$,
  '23514',
  null,
  'une adresse invalide fait échouer tout l''import'
);

-- Le test qui compte : la ligne **valide** du même lot n'existe pas non plus.
select is(
  (select count(*)::int from public.invitations where email::text = 'emma@import.example'),
  0,
  '…et la ligne valide qui la précédait n''a rien créé'
);

select throws_ok(
  $$select public.import_members('aaaaaaaa-0000-4000-8000-000000000001', '[]'::jsonb)$$,
  '23514',
  null,
  'un fichier vide est refusé'
);

-- ---------------------------------------------------------------------------
-- Deux cents lignes, une transaction — le critère du ticket
-- ---------------------------------------------------------------------------

select is(
  (select (public.import_members(
     'aaaaaaaa-0000-4000-8000-000000000001',
     (select jsonb_agg(jsonb_build_object(
        'email', 'membre' || i || '@effectif.example',
        'first_name', 'Prénom' || i,
        'last_name', 'Nom' || i))
      from generate_series(1, 200) as i)
   ) ->> 'created')::int),
  200,
  'deux cents membres importés en une passe'
);

-- ---------------------------------------------------------------------------
-- Le journal : une entrée, des nombres, aucune adresse
-- ---------------------------------------------------------------------------

reset role;

select is(
  (select count(*)::int from public.audit_logs where action = 'members.imported'),
  3,
  'une entrée par import réussi — pas une par ligne, la table est append-only'
);

select is(
  (select count(*)::int from public.audit_logs where diff::text like '%@%'),
  0,
  'aucune adresse dans le journal, même à deux cents lignes'
);

-- ---------------------------------------------------------------------------
-- Qui a le droit d'importer
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"77777777-0000-4000-8000-000000000001","role":"authenticated","email":"hugo@rueil.example"}';

select throws_ok(
  $$select public.import_members(
      'aaaaaaaa-0000-4000-8000-000000000001',
      '[{"email":"patron@import.example","role":"OWNER"}]'::jsonb)$$,
  '42501',
  null,
  'un gestionnaire n''importe pas des propriétaires — la matrice de la spec §5.2 vaut aussi ici'
);

set local request.jwt.claims = '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select throws_ok(
  $$select public.import_members(
      'aaaaaaaa-0000-4000-8000-000000000001',
      '[{"email":"intrus@import.example"}]'::jsonb)$$,
  '42501',
  null,
  'un simple membre n''importe rien'
);

-- ---------------------------------------------------------------------------
-- La porte sans jeton
-- ---------------------------------------------------------------------------

reset role;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '88888888-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'anna@import.example', '',
  now(), now(), now(), '{}', '{}', false, '', '', '', ''
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"88888888-0000-4000-8000-000000000001","role":"authenticated","email":"anna@import.example"}';

select is(
  (select count(*)::int from public.pending_invitations_for_me()),
  1,
  'la personne importée voit l''invitation de sa box, sans détenir de jeton'
);

select is(
  (select tenant_slug from public.pending_invitations_for_me()),
  'crossfit-rueil',
  '…et sait de quelle box il s''agit'
);

select lives_ok(
  $$select public.accept_pending_invitation(
      (select invitation_id from public.pending_invitations_for_me()))$$,
  'elle rejoint en se connectant, sans jeton'
);

select is(
  (select status::text from public.memberships
   where user_id = '88888888-0000-4000-8000-000000000001'
     and tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'ACTIVE',
  'l''appartenance existe'
);

-- Le nom venu de l'import remplit un profil vide — et rien d'autre.
select is(
  (select first_name from public.users where id = '88888888-0000-4000-8000-000000000001'),
  'Anna',
  'le prénom de l''import pré-remplit le profil vide'
);

select is(
  (select count(*)::int from public.pending_invitations_for_me()),
  0,
  'l''invitation consommée disparaît de la liste'
);

-- ---------------------------------------------------------------------------
-- Ce que la seconde porte doit refuser, comme la première
-- ---------------------------------------------------------------------------

-- Les identifiants sont capturés **hors session** : sous celle de l'invitée,
-- `invitations` n'est pas lisible (policy OWNER/MANAGER), la sous-requête
-- rendrait NULL, et les deux tests ci-dessous passeraient pour la mauvaise
-- raison — « introuvable » parce qu'on a demandé NULL.
reset role;

create temporary table ids_invitations as
select
  (select id from public.invitations where email::text = 'bruno@import.example') as bruno,
  (select id from public.invitations where email::text = 'chloe@import.example') as chloe;

-- La table temporaire appartient à postgres : sans ce droit, la session
-- applicative lirait NULL et les deux tests passeraient pour la mauvaise raison.
grant select on ids_invitations to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"88888888-0000-4000-8000-000000000001","role":"authenticated","email":"anna@import.example"}';

-- L'invitation de quelqu'un d'autre : même par identifiant exact, la fonction
-- ne résout que parmi ses propres invitations — sinon un identifiant deviné
-- distinguerait « inexistante » de « pas pour vous », et les UUID v7 portent un
-- horodatage.
select throws_ok(
  format($$select public.accept_pending_invitation(%L)$$, (select bruno from ids_invitations)),
  'P0002',
  null,
  'l''invitation d''une autre adresse est introuvable, pas « refusée »'
);

reset role;

update public.invitations set expires_at = now() - interval '1 day'
where email::text = 'chloe@import.example';

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '88888888-0000-4000-8000-000000000002',
  'authenticated', 'authenticated', 'chloe@import.example', '',
  now(), now(), now(), '{}', '{}', false, '', '', '', ''
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"88888888-0000-4000-8000-000000000002","role":"authenticated","email":"chloe@import.example"}';

select is(
  (select count(*)::int from public.pending_invitations_for_me()),
  0,
  'une invitation expirée ne s''affiche pas'
);

-- Et si l'identifiant est connu quand même : le refus vient de
-- `claim_invitation()`, le même corps que pour la voie par jeton. C'est ce
-- partage qui garantit qu'aucun contrôle ne manque d'un côté.
select throws_ok(
  format($$select public.accept_pending_invitation(%L)$$, (select chloe from ids_invitations)),
  '23514',
  null,
  'et le refus vient du corps commun aux deux portes, pas d''un contrôle recopié'
);

select * from finish();
rollback;
