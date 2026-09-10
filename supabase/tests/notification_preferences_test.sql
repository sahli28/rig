-- P1-007 — Les réglages de notification par catégorie : opt-out, self-service,
-- cloisonnés.

begin;
select plan(9);

select has_table('public', 'notification_preferences', 'la table des réglages existe');

-- Opt-out : aucune ligne au départ = tout activé (c'est l'éligibilité qui le
-- lit ; ici on prouve la mécanique de la table).
select is(
  (select count(*) from public.notification_preferences)::int,
  0,
  'aucun réglage au départ : le défaut du produit est de prévenir'
);

-- Léa, MEMBER de Rueil, règle ses propres catégories.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select lives_ok(
  $$insert into public.notification_preferences (tenant_id, membership_id, category, enabled)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002', 'CLASS_REMINDER', false)$$,
  'un membre désactive une catégorie pour lui-même'
);

select is(
  (select enabled from public.notification_preferences
   where membership_id = 'a3000000-0000-4000-8000-000000000002' and category = 'CLASS_REMINDER'),
  false,
  'et il relit son propre réglage'
);

-- Upsert idempotent : réactiver la même catégorie.
select lives_ok(
  $$insert into public.notification_preferences (tenant_id, membership_id, category, enabled)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002', 'CLASS_REMINDER', true)
    on conflict (membership_id, category) do update set enabled = excluded.enabled$$,
  'et il le rebascule — une seule ligne par catégorie'
);
select is(
  (select count(*) from public.notification_preferences
   where membership_id = 'a3000000-0000-4000-8000-000000000002' and category = 'CLASS_REMINDER')::int,
  1,
  'l''upsert n''a pas dupliqué la ligne'
);

-- Il ne touche pas les réglages d'autrui : viser l'appartenance de Julie
-- (a3…004) n'affecte aucune ligne (policy `id = auth.uid()` par appartenance).
reset role;
insert into public.notification_preferences (tenant_id, membership_id, category, enabled)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000004', 'MARKETING', true);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select lives_ok(
  $$update public.notification_preferences set enabled = false
    where membership_id = 'a3000000-0000-4000-8000-000000000004'$$,
  'l''update ne lève pas — mais…'
);

-- Relu **sous postgres** : sous le rôle de Léa, la policy de lecture masquerait
-- déjà la ligne de Julie, et l'on confondrait « masquée » avec « inchangée ».
-- C'est la valeur qui prouve la garde, comme dans `role_isolation_test`.
reset role;
select is(
  (select enabled from public.notification_preferences
   where membership_id = 'a3000000-0000-4000-8000-000000000004'),
  true,
  '…il n''affecte **aucune** ligne : le réglage de Julie est inchangé (la valeur le prouve)'
);

-- Thomas, Nanterre, ne voit rien de Rueil.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"55555555-0000-4000-8000-000000000001","role":"authenticated","email":"thomas@example.com"}';
select is(
  (select count(*) from public.notification_preferences)::int,
  0,
  'un membre de Nanterre ne lit aucun réglage de Rueil'
);

select * from finish();
rollback;
