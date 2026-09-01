-- Les jetons d'invitation sont des empreintes, pas des jetons.
--
-- Chaque ligne de `invitations` était un identifiant **vivant** : la présenter à
-- `accept_invitation()` ouvrait une appartenance. Le critère de D-005 — « un dump
-- ne permet pas de rejouer un jeton » — se prouve donc en prenant la valeur
-- **telle qu'elle est en base** et en la rejouant. C'est le premier test
-- ci-dessous, et c'est celui qui compte.

begin;
select plan(15);

-- Extrait le code applicatif du champ `detail`, comme dans app_error_codes_test.
create or replace function pg_temp.code_of(p_sql text)
returns text
language plpgsql
as $$
declare
  v_detail text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return (v_detail::jsonb) ->> 'code';
end;
$$;

-- ---------------------------------------------------------------------------
-- Le scénario du dump
-- ---------------------------------------------------------------------------

-- La valeur stockée pour l'invitation du seed, lue sans détour.
create temporary table volee as
select token_hash from public.invitations
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'
limit 1;

-- Les tables temporaires appartiennent à `postgres` : sans grant, la session
-- `authenticated` plus bas ne peut pas les lire. Même détail qu'en D-006 sur
-- `business_views`.
grant select on volee to authenticated;

select isnt(
  (select token_hash from volee),
  'inv-rueil-0001',
  'la base ne contient pas le jeton en clair'
);

select is(
  (select length(token_hash) from volee),
  64,
  'mais son empreinte SHA-256, en hexadécimal'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-0000-4000-8000-000000000001","role":"authenticated","email":"thomas@example.com"}';

-- Le cœur du ticket : rejouer ce qu'un dump aurait livré ne donne rien.
select is(
  pg_temp.code_of(format('select public.accept_invitation(%L)', (select token_hash from volee))),
  'INVITATION_NOT_FOUND',
  'rejouer la valeur stockée ne vaut rien : un dump ne rend pas les jetons utilisables'
);

reset role;

-- ---------------------------------------------------------------------------
-- create_invitation() — la matrice de rôles
-- ---------------------------------------------------------------------------

-- Léa, simple MEMBER.
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select is(
  pg_temp.code_of($$select public.create_invitation('aaaaaaaa-0000-4000-8000-000000000001')$$),
  'FORBIDDEN_ROLE',
  'un MEMBER ne crée pas d''invitation'
);

-- Sarah, COACH.
set local request.jwt.claims = '{"sub":"44444444-0000-4000-8000-000000000001","role":"authenticated","email":"sarah@example.com"}';

select is(
  pg_temp.code_of($$select public.create_invitation('aaaaaaaa-0000-4000-8000-000000000001')$$),
  'FORBIDDEN_ROLE',
  'un COACH non plus : inviter n''est pas dans sa matrice'
);

-- Hugo, MANAGER de Rueil.
set local request.jwt.claims = '{"sub":"77777777-0000-4000-8000-000000000001","role":"authenticated","email":"hugo@rueil.example"}';

select is(
  pg_temp.code_of(
    $$select public.create_invitation('aaaaaaaa-0000-4000-8000-000000000001', null, 'OWNER')$$),
  'MANAGER_CANNOT_GRANT_ROLE',
  'un MANAGER n''invite pas au rôle OWNER'
);

select lives_ok(
  $$select public.create_invitation('aaaaaaaa-0000-4000-8000-000000000001', null, 'COACH')$$,
  'mais il invite bien au rôle COACH'
);

-- Hugo n'est que MEMBER de Nanterre : la fonction doit le voir.
select is(
  pg_temp.code_of($$select public.create_invitation('bbbbbbbb-0000-4000-8000-000000000001')$$),
  'FORBIDDEN_ROLE',
  'et n''invite pas dans la box où il n''est que membre'
);

reset role;

-- ---------------------------------------------------------------------------
-- Le jeton rendu, et lui seul, fonctionne
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

create temporary table jeton as
select public.create_invitation(
  'aaaaaaaa-0000-4000-8000-000000000001', 'thomas@example.com', 'MEMBER') as clair;

grant select on jeton to authenticated;

-- L'invitant n'est pas un paramètre : la fonction le dérive d'`auth.uid()`.
-- L'`insert` direct laissait l'appelant écrire n'importe quel invitant, ou aucun.
select is(
  (select i.invited_by::text from public.invitations i
   where i.token_hash = encode(extensions.digest((select clair from jeton), 'sha256'), 'hex')),
  'a3000000-0000-4000-8000-000000000001',
  'invited_by est dérivé de la session, pas reçu de l''appelant'
);

select is(
  (select count(*) from public.invitations
   where token_hash = (select clair from jeton))::int,
  0,
  'le jeton rendu n''est stocké nulle part en clair'
);

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-0000-4000-8000-000000000001","role":"authenticated","email":"thomas@example.com"}';

select lives_ok(
  format('select public.accept_invitation(%L)', (select clair from jeton)),
  'le jeton rendu par create_invitation() est accepté'
);

-- `INVITATION_ALREADY_USED` et non `ALREADY_MEMBER` : le jeton est marqué
-- consommé avant même que la fonction regarde l'appartenance. C'est le bon ordre
-- — ce qui est épuisé, c'est le jeton, et c'est ce que la personne doit lire.
select is(
  pg_temp.code_of(format('select public.accept_invitation(%L)', (select clair from jeton))),
  'INVITATION_ALREADY_USED',
  'et ne resert pas une seconde fois : le jeton est à usage unique'
);

reset role;

-- ---------------------------------------------------------------------------
-- Entropie et box fermée
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select isnt(
  public.create_invitation('aaaaaaaa-0000-4000-8000-000000000001'),
  public.create_invitation('aaaaaaaa-0000-4000-8000-000000000001'),
  'deux appels rendent deux jetons distincts'
);

reset role;

update public.tenants set status = 'CLOSED'
where id = 'bbbbbbbb-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-0000-4000-8000-000000000001","role":"authenticated","email":"claire@nanterre.example"}';

select is(
  pg_temp.code_of($$select public.create_invitation('bbbbbbbb-0000-4000-8000-000000000001')$$),
  'TENANT_CLOSED',
  'une box fermée n''émet plus d''invitation'
);

reset role;

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------

set local role anon;

select throws_ok(
  $$select public.create_invitation('aaaaaaaa-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'anon ne peut pas appeler create_invitation : le grant s''arrête à authenticated'
);

reset role;

select * from finish();
rollback;
