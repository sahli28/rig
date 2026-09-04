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

-- **Ces deux couleurs doivent rester distinctes de celle de la plateforme.**
-- Ce n'est pas une préférence de fixture, c'est ce qui rend un contrôle visuel
-- capable de prouver quelque chose.
--
-- Jusqu'au 3 septembre 2026, `DEFAULT_BRAND.primary` valait `#E4572E` —
-- exactement l'orange de Rueil ci-dessous. Conséquence : sur un écran, « c'est
-- orange » était vrai que le thème du tenant ait été résolu **ou pas**. Aucune
-- passe manuelle de white-label n'a donc jamais rien démontré, et un vrai
-- défaut de résolution est passé inaperçu pendant tout le parcours
-- d'invitation mobile.
--
-- Trois valeurs, trois significations, et elles ne doivent jamais se rejoindre :
--
--   * `#1F2933` graphite — la plateforme, quand **aucune** box n'est résolue ;
--   * `#4A5568` ardoise — le défaut de `themes.primary_color`, une box neuve
--     qui n'a pas encore choisi ;
--   * les couleurs ci-dessous — des boxes qui, elles, ont choisi.
--
-- `packages/ui/src/theme/default-brand.test.ts` relit ce fichier et échoue si
-- l'une rejoint l'autre. Changer l'orange de Rueil est permis ; le remplacer par
-- la couleur de la plateforme ne l'est pas.
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
-- Référentiel de la box — types de cours et horaires d'ouverture
-- ---------------------------------------------------------------------------

-- Des lignes **des deux côtés**, comme partout ailleurs dans ce seed : un test
-- d'isolation qui passe sur des données à sens unique ne prouve rien.
insert into public.class_types (id, tenant_id, name_i18n, description_i18n, duration_minutes, color, default_capacity) values
  ('a4000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   '{"fr": "WOD", "en": "WOD"}', '{"fr": "Le cours du jour.", "en": "Workout of the day."}', 60, '#E4572E', 16),
  ('a4000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   '{"fr": "Haltérophilie", "en": "Weightlifting"}', null, 90, '#2E4057', 10),
  ('a4000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
   '{"fr": "Open gym", "en": "Open gym"}', null, 120, '#4C956C', 20),
  ('b4000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
   '{"fr": "WOD", "en": "WOD"}', null, 60, '#16457A', 20),
  ('b4000000-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001',
   '{"fr": "Hyrox", "en": "Hyrox"}', '{"fr": "Préparation Hyrox.", "en": "Hyrox prep."}', 75, '#8C1C13', 12);

-- Heures **locales de la box** (tenants.timezone), jamais UTC — cf. le
-- commentaire de la migration. 0 = lundi, 6 = dimanche ; un jour sans ligne est
-- un jour fermé.
--
-- Rueil ferme le midi le lundi : c'est le seul endroit du seed où le cas « deux
-- créneaux le même jour » existe, et c'est celui qui casse une modélisation en
-- une seule paire d'heures par jour.
insert into public.opening_hours (id, tenant_id, weekday, opens_at, closes_at) values
  ('a5000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 0, '06:00', '13:00'),
  ('a5000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 0, '16:00', '21:30'),
  ('a5000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 1, '06:00', '21:30'),
  ('a5000000-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 2, '06:00', '21:30'),
  ('a5000000-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', 3, '06:00', '21:30'),
  ('a5000000-0000-4000-8000-000000000006', 'aaaaaaaa-0000-4000-8000-000000000001', 4, '06:00', '20:00'),
  ('a5000000-0000-4000-8000-000000000007', 'aaaaaaaa-0000-4000-8000-000000000001', 5, '09:00', '13:00'),
  ('b5000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 0, '07:00', '20:00'),
  ('b5000000-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', 1, '07:00', '20:00'),
  ('b5000000-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000001', 2, '07:00', '20:00'),
  ('b5000000-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000001', 3, '07:00', '20:00'),
  ('b5000000-0000-4000-8000-000000000005', 'bbbbbbbb-0000-4000-8000-000000000001', 4, '07:00', '20:00'),
  ('b5000000-0000-4000-8000-000000000006', 'bbbbbbbb-0000-4000-8000-000000000001', 5, '10:00', '12:00');

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

-- Depuis D-005, la table ne garde que l'**empreinte** du jeton. Les jetons en
-- clair du seed restent `inv-rueil-0001` et `inv-nanterre-0001` : ils sont
-- écrits ici hachés, mais on peut toujours les taper tels quels pour la passe
-- manuelle. En production ils n'existeraient qu'une fois, dans le retour de
-- `create_invitation()`.
insert into public.invitations (tenant_id, email, role, token_hash, expires_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'nouveau@example.com',  'MEMBER',
   encode(extensions.digest('inv-rueil-0001', 'sha256'), 'hex'),    now() + interval '30 days'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'nouvelle@example.com', 'MEMBER',
   encode(extensions.digest('inv-nanterre-0001', 'sha256'), 'hex'), now() + interval '30 days');

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

-- ---------------------------------------------------------------------------
-- Planning — des séries, et les occurrences qu'elles produisent
-- ---------------------------------------------------------------------------

-- **Le seed n'avait aucun cours.** P1-002 a livré la grille du back-office, où
-- l'on crée ses séries à la main ; personne n'en avait donc besoin en fixture.
-- Le planning mobile (P1-002b) est en lecture seule : sans données, il ne peut
-- afficher que son état vide, et aucune passe ne prouve quoi que ce soit. La
-- réservation (P1-003b) butera sur le même mur — il lui faut un cours à réserver.
--
-- Des séries **des deux côtés**, comme partout dans ce fichier : un planning à
-- sens unique ne montrerait pas qu'un membre de Rueil ne voit pas Nanterre.
--
-- `starts_on` part du lundi de la semaine courante pour que les occurrences
-- tombent autour d'aujourd'hui, quel que soit le jour où le seed est rejoué.
insert into public.class_schedules
  (id, tenant_id, class_type_id, room_id, coach_membership_id, starts_on, starts_at_local, rrule, capacity)
values
  ('a5000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001',
   'a3000000-0000-4000-8000-000000000003',
   date_trunc('week', current_date)::date, '18:30', 'FREQ=WEEKLY;BYDAY=MO,WE,FR', 16),
  ('a5000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'a4000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001',
   'a3000000-0000-4000-8000-000000000003',
   date_trunc('week', current_date)::date, '19:00', 'FREQ=WEEKLY;BYDAY=TU', 10),
  ('a5000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
   'a4000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001',
   'a3000000-0000-4000-8000-000000000003',
   date_trunc('week', current_date)::date, '10:00', 'FREQ=WEEKLY;BYDAY=SA', 20),
  ('b5000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
   'b4000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001',
   'b3000000-0000-4000-8000-000000000001',
   date_trunc('week', current_date)::date, '12:15', 'FREQ=WEEKLY;BYDAY=MO,TH', 20),
  ('b5000000-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001',
   'b4000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001',
   'b3000000-0000-4000-8000-000000000001',
   date_trunc('week', current_date)::date, '19:30', 'FREQ=WEEKLY;BYDAY=WE', 12);

-- Deux semaines d'occurrences, en arrière et en avant : de quoi exercer la
-- navigation d'un jour à l'autre sans tomber dans le vide au premier tap. La
-- fonction est la **même** que celle de `pg_cron` — le seed ne fabrique pas ses
-- occurrences à la main, il emprunte le chemin réel (piège 9 de database.md).
select public.materialize_class_occurrences(current_date - 14, current_date + 14, null);
