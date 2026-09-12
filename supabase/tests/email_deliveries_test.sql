-- P1-018 — L'émetteur d'invitations : la table, la réservation, le marquage.
--
-- Ce qui se prouve : (1) la box voit ses envois, un membre non ; (2) `claim` ne
-- réserve que les invitations PENDING **nominatives et vives**, autorise
-- OWNER/MANAGER, et **ne réserve pas deux fois dans la fenêtre** — l'idempotence
-- qui tient « jamais deux fois » sur une relance ou une coupure ; (3) `mark` passe
-- `sending -> sent | failed`, idempotent (garde `status = sending`), autorisé.

begin;
select plan(19);

\set rueil    '\'aaaaaaaa-0000-4000-8000-000000000001\''
\set marc_jwt '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}'
\set lea_jwt  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}'

-- Décor déterministe : on repart d'une box sans invitation (le seed en pose une,
-- `nouveau@example.com`), puis Marc (OWNER) en importe trois. On expire la
-- première pour prouver que `claim` écarte les invitations mortes.
reset role;
delete from public.invitations where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = :'marc_jwt';
select public.import_members(
  'aaaaaaaa-0000-4000-8000-000000000001',
  '[{"email":"un@import.example"},{"email":"deux@import.example"},{"email":"trois@import.example"}]'::jsonb
);
reset role;

update public.invitations set expires_at = now() - interval '1 day'
where email::text = 'un@import.example';

-- 1. La forme et les droits
select has_table('public', 'email_deliveries', 'la table email_deliveries existe');
select has_function('public', 'claim_invitations_to_email', array['uuid', 'integer', 'interval'], 'claim existe');
select has_function('public', 'mark_email_delivery', array['uuid', 'text', 'text', 'text'], 'mark existe');
select is(
  has_function_privilege('authenticated', 'public.claim_invitations_to_email(uuid,integer,interval)', 'EXECUTE'),
  true, 'un admin (authenticated) réserve — l''émetteur est une action back-office, pas service_role'
);
select is(
  has_function_privilege('anon', 'public.claim_invitations_to_email(uuid,integer,interval)', 'EXECUTE'),
  false, 'anon ne réserve rien'
);

-- 2. claim ne réserve que les PENDING nominatives et vives, sous l'admin
set local role authenticated;
set local request.jwt.claims = :'marc_jwt';
select is(
  (select count(*)::int from public.claim_invitations_to_email(:rueil, 40, interval '24 hours')),
  2, 'deux invitations réservées — l''expirée est écartée'
);
reset role;

select is(
  (select count(*)::int from public.email_deliveries
   where tenant_id = :rueil and status = 'sending'),
  2, 'deux lignes sending posées'
);
select is(
  (select count(*)::int from public.email_deliveries d
   join public.invitations i on i.id = d.invitation_id
   where i.email::text = 'un@import.example'),
  0, 'l''invitation expirée n''a aucun envoi'
);

-- 3. Rejouer dans la fenêtre ne re-réserve rien (idempotence relance / coupure)
set local role authenticated;
set local request.jwt.claims = :'marc_jwt';
select is(
  (select count(*)::int from public.claim_invitations_to_email(:rueil, 40, interval '24 hours')),
  0, 'un second lancement dans la fenêtre ne re-réserve rien'
);
reset role;

-- 4. Autorisation : un simple membre ne réserve pas
set local role authenticated;
set local request.jwt.claims = :'lea_jwt';
select throws_ok(
  format($$select * from public.claim_invitations_to_email(%L, 40, interval '24 hours')$$, :rueil),
  '42501', null, 'un simple membre ne réserve rien (FORBIDDEN_ROLE)'
);
reset role;

-- 5. mark : sending -> sent, puis idempotent
create temporary table d_pick as
  select id from public.email_deliveries
  where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001' and status = 'sending'
  order by created_at limit 1;
grant select on d_pick to authenticated;

set local role authenticated;
set local request.jwt.claims = :'marc_jwt';
select lives_ok(
  format($$select public.mark_email_delivery(%L, 'sent', 'brevo-123')$$, (select id from d_pick)),
  'marquer une ligne sending -> sent'
);
select is(
  (select status from public.email_deliveries where id = (select id from d_pick)),
  'sent', 'la ligne est sent, avec l''id fournisseur'
);
select lives_ok(
  format($$select public.mark_email_delivery(%L, 'failed', null, 'à ignorer')$$, (select id from d_pick)),
  're-marquer une ligne déjà sent ne lève pas'
);
select is(
  (select status from public.email_deliveries where id = (select id from d_pick)),
  'sent', '…et ne la réécrit pas — idempotent par le garde status = sending'
);
reset role;

-- 6. La box voit ses envois ; un membre non (RLS)
set local role authenticated;
set local request.jwt.claims = :'marc_jwt';
select is(
  (select count(*)::int from public.email_deliveries where tenant_id = :rueil),
  2, 'l''OWNER voit les envois de sa box'
);
set local request.jwt.claims = :'lea_jwt';
select is(
  (select count(*)::int from public.email_deliveries where tenant_id = :rueil),
  0, 'un simple membre ne voit aucun envoi — la policy est OWNER/MANAGER'
);
reset role;

-- ---------------------------------------------------------------------------
-- Reprise (fix P1-018) : réservations mortes reprises, permanence respectée.
-- Décor propre pour isoler ces cas : deux invitations vives, aucun envoi.
-- ---------------------------------------------------------------------------
reset role;
delete from public.email_deliveries where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001';
delete from public.invitations where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = :'marc_jwt';
select public.import_members(
  'aaaaaaaa-0000-4000-8000-000000000001',
  '[{"email":"a@import.example"},{"email":"b@import.example"}]'::jsonb
);
reset role;

-- 7. Une `sending` plus vieille que le bail (15 min) est une réservation morte :
--    le prochain claim la passe `failed` (visible) et l'invitation redevient
--    réservable. On la fabrique sur a@ ; b@ n'a jamais été envoyée.
reset role;
insert into public.email_deliveries (tenant_id, invitation_id, email, status, created_at)
select 'aaaaaaaa-0000-4000-8000-000000000001', i.id, i.email::text, 'sending', now() - interval '20 minutes'
from public.invitations i
where i.tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001' and i.email::text = 'a@import.example';

set local role authenticated;
set local request.jwt.claims = :'marc_jwt';
select is(
  (select count(*)::int from public.claim_invitations_to_email(:rueil, 40, interval '24 hours')),
  2, 'la réservation morte est reprise : a@ redevient réservable, avec b@'
);
reset role;

select is(
  (select count(*)::int from public.email_deliveries
   where tenant_id = :rueil and status = 'failed'
     and last_error like 'réservation expirée%'),
  1, 'la ligne sending trop vieille est passée failed (visible), pas laissée en suspens'
);

-- 8. Échec temporaire (429) vs permanent (adresse invalide) : seul le temporaire
--    est réessayé. a@ et b@ portent chacune une `sending` fraîche (claim §7).
set local role authenticated;
set local request.jwt.claims = :'marc_jwt';
select public.mark_email_delivery(
  (select d.id from public.email_deliveries d
   join public.invitations i on i.id = d.invitation_id
   where i.email::text = 'b@import.example' and d.status = 'sending'),
  'failed', null, 'Brevo 429: quota du jour atteint'
);
select public.mark_email_delivery(
  (select d.id from public.email_deliveries d
   join public.invitations i on i.id = d.invitation_id
   where i.email::text = 'a@import.example' and d.status = 'sending'),
  'failed_permanent', null, 'Brevo 400: adresse invalide'
);
select is(
  (select array_agg(email order by email)
   from public.claim_invitations_to_email(:rueil, 40, interval '24 hours')),
  array['b@import.example'],
  'le 429 (temporaire) est réessayé ; l''adresse invalide (permanent) ne l''est plus'
);
reset role;

select * from finish();
rollback;
