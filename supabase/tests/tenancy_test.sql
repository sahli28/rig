-- Test anti-fuite **comportemental**.
--
-- Le test structurel prouve que les policies existent ; celui-ci prouve
-- qu'elles font ce qu'on croit. Il s'appuie sur les identifiants figés du seed
-- (`supabase/seed.sql`) : deux boxes, Léa dans la seule box A, Thomas dans la
-- seule box B, Julie dans les deux.

begin;
select plan(23);

-- ---------------------------------------------------------------------------
-- Session de Léa — membre de la box A uniquement
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

-- Le piège n°1 du multi-tenant Supabase : la policy de `memberships` appelle
-- `current_tenant_ids()`, qui lit `memberships`. Si la fonction n'était pas
-- `security definer`, cette simple ligne lèverait
-- « infinite recursion detected in policy for relation memberships ».
select lives_ok(
  'select count(*) from public.memberships',
  'lire memberships ne déclenche pas de récursion de policy'
);

select is(
  (select count(*) from public.tenants)::int,
  1,
  'Léa ne voit que sa box'
);

select is(
  (select count(*) from public.tenants where id = 'bbbbbbbb-0000-4000-8000-000000000001')::int,
  0,
  'la box B est invisible pour Léa'
);

select is(
  (select count(*) from public.memberships
   where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001')::int,
  0,
  'aucune appartenance de la box B ne fuit'
);

select is(
  (select count(*) from public.rooms
   where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001')::int,
  0,
  'aucune salle de la box B ne fuit'
);

-- Ces deux tables ne sont plus lisibles par un MEMBER du tout, depuis que la
-- garde de rôle a été posée (D-001). Les tester ici ne prouverait donc plus
-- l'isolation entre boxes — l'assertion passerait même si la table était vide.
-- Elles sont vérifiées plus bas, sous une session qui peut réellement les lire.
select is(
  (select count(*) from public.ledger_entries)::int,
  0,
  'un MEMBER ne lit aucune écriture comptable, pas même celles de sa propre box'
);

select is(
  (select count(*) from public.users)::int,
  1,
  'Léa ne voit qu''elle-même dans users'
);

select is(
  (select count(*) from public.processed_webhook_events)::int,
  0,
  'la table d''infrastructure est invisible, RLS forcée sans policy'
);

-- Balayage exhaustif plutôt que quelques tables choisies : une fuite se loge
-- toujours dans celle qu'on n'a pas pensé à tester.
select is(
  (select count(*) from public.themes
   where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001')::int,
  0,
  'aucun thème de la box B ne fuit'
);

select is(
  (select count(*) from public.tenant_settings
   where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001')::int,
  0,
  'aucun réglage de la box B ne fuit'
);

select is(
  (select count(*) from public.locations
   where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001')::int,
  0,
  'aucune adresse de la box B ne fuit'
);

select is(
  (select count(*) from public.audit_logs)::int,
  0,
  'un MEMBER ne lit aucune entrée d''audit, pas même celles de sa propre box'
);

select is(
  (select count(*) from public.invitations
   where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001')::int,
  0,
  'aucune invitation de la box B ne fuit'
);

-- `consents` est la table hybride : Léa voit ses consentements plateforme
-- (`tenant_id null`) et ceux de sa box, ceux des autres jamais.
select is(
  (select count(*) from public.consents
   where user_id <> '33333333-0000-4000-8000-000000000001')::int,
  0,
  'aucun consentement d''une autre personne ne fuit'
);

select ok(
  (select count(*) from public.consents where tenant_id is null) > 0,
  'ses propres consentements plateforme restent visibles malgré tenant_id null'
);

select is(
  (select count(*) from public.devices
   where user_id <> '33333333-0000-4000-8000-000000000001')::int,
  0,
  'aucun appareil d''une autre personne ne fuit'
);

-- ---------------------------------------------------------------------------
-- Écriture : le `with check` doit refuser l'entrée dans une autre box
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.locations (tenant_id, name)
    values ('bbbbbbbb-0000-4000-8000-000000000001', 'Salle pirate')$$,
  '42501',
  null,
  'insérer dans la box B depuis une session de la box A est refusé par with check'
);

-- `memberships` n'a aucune policy `insert` : même dans sa propre box, l'insertion
-- directe est refusée. C'est voulu — seules create_tenant() et
-- accept_invitation() créent des appartenances.
select throws_ok(
  $$insert into public.memberships (tenant_id, user_id, role)
    values ('aaaaaaaa-0000-4000-8000-000000000001',
            '55555555-0000-4000-8000-000000000001', 'MEMBER')$$,
  '42501',
  null,
  'insérer une appartenance en direct est refusé, même dans sa propre box'
);

reset role;

-- ---------------------------------------------------------------------------
-- Session de Julie — membre des DEUX boxes
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"66666666-0000-4000-8000-000000000001","role":"authenticated","email":"julie@example.com"}';

-- Conséquence directe du prédicat par appartenance, et propriété recherchée :
-- le Box Switcher de P0-005 fonctionne sans réémettre de jeton.
select is(
  (select count(*) from public.tenants)::int,
  2,
  'un membre de deux boxes voit ses deux boxes'
);

reset role;

-- ---------------------------------------------------------------------------
-- Session de Marc — OWNER de la box A
-- ---------------------------------------------------------------------------
--
-- Le balayage de Léa ne peut plus rien dire du journal d'audit ni de la
-- comptabilité : ces deux tables lui sont fermées par rôle. L'isolation entre
-- boxes s'y vérifie donc sous quelqu'un qui a le droit de les lire — sinon on
-- prouverait l'absence de fuite en n'ayant accès à rien, ce qui ne prouve rien.

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select is(
  (select count(*) from public.audit_logs
   where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001')::int,
  0,
  'aucune entrée d''audit de la box B ne fuit vers le propriétaire de la box A'
);

select is(
  (select count(*) from public.ledger_entries
   where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001')::int,
  0,
  'aucune écriture comptable de la box B ne fuit vers le propriétaire de la box A'
);

-- Et il lit bien les siennes : sans cette paire, les deux assertions ci-dessus
-- seraient vraies par simple absence de droits.
select is(
  (select count(*) from public.audit_logs)::int,
  1,
  'alors qu''il lit bien celles de sa propre box'
);

select is(
  (select count(*) from public.ledger_entries)::int,
  1,
  'et ses propres écritures comptables'
);

reset role;

select * from finish();
rollback;
