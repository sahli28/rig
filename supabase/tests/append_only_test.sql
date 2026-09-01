-- `ledger_entries` et `audit_logs` sont append-only.
--
-- Le ledger parce qu'aucun rapprochement avec Stripe n'est défendable si une
-- écriture peut être retouchée ; le journal d'audit parce qu'un journal
-- modifiable ne prouve rien.

begin;
select plan(11);

-- `restrict_violation` = SQLSTATE 23001. C'est le code que lève `forbid_mutation()`.
select throws_ok(
  $$update public.ledger_entries set amount_cents = 1 where true$$,
  '23001',
  null,
  'UPDATE sur ledger_entries lève'
);

select throws_ok(
  $$delete from public.ledger_entries where true$$,
  '23001',
  null,
  'DELETE sur ledger_entries lève'
);

select throws_ok(
  $$update public.audit_logs set action = 'falsifié' where true$$,
  '23001',
  null,
  'UPDATE sur audit_logs lève'
);

select throws_ok(
  $$delete from public.audit_logs where true$$,
  '23001',
  null,
  'DELETE sur audit_logs lève'
);

-- L'insertion reste possible : c'est le principe même d'une contre-écriture.
select lives_ok(
  $$insert into public.ledger_entries (tenant_id, type, amount_cents, direction)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'refund', -8900, 'DEBIT')$$,
  'une contre-écriture négative reste insérable'
);

-- ---------------------------------------------------------------------------
-- Ce que le type `integer` protège — et ce qu'il ne protège pas
-- ---------------------------------------------------------------------------

-- Piège vérifié plutôt que supposé : `integer` n'**interdit** pas un décimal,
-- il l'**arrondit**. Un appelant qui passe 89.5 en croyant écrire 89,50 € se
-- retrouve avec 90 centimes, sans la moindre erreur. La colonne ne peut donc
-- pas servir de garde-fou.
insert into public.ledger_entries (id, tenant_id, type, amount_cents, direction)
values ('cccccccc-0000-4000-8000-000000000001',
        'aaaaaaaa-0000-4000-8000-000000000001', 'arrondi', 89.5, 'CREDIT');

select is(
  (select amount_cents from public.ledger_entries
   where id = 'cccccccc-0000-4000-8000-000000000001'),
  90,
  'integer arrondit un décimal au lieu de le rejeter — la garde est côté Zod, pas côté colonne'
);

-- Ce qui est réellement interdit par le type : une valeur non numérique.
select throws_ok(
  $$insert into public.ledger_entries (tenant_id, type, amount_cents, direction)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'texte', 'quatre-vingt-neuf', 'CREDIT')$$,
  '22P02',
  null,
  'une valeur non numérique est refusée par le type'
);

-- ---------------------------------------------------------------------------
-- consents — preuve légale, donc ni effaçable ni réécrivable par son sujet
-- ---------------------------------------------------------------------------

-- La box est responsable de prouver le consentement de ses membres. Si le membre
-- pouvait supprimer ou réécrire la ligne, la policy d'accountability ne
-- protégerait rien : elle est en lecture seule côté box.
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

-- Le refus a changé de couche avec D-006. Il venait de l'absence de policy —
-- l'ordre passait, n'affectait aucune ligne, et c'était le compte inchangé qui
-- prouvait la garde. Il vient maintenant d'abord du **droit de table**, qui
-- n'est plus accordé : l'ordre lève, une couche plus tôt et plus bruyamment.
--
-- Ce que ces assertions ne prouvent donc plus, c'est la policy elle-même,
-- devenue inatteignable depuis `authenticated`. C'est `rls_leak_test.sql` qui
-- s'en charge : il vérifie que chaque table porte ses policies **et** que
-- droits et policies se correspondent exactement.
select throws_ok(
  $$delete from public.consents where user_id = '33333333-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'un membre ne peut pas effacer la preuve de son consentement'
);

select throws_ok(
  $$update public.consents set granted = false, policy_version = 'FALSIFIÉ'
    where user_id = '33333333-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'un membre ne peut pas réécrire un consentement en place'
);

select is(
  (select count(*) from public.consents)::int,
  2,
  'et la preuve est toujours là, intacte'
);

-- Se rétracter reste possible, et aussi simple que consentir : c'est une
-- nouvelle ligne, pas une modification.
select lives_ok(
  $$insert into public.consents (user_id, tenant_id, purpose, granted, policy_version)
    values ('33333333-0000-4000-8000-000000000001',
            'aaaaaaaa-0000-4000-8000-000000000001', 'BOX_TERMS', false, '2026-08-01')$$,
  'la rétractation s''enregistre comme une nouvelle ligne'
);

reset role;

select * from finish();
rollback;
