-- Seed local. Deux boxes, deux propriétaires, quatre membres.
--
-- Volontairement **croisé** : un membre appartient aux deux boxes, et chaque
-- table porte des lignes des deux côtés. Sans ça, un test d'isolation qui passe
-- ne prouve rien — il pourrait passer sur une base vide.
--
-- Les identifiants sont figés pour que les tests pgTAP puissent s'y référer.

-- ---------------------------------------------------------------------------
-- auth.users — Supabase Auth. `public.users.id` les référence.
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  -- GoTrue lit ces quatre colonnes dans des champs Go **non-nullables**. Les
  -- laisser à NULL fait échouer toute recherche d'utilisateur sur un
  -- « Database error finding user » en 500, et aucun compte du seed ne peut
  -- alors se connecter. Le défaut est resté invisible tant que les essais
  -- manuels créaient leur compte par l'API au lieu d'utiliser le seed.
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'marc@rueil.example',     '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'claire@nanterre.example','', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'lea@example.com',        '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '44444444-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'sarah@example.com',      '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '55555555-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'thomas@example.com',     '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '66666666-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'julie@example.com',      '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', ''),
  -- Hugo est MANAGER, un rôle qu'aucune fixture ne portait : sans lui, la
  -- distinction OWNER / MANAGER que la spec §5.2 fait sur le journal d'audit et
  -- sur la comptabilité n'était testable dans aucun sens.
  ('00000000-0000-0000-0000-000000000000', '77777777-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'hugo@rueil.example',     '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', '');

-- Les fiches `public.users` sont créées par le trigger `on_auth_user_created`,
-- déclenché par les insertions ci-dessus. Le seed exerce donc le vrai chemin
-- d'inscription au lieu de le court-circuiter — c'est ce court-circuit qui
-- masquait l'impossibilité de s'inscrire. On ne complète ici que ce que
-- l'authentification ne connaît pas.
update public.users u
set first_name = v.first_name, last_name = v.last_name, locale = v.locale
from (values
  ('11111111-0000-4000-8000-000000000001'::uuid, 'Marc',   'Lefevre',   'fr'),
  ('22222222-0000-4000-8000-000000000001'::uuid, 'Claire', 'Aubert',    'fr'),
  ('33333333-0000-4000-8000-000000000001'::uuid, 'Léa',    'Martin',    'fr'),
  ('44444444-0000-4000-8000-000000000001'::uuid, 'Sarah',  'Dupont',    'fr'),
  ('55555555-0000-4000-8000-000000000001'::uuid, 'Thomas', 'Bernard',   'en'),
  ('66666666-0000-4000-8000-000000000001'::uuid, 'Julie',  'Kaczmarek', 'fr'),
  ('77777777-0000-4000-8000-000000000001'::uuid, 'Hugo',   'Petit',     'fr')
) as v(id, first_name, last_name, locale)
where u.id = v.id;

-- ---------------------------------------------------------------------------
-- Les deux boxes
-- ---------------------------------------------------------------------------

insert into public.tenants (id, slug, name, timezone) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'crossfit-rueil',    'CrossFit Rueil',    'Europe/Paris'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'crossfit-nanterre', 'CrossFit Nanterre', 'Europe/Paris');

insert into public.tenant_settings (tenant_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001'),
  ('bbbbbbbb-0000-4000-8000-000000000001');

insert into public.themes (tenant_id, app_name, primary_color) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'CF Rueil',    '#E4572E'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'CF Nanterre', '#16457A');

insert into public.locations (id, tenant_id, name, city) values
  ('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Salle Rueil',    'Rueil-Malmaison'),
  ('b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'Salle Nanterre', 'Nanterre');

insert into public.rooms (id, tenant_id, location_id, name, capacity) values
  ('a2000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Salle principale', 16),
  ('b2000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Salle principale', 20);

-- ---------------------------------------------------------------------------
-- Appartenances — Julie est dans les DEUX boxes, c'est le cas qui compte
-- ---------------------------------------------------------------------------

insert into public.memberships (id, tenant_id, user_id, role) values
  ('a3000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 'OWNER'),
  ('a3000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000001', 'MEMBER'),
  ('a3000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', '44444444-0000-4000-8000-000000000001', 'COACH'),
  ('a3000000-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', '66666666-0000-4000-8000-000000000001', 'MEMBER'),
  ('a3000000-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', '77777777-0000-4000-8000-000000000001', 'MANAGER'),
  ('b3000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', 'OWNER'),
  ('b3000000-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', '55555555-0000-4000-8000-000000000001', 'MEMBER'),
  ('b3000000-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000001', '66666666-0000-4000-8000-000000000001', 'MEMBER'),
  -- Hugo administre Rueil et n'est **que membre** de Nanterre. C'est la fixture
  -- qui distingue « autorisé quelque part » de « autorisé ici », dans une seule
  -- requête. Julie (membre des deux, sans rôle) et Marc (propriétaire d'une
  -- seule) ne peuvent pas la produire : chez eux, appartenance et rôle
  -- coïncident. Une policy qui dirait `current_tenant_ids()` là où elle doit
  -- dire `current_admin_tenant_ids()` passerait leurs deux cas et échouerait
  -- sur celui-ci.
  ('b3000000-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000001', '77777777-0000-4000-8000-000000000001', 'MEMBER');

insert into public.invitations (tenant_id, email, role, token, expires_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'nouveau@example.com', 'MEMBER', 'inv-rueil-0001',    now() + interval '30 days'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'nouvelle@example.com','MEMBER', 'inv-nanterre-0001', now() + interval '30 days');

-- ---------------------------------------------------------------------------
-- Conformité et traçabilité — des lignes des deux côtés partout
-- ---------------------------------------------------------------------------

-- Consentement plateforme (tenant_id null) et consentement de box, pour couvrir
-- les deux branches de la policy hybride.
insert into public.consents (user_id, tenant_id, purpose, granted, policy_version) values
  ('33333333-0000-4000-8000-000000000001', null,                                   'TERMS',       true, '2026-08-01'),
  ('33333333-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'BOX_TERMS',   true, '2026-08-01'),
  ('55555555-0000-4000-8000-000000000001', null,                                   'TERMS',       true, '2026-08-01'),
  ('55555555-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'LEADERBOARD', false,'2026-08-01');

insert into public.devices (user_id, push_token, platform) values
  ('33333333-0000-4000-8000-000000000001', 'expo-token-lea',    'ios'),
  ('55555555-0000-4000-8000-000000000001', 'expo-token-thomas', 'android');

insert into public.audit_logs (tenant_id, actor_membership_id, action, target_type, target_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'membership.role_changed', 'membership', 'a3000000-0000-4000-8000-000000000003'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'tenant.settings_updated', 'tenant',     'bbbbbbbb-0000-4000-8000-000000000001');

insert into public.ledger_entries (tenant_id, type, amount_cents, direction, ref_type) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'subscription.payment', 8900, 'CREDIT', 'subscription'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'subscription.payment', 7900, 'CREDIT', 'subscription');

insert into public.processed_webhook_events (event_id, source) values
  ('evt_seed_0001', 'stripe');
