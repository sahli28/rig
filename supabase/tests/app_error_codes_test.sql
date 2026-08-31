-- Les erreurs métier portent un code applicatif exploitable par le client.
--
-- `.claude/rules/api.md` impose que le client réagisse au **code**, jamais au
-- texte. En appel RPC direct (ADR 0004), ce qui remonte est le SQLSTATE — et
-- `check_violation` sert à cinq erreurs métier distinctes. Sans code applicatif,
-- le client n'aurait que le message français à inspecter.

begin;
select plan(9);

-- Extrait le code applicatif du champ `detail`, celui que PostgREST expose.
create or replace function pg_temp.code_of(p_sql text)
returns text
language plpgsql
as $$
declare
  v_detail text;
begin
  execute p_sql;
  return null;  -- pas d'erreur levée
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return (v_detail::jsonb) ->> 'code';
end;
$$;

-- Extrait le SQLSTATE, pour montrer la collision que les codes résolvent.
create or replace function pg_temp.sqlstate_of(p_sql text)
returns text
language plpgsql
as $$
declare
  v_state text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics v_state = returned_sqlstate;
  return v_state;
end;
$$;

insert into public.invitations (tenant_id, email, role, token, expires_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'lea@example.com', 'MEMBER', 'tok-perime',
   now() - interval '1 day'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'lea@example.com', 'MEMBER', 'tok-consomme',
   now() + interval '7 days');
update public.invitations set status = 'ACCEPTED' where token = 'tok-consomme';

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

-- ---------------------------------------------------------------------------
-- Le problème que les codes résolvent
-- ---------------------------------------------------------------------------

select is(
  pg_temp.sqlstate_of($$select public.accept_invitation('tok-perime')$$),
  pg_temp.sqlstate_of($$select public.accept_invitation('tok-consomme')$$),
  'deux erreurs métier distinctes partagent le même SQLSTATE'
);

select isnt(
  pg_temp.code_of($$select public.accept_invitation('tok-perime')$$),
  pg_temp.code_of($$select public.accept_invitation('tok-consomme')$$),
  '…mais des codes applicatifs distincts : le client peut les différencier'
);

-- ---------------------------------------------------------------------------
-- Les codes eux-mêmes
-- ---------------------------------------------------------------------------

select is(
  pg_temp.code_of($$select public.accept_invitation('tok-perime')$$),
  'INVITATION_EXPIRED',
  'invitation expirée'
);

select is(
  pg_temp.code_of($$select public.accept_invitation('tok-consomme')$$),
  'INVITATION_ALREADY_USED',
  'invitation déjà utilisée'
);

select is(
  pg_temp.code_of($$select public.accept_invitation('tok-inconnu')$$),
  'INVITATION_NOT_FOUND',
  'jeton inconnu'
);

select is(
  pg_temp.code_of($$select public.create_tenant('Box', 'Slug Invalide')$$),
  'TENANT_SLUG_INVALID',
  'nom d''URL invalide'
);

select is(
  pg_temp.code_of($$select public.create_tenant('Box', 'crossfit-rueil')$$),
  'TENANT_SLUG_TAKEN',
  'nom d''URL déjà pris'
);

select is(
  pg_temp.code_of($$select public.set_member_role('a3000000-0000-4000-8000-000000000002', 'OWNER')$$),
  'FORBIDDEN_ROLE',
  'rôle insuffisant'
);

select is(
  pg_temp.code_of($$select public.log_audit('bbbbbbbb-0000-4000-8000-000000000001', 'x', 'y')$$),
  'NOT_TENANT_MEMBER',
  'journalisation hors de sa box'
);

reset role;

select * from finish();
rollback;
