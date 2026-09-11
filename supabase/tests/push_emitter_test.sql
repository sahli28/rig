-- P1-007 — L'émetteur : la file, les RPC d'état, les producteurs.
--
-- Ce que ce fichier prouve, et ce qu'il ne peut pas : la **logique** de l'envoi
-- (enfilage éligible, claim/mark, retry, réassignation d'appareil, enfilage par
-- les producteurs) est ici, sous `postgres`. Le **transport HTTP** (net.http_post
-- vers l'émetteur, saut vers exp.host, APNs) ne l'est pas — c'est la ride locale
-- de D-010, prouvée à la passe iPhone. Le rendu i18n du message est prouvé, lui,
-- en `deno test` (le vrai moteur de l'émetteur).

begin;
select plan(47);

-- ---------------------------------------------------------------------------
-- Existence et forme
-- ---------------------------------------------------------------------------
select has_table('public', 'push_outbox', 'la file d''envoi existe');
select has_function('public', 'claim_push_outbox', array['integer'], 'claim_push_outbox existe');
select has_function('public', 'mark_push_sent', array['uuid[]'], 'mark_push_sent existe');
select has_function('public', 'mark_push_failed', array['uuid[]', 'text'], 'mark_push_failed existe');
select has_function('public', 'register_device', array['text', 'text', 'text'], 'register_device existe');
select has_function('public', 'revoke_device', array['text'], 'revoke_device existe');
select has_function(
  'public', 'enqueue_push',
  array['uuid', 'uuid', 'public.notification_category', 'jsonb', 'timestamptz'],
  'enqueue_push existe'
);
select has_function('public', 'enqueue_class_reminders', array['timestamptz'], 'le job J-1 existe');

-- ---------------------------------------------------------------------------
-- Droits : l'émetteur agit en service_role, le mobile n'a que register_device
-- ---------------------------------------------------------------------------
select is(
  has_function_privilege('authenticated', 'public.claim_push_outbox(integer)', 'EXECUTE'),
  false, 'authenticated ne draine pas la file'
);
select is(
  has_function_privilege('authenticated', 'public.mark_push_sent(uuid[])', 'EXECUTE'),
  false, 'authenticated ne marque pas un envoi'
);
select is(
  has_function_privilege('authenticated', 'public.revoke_device(text)', 'EXECUTE'),
  false, 'authenticated ne révoque pas un jeton par sa valeur'
);
select is(
  has_function_privilege('service_role', 'public.claim_push_outbox(integer)', 'EXECUTE'),
  true, 'l''émetteur (service_role) draine'
);
select is(
  has_function_privilege('authenticated', 'public.register_device(text, text, text)', 'EXECUTE'),
  true, 'le mobile enregistre son appareil'
);

-- push_outbox : infra, intouchable au client (ni grant ni policy).
select is(
  has_table_privilege('authenticated', 'public.push_outbox', 'SELECT'),
  false, 'un membre ne lit pas la file d''envoi'
);
select is(
  has_table_privilege('authenticated', 'public.push_outbox', 'INSERT'),
  false, 'un membre n''enfile pas en direct'
);

-- ---------------------------------------------------------------------------
-- Décor : Léa consent PUSH (device 'expo-token-lea' du seed), Julie non.
-- ---------------------------------------------------------------------------
\set lea_ms '\'a3000000-0000-4000-8000-000000000002\''
\set julie_ms '\'a3000000-0000-4000-8000-000000000004\''
\set rueil '\'aaaaaaaa-0000-4000-8000-000000000001\''
\set daytime '\'2026-09-15 12:00:00+00\''::timestamptz

insert into public.consents (user_id, tenant_id, purpose, granted, policy_version)
values ('33333333-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
        'PUSH', true, '2026-08-01');

-- ---------------------------------------------------------------------------
-- enqueue_push — la porte, avec le filtre d'éligibilité
-- ---------------------------------------------------------------------------
-- Midi UTC = 14 h à Paris, hors quiet hours : le rappel passe.
select is(
  public.enqueue_push(:lea_ms, :rueil, 'CLASS_REMINDER', '{"class_id":"x"}'::jsonb, :daytime),
  true, 'Léa consent PUSH : enfilé'
);
select is(
  public.enqueue_push(:julie_ms, :rueil, 'CLASS_REMINDER', '{"class_id":"x"}'::jsonb, :daytime),
  false, 'Julie sans consentement PUSH : écarté, pas d''insertion'
);
select is(
  (select count(*)::int from public.push_outbox),
  1, 'une seule ligne enfilée, celle de Léa'
);

-- ---------------------------------------------------------------------------
-- claim_push_outbox — verrouille, résout jetons et langue, marque claimed
-- ---------------------------------------------------------------------------
create temporary table _claimed on commit drop as select * from public.claim_push_outbox(50);

select is(
  (select push_tokens from _claimed limit 1),
  array['expo-token-lea'],
  'claim résout les jetons d''appareil du membre'
);
select is(
  (select locale from _claimed limit 1),
  'fr', 'claim résout la langue (Léa : fr)'
);
select is(
  (select category::text from _claimed limit 1),
  'CLASS_REMINDER', 'claim rend la catégorie'
);
select is(
  (select status from public.push_outbox where id = (select id from _claimed limit 1)),
  'claimed', 'la ligne claimée n''est plus pending'
);

-- ---------------------------------------------------------------------------
-- mark_push_sent — l'envoi devient une ligne de journal, une seule fois
-- ---------------------------------------------------------------------------
select is(
  public.mark_push_sent(array(select id from _claimed)),
  1, 'un envoi marqué sent'
);
select is(
  (select status from public.push_outbox where id = (select id from _claimed limit 1)),
  'sent', 'la ligne passe à sent'
);
select is(
  (select count(*)::int from public.notification_sends
   where membership_id = :lea_ms and category = 'CLASS_REMINDER'),
  1, 'et une ligne notification_sends est écrite'
);
select is(
  public.mark_push_sent(array(select id from _claimed)),
  0, 'idempotent : un second mark_sent n''écrit rien de plus'
);

-- ---------------------------------------------------------------------------
-- mark_push_failed — réessayer, puis renoncer
-- ---------------------------------------------------------------------------
delete from public.push_outbox;
delete from public.notification_sends;

-- Échec transitoire : attempts < 5 -> repending.
select public.enqueue_push(:lea_ms, :rueil, 'CLASS_CANCELLATION', '{}'::jsonb, :daytime);
select count(*) from public.claim_push_outbox(50);  -- attempts -> 1, claimed
select is(
  public.mark_push_failed(array(select id from public.push_outbox), 'exp.host injoignable'),
  1, 'échec transitoire marqué'
);
select is(
  (select status from public.push_outbox limit 1),
  'pending', 'attempts < 5 : ré-armé en pending pour le balayage'
);

-- Au plafond : attempts >= 5 -> failed pour de bon.
delete from public.push_outbox;
select public.enqueue_push(:lea_ms, :rueil, 'CLASS_CANCELLATION', '{}'::jsonb, :daytime);
update public.push_outbox set attempts = 4;         -- la prochaine prise fera 5
select count(*) from public.claim_push_outbox(50);  -- attempts -> 5, claimed
select is(
  public.mark_push_failed(array(select id from public.push_outbox), 'toujours KO'),
  1, 'échec au plafond marqué'
);
select is(
  (select status from public.push_outbox limit 1),
  'failed', 'à la 5e prise, figé à failed'
);

-- ---------------------------------------------------------------------------
-- register_device — l'upsert nu casse sur téléphone partagé
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';
select isnt(
  public.register_device('shared-phone-token', 'ios', '1.0.0'),
  null, 'Léa enregistre un appareil'
);

-- Julie prend le même téléphone : l'upsert client nu échouerait en 23505 (la
-- RLS masque la ligne de Léa). register_device réassigne le jeton à Julie.
set local request.jwt.claims = '{"sub":"66666666-0000-4000-8000-000000000001","role":"authenticated","email":"julie@example.com"}';
select isnt(
  public.register_device('shared-phone-token', 'ios', '1.0.0'),
  null, 'Julie réenregistre le même jeton sans 23505'
);

reset role;
select is(
  (select user_id from public.devices where push_token = 'shared-phone-token'),
  '66666666-0000-4000-8000-000000000001'::uuid,
  'le jeton du téléphone partagé appartient désormais à Julie'
);

-- ---------------------------------------------------------------------------
-- revoke_device — supprimé au premier échec
-- ---------------------------------------------------------------------------
select is(
  public.revoke_device('shared-phone-token'),
  1, 'un jeton mort est supprimé'
);
select is(
  (select count(*)::int from public.devices where push_token = 'shared-phone-token'),
  0, 'et il ne reste rien'
);

-- ---------------------------------------------------------------------------
-- enqueue_class_reminders — cours de demain, à 18 h locales, par réservation
-- ---------------------------------------------------------------------------
delete from public.push_outbox;
delete from public.notification_sends;

-- Un cours demain (16 h UTC = 18 h Paris CEST -> demain local = 2026-09-16).
-- On réutilise série/type/salle/coach du seed ; seul l'horaire compte ici.
insert into public.classes
  (id, tenant_id, schedule_id, class_type_id, room_id, coach_membership_id, starts_at, ends_at, capacity)
values
  ('c1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'a7000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000003',
   '2026-09-16 17:00:00+00', '2026-09-16 18:00:00+00', 16);

insert into public.bookings (tenant_id, class_id, membership_id, idempotency_key, status)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
        :lea_ms, 'test-reminder-key', 'CONFIRMED');

-- p_now = 2026-09-15 16 h UTC = 18 h Paris : la fenêtre d'envoi.
select is(
  public.enqueue_class_reminders('2026-09-15 16:00:00+00'::timestamptz),
  1, 'à 18 h locales, un rappel par réservation confirmée des cours de demain'
);
select is(
  (select count(*)::int from public.push_outbox
   where category = 'CLASS_REMINDER' and membership_id = :lea_ms),
  1, 'le rappel de Léa est en file'
);

-- Hors de la fenêtre de 18 h : rien.
delete from public.push_outbox;
select is(
  public.enqueue_class_reminders('2026-09-15 12:00:00+00'::timestamptz),
  0, 'à midi, aucune box n''est à 18 h locales : rien n''est enfilé'
);

-- ---------------------------------------------------------------------------
-- cancel_class_bookings — l'annulation d'un cours enfile un CLASS_CANCELLATION
-- ---------------------------------------------------------------------------
delete from public.push_outbox;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@example.com"}';
select is(
  public.cancel_class_bookings('c1000000-0000-4000-8000-000000000001'),
  1, 'la box annule le cours : une réservation annulée'
);
reset role;
select is(
  (select count(*)::int from public.push_outbox
   where category = 'CLASS_CANCELLATION' and membership_id = :lea_ms),
  1, 'et un CLASS_CANCELLATION est enfilé pour le membre inscrit'
);

-- ---------------------------------------------------------------------------
-- app_runtime_config — d'où kick_push_emitter tire l'URL (table, plus GUC)
-- ---------------------------------------------------------------------------
-- Table d'infrastructure au niveau du déploiement : RLS forcée, aucune policy,
-- aucun droit client. Seule kick_push_emitter (security definer, propriétaire
-- bypassrls) la lit. Le GUC est mort (l'hébergé le refuse à postgres) — le
-- transport passe par cette table, identique en local et sur l'hébergé.
select has_table('public', 'app_runtime_config', 'la config runtime de déploiement existe');
select is(
  (select relrowsecurity and relforcerowsecurity
     from pg_class where oid = 'public.app_runtime_config'::regclass),
  true, 'app_runtime_config : RLS activée ET forcée'
);
select is(
  has_table_privilege('authenticated', 'public.app_runtime_config', 'SELECT'),
  false, 'un membre ne lit pas la config de déploiement'
);
select is(
  has_table_privilege('authenticated', 'public.app_runtime_config', 'INSERT'),
  false, 'un membre n''écrit pas la config de déploiement'
);
select has_function('public', 'kick_push_emitter', 'kick_push_emitter existe');
select is(
  (select prosecdef from pg_proc where oid = 'public.kick_push_emitter()'::regprocedure),
  true, 'kick_push_emitter est security definer (lit la table malgré la FORCE)'
);
-- Valeur absente = no-op silencieux, jamais d'erreur : le contrat qui protège
-- le producteur appelant. La table est vide par défaut (le seed n'y touche pas).
delete from public.app_runtime_config;
select lives_ok(
  'select public.kick_push_emitter()',
  'kick_push_emitter : no-op silencieux quand push_emitter_url est absent'
);

select * from finish();
rollback;
