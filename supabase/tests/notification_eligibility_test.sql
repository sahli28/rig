-- P1-007 — La décision d'envoi : consentement, catégorie, quiet hours, plafond.
--
-- Écrit avant `notification_eligibility()`. Le cœur testable du push : chaque
-- cause de non-envoi a son assertion, et le calcul des quiet hours est prouvé
-- **en heure locale du membre**, repli box compris.

begin;
select plan(16);

select has_function(
  'public', 'notification_eligibility',
  array['uuid', 'public.notification_category', 'timestamptz'],
  'la décision d''envoi existe'
);
select has_column('public', 'users', 'timezone', 'le fuseau du membre est stocké');
select is(
  has_column_privilege('authenticated', 'public.users', 'timezone', 'UPDATE'),
  true,
  'et le membre peut l''écrire (grant de colonne cumulatif)'
);

-- Décor : Léa (membership a3…002, MEMBER de Rueil aaaa), midi UTC = 14 h à Paris
-- (hors quiet hours), et un midi qui bascule en nuit à Auckland.
\set lea_ms '\'a3000000-0000-4000-8000-000000000002\''
\set rueil '\'aaaaaaaa-0000-4000-8000-000000000001\''
\set noon '\'2026-09-15 12:00:00+00\''::timestamptz
\set night_paris '\'2026-09-15 20:30:00+00\''::timestamptz

-- ---------------------------------------------------------------------------
-- 1. Le consentement PUSH — porte d'entrée
-- ---------------------------------------------------------------------------

select is(
  public.notification_eligibility(:lea_ms, 'CLASS_REMINDER', :noon),
  'NO_PUSH_CONSENT',
  'sans consentement PUSH, rien ne part — quelle que soit la catégorie'
);

insert into public.consents (user_id, tenant_id, purpose, granted, policy_version)
values ('33333333-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
        'PUSH', true, '2026-08-01');

select is(
  public.notification_eligibility(:lea_ms, 'CLASS_REMINDER', :noon),
  'OK',
  'consentement accordé, en journée : OK'
);

-- ---------------------------------------------------------------------------
-- 2. La préférence de catégorie — opt-out, indépendante
-- ---------------------------------------------------------------------------

insert into public.notification_preferences (tenant_id, membership_id, category, enabled)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002',
        'CLASS_REMINDER', false);

select is(
  public.notification_eligibility(:lea_ms, 'CLASS_REMINDER', :noon),
  'CATEGORY_DISABLED',
  'catégorie désactivée : bloquée'
);
select is(
  public.notification_eligibility(:lea_ms, 'WAITLIST_PROMOTION', :noon),
  'OK',
  'et **une autre catégorie n''est pas affectée** — c''est le critère'
);

-- ---------------------------------------------------------------------------
-- 3. Les quiet hours — en heure locale du membre
-- ---------------------------------------------------------------------------

-- 20h30 UTC = 22h30 à Paris. Léa sans fuseau propre → repli box (Europe/Paris).
select is(
  public.notification_eligibility(:lea_ms, 'WAITLIST_PROMOTION', :night_paris),
  'QUIET_HOURS',
  'la nuit (heure de la box, faute de fuseau membre) : silencieux'
);
select is(
  public.notification_eligibility(:lea_ms, 'CLASS_CANCELLATION', :night_paris),
  'OK',
  'sauf l''annulation d''un cours — elle passe la nuit'
);

-- Léa se donne un fuseau où midi-UTC est minuit : la décision suit **son**
-- fuseau, pas celui de la box.
update public.users set timezone = 'Pacific/Auckland'
where id = '33333333-0000-4000-8000-000000000001';

select is(
  public.notification_eligibility(:lea_ms, 'WAITLIST_PROMOTION', :noon),
  'QUIET_HOURS',
  'midi UTC = minuit à Auckland : silencieux **en heure du membre**'
);

update public.users set timezone = null
where id = '33333333-0000-4000-8000-000000000001';

select is(
  public.notification_eligibility(:lea_ms, 'WAITLIST_PROMOTION', :noon),
  'OK',
  'fuseau membre retiré : le repli box (Paris, 14 h) rend OK — le repli fonctionne'
);

-- ---------------------------------------------------------------------------
-- 4. Le plafond marketing — le transactionnel ne compte pas
-- ---------------------------------------------------------------------------

insert into public.notification_sends (tenant_id, membership_id, category, sent_at)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002', 'MARKETING', :noon - interval '1 day'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002', 'MARKETING', :noon - interval '2 days');

select is(
  public.notification_eligibility(:lea_ms, 'MARKETING', :noon),
  'MARKETING_CAP',
  'deux marketing en 7 jours : le troisième est plafonné'
);
select is(
  public.notification_eligibility(:lea_ms, 'WAITLIST_PROMOTION', :noon),
  'OK',
  'mais le transactionnel passe : il ne compte pas dans le plafond'
);

-- Un envoi marketing vieux de 8 jours sort de la fenêtre.
select is(
  public.notification_marketing_count_7d(:lea_ms,
    '2026-09-15 12:00:00+00'::timestamptz + interval '8 days'),
  0,
  'huit jours plus tard, la fenêtre glissante s''est vidée'
);

-- ---------------------------------------------------------------------------
-- La révocation, prouvée — pas seulement écrite
-- ---------------------------------------------------------------------------
--
-- Ces deux fonctions sont des oracles si un client les atteint : elles lisent la
-- consommation et les quiet hours d'autrui. Le `revoke` est dans la migration,
-- mais un `create or replace` ultérieur qui l'oublierait laisserait la suite au
-- vert — le SQL ne rejoue pas les grants d'une fonction remplacée. On fige donc
-- le droit lui-même, comme `booking_test.sql` le fait pour `member_has_booking_right`.
select is(
  has_function_privilege(
    'authenticated',
    'public.notification_eligibility(uuid, public.notification_category, timestamptz)',
    'EXECUTE'
  ),
  false,
  'authenticated ne peut pas appeler notification_eligibility directement'
);

select is(
  has_function_privilege(
    'anon',
    'public.notification_marketing_count_7d(uuid, timestamptz)',
    'EXECUTE'
  ),
  false,
  'anon ne peut pas lire le compteur de plafond d''autrui'
);

select * from finish();
rollback;
