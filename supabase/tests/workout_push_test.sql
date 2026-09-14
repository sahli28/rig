-- P1-029 — la séance publiée prévient ceux qui ont réservé.
--
-- Deux fonctions depuis l'audit (rls-auditor, 14 sept. 2026) : l'enfileur
-- interne `notify_workout_published_at(id, p_now)` — révoqué des rôles
-- applicatifs, parce que `p_now` est la référence des quiet hours et qu'un
-- client qui le choisit les contournerait — et la porte publique
-- `notify_workout_published(id)`, gardée staff-du-tenant, qui fixe `now()`
-- elle-même. Les scénarios d'horloge se jouent donc sur l'interne, sous
-- `postgres` ; la porte publique se teste sur ses gardes, où l'heure ne
-- décide de rien.

begin;
select plan(10);

-- Fixtures : Léa (MEMBER Rueil) réserve un cours à venir, et consent au PUSH
-- pour Rueil — sans ce consentement, l'éligibilité écarte tout et le test ne
-- prouverait que le vide.
create temp table cible as
  select id, tenant_id from public.classes
  where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'
    and status = 'SCHEDULED' and deleted_at is null and starts_at > now()
  order by starts_at limit 1;
grant select on cible to authenticated;

insert into public.bookings (tenant_id, class_id, membership_id, status, idempotency_key)
select tenant_id, id, 'a3000000-0000-4000-8000-000000000002', 'CONFIRMED', 'p1-029-lea'
from cible;

insert into public.consents (user_id, tenant_id, purpose, granted, policy_version)
values ('33333333-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
        'PUSH', true, '2026-08-01');

-- Midi et 22 h, heure de la box (le fuseau de Léa retombe sur celui de Rueil).
create temp table instants as
  select ((current_date + 1)::text || ' 12:00:00 Europe/Paris')::timestamptz as midi,
         ((current_date + 1)::text || ' 22:00:00 Europe/Paris')::timestamptz as nuit;

-- ---------------------------------------------------------------------------
-- L'enfileur interne, sous postgres : la mécanique et l'horloge
-- ---------------------------------------------------------------------------

select is(
  (select public.notify_workout_published_at((select id from cible), (select midi from instants))),
  1,
  'à midi : une réservation CONFIRMED, un enfilage'
);

select is(
  (select count(*)::int from public.push_outbox
   where category = 'WORKOUT_UPDATED'
     and membership_id = 'a3000000-0000-4000-8000-000000000002'),
  1,
  'la ligne est pour Léa, catégorie WORKOUT_UPDATED'
);

select is(
  (select context ->> 'class_id' from public.push_outbox
   where category = 'WORKOUT_UPDATED' limit 1),
  (select id::text from cible),
  'le contexte porte le cours — le lien profond de l''émetteur en vivra'
);

select is(
  (select count(*)::int from public.push_outbox
   where category = 'WORKOUT_UPDATED'
     and membership_id <> 'a3000000-0000-4000-8000-000000000002'),
  0,
  'aucun non-inscrit n''est enfilé'
);

-- L'enfileur est volontairement bête : rappelé, il ré-enfile. Le « pas deux
-- fois pour rien » vit dans l'action, qui ne l'appelle que si le texte a
-- changé — documenté ici pour que personne ne cherche un dédoublonnage absent.
select is(
  (select public.notify_workout_published_at((select id from cible), (select midi from instants))),
  1,
  'rappelé, l''enfileur ré-enfile — le dédoublonnage est à l''action, pas ici'
);

-- Le fait mesuré qui a corrigé le ticket : quiet hours = ÉCARTÉ, pas différé.
select is(
  (select public.notify_workout_published_at((select id from cible), (select nuit from instants))),
  0,
  'à 22 h locales, rien n''est enfilé — écarté comme toute catégorie non exemptée'
);

-- ---------------------------------------------------------------------------
-- La porte publique, sous les rôles : gardes, et porte du contournement fermée
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"44444444-0000-4000-8000-000000000001","role":"authenticated","email":"sarah@example.com"}';

-- L'heure réelle du test n'est pas pilotable : on prouve que l'appel du staff
-- passe la garde (0 ou 1 selon l'heure de la CI — l'enfilage lui-même est
-- prouvé ci-dessus, à horloge contrôlée).
select lives_ok(
  format($$select public.notify_workout_published(%L)$$, (select id from cible)),
  'la porte publique accepte le staff de la box'
);

-- LA porte du contournement : l'interne, avec son horloge paramétrable, est
-- inatteignable d'un client — même staff.
select throws_ok(
  format(
    $$select public.notify_workout_published_at(%L, now())$$,
    (select id from cible)
  ),
  '42501',
  null,
  'l''enfileur interne (p_now paramétrable) est révoqué : les quiet hours ne se contournent pas'
);

set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select throws_ok(
  format($$select public.notify_workout_published(%L)$$, (select id from cible)),
  '42501',
  null,
  'un MEMBER ne déclenche pas de push — la garde de la porte refuse'
);

set local request.jwt.claims =
  '{"sub":"44444444-0000-4000-8000-000000000001","role":"authenticated","email":"sarah@example.com"}';

select throws_ok(
  $$select public.notify_workout_published(
      (select id from public.classes
       where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001' limit 1))$$,
  '42501',
  null,
  'un cours d''une autre box rend le même refus qu''un id inconnu'
);

select * from finish();
rollback;
