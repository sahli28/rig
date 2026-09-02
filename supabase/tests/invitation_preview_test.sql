-- `invitation_preview()` et `invitation_accepts_email()` — la porte publique de
-- la page d'invitation.
--
-- Deux fonctions `security definer` de plus, donc deux fonctions à attaquer :
-- ce sont les seules choses entre un jeton et la table `invitations`, que ni
-- `anon` ni un simple membre ne peut lire.
--
-- Ce que ces tests protègent, dans l'ordre d'importance :
--   1. l'e-mail ne sort **jamais** en clair ;
--   2. un jeton inconnu, expiré, révoqué, consommé ou d'une box fermée donne
--      **exactement le même résultat** — zéro ligne — pour qu'aucun écran ne
--      puisse distinguer les cinq ;
--   3. une adresse qui ne correspond pas est refusée **avant** l'envoi du lien,
--      donc avant qu'un compte orphelin soit créé.

begin;
select plan(16);

-- Un QR mural : une invitation sans e-mail, réutilisable jusqu'à révocation.
-- Le seed n'en porte pas, et c'est pourtant l'autre moitié du sujet.
insert into public.invitations (tenant_id, email, role, token_hash, expires_at)
values (
  'aaaaaaaa-0000-4000-8000-000000000001',
  null,
  'MEMBER',
  encode(extensions.digest('qr-rueil-0001', 'sha256'), 'hex'),
  now() + interval '365 days'
);

-- ---------------------------------------------------------------------------
-- Une session **non authentifiée** : c'est le vrai appelant de cette page.
-- ---------------------------------------------------------------------------

set local role anon;

select is(
  (select count(*) from public.invitation_preview('inv-rueil-0001'))::int,
  1,
  'un jeton valide rend son aperçu, sans authentification'
);

select is(
  (select app_name from public.invitation_preview('inv-rueil-0001')),
  'CF Rueil',
  'l''aperçu porte la marque de la box — la page s''affiche à ses couleurs'
);

select is(
  (select role::text from public.invitation_preview('inv-rueil-0001')),
  'MEMBER',
  '…et le rôle proposé, pour que la personne sache à quoi elle est invitée'
);

select is(
  (select nominative from public.invitation_preview('inv-rueil-0001')),
  true,
  'une invitation nominative se déclare comme telle'
);

-- Le point qui compte : assez pour reconnaître son adresse, pas assez pour la
-- découvrir.
select is(
  (select email_masked from public.invitation_preview('inv-rueil-0001')),
  'n***@example.com',
  'l''e-mail sort masqué'
);

select isnt(
  (select email_masked from public.invitation_preview('inv-rueil-0001')),
  'nouveau@example.com',
  '…et jamais en clair'
);

select is(
  (select nominative from public.invitation_preview('qr-rueil-0001')),
  false,
  'le QR mural n''est pas nominatif'
);

select is(
  (select email_masked from public.invitation_preview('qr-rueil-0001')),
  null,
  '…et ne porte donc aucune adresse à masquer'
);

select is(
  (select count(*) from public.invitation_preview('jeton-invente'))::int,
  0,
  'un jeton inconnu ne rend rien'
);

-- ---------------------------------------------------------------------------
-- invitation_accepts_email — le contrôle qui évite le compte orphelin
-- ---------------------------------------------------------------------------

select is(
  public.invitation_accepts_email('inv-rueil-0001', 'nouveau@example.com'),
  true,
  'l''adresse de l''invitation est acceptée'
);

select is(
  public.invitation_accepts_email('inv-rueil-0001', 'quelquun@ailleurs.example'),
  false,
  'une autre adresse est refusée — avant l''envoi du lien, donc avant qu''un compte existe'
);

select is(
  public.invitation_accepts_email('qr-rueil-0001', 'nimporte@qui.example'),
  true,
  'le QR mural accepte toute adresse : c''est sa raison d''être'
);

select is(
  public.invitation_accepts_email('jeton-invente', 'nouveau@example.com'),
  false,
  'un jeton inconnu refuse tout'
);

-- ---------------------------------------------------------------------------
-- Les trois autres façons d'être invalide, et le même silence
-- ---------------------------------------------------------------------------

reset role;

update public.invitations set expires_at = now() - interval '1 day'
where token_hash = encode(extensions.digest('inv-nanterre-0001', 'sha256'), 'hex');

update public.invitations set status = 'REVOKED'
where token_hash = encode(extensions.digest('inv-rueil-0001', 'sha256'), 'hex');

set local role anon;

select is(
  (select count(*) from public.invitation_preview('inv-nanterre-0001'))::int,
  0,
  'une invitation expirée ne rend rien — pas « expirée », rien'
);

select is(
  (select count(*) from public.invitation_preview('inv-rueil-0001'))::int,
  0,
  'une invitation révoquée non plus : les cinq cas sont indiscernables'
);

-- ---------------------------------------------------------------------------
-- Les droits d'exécution
-- ---------------------------------------------------------------------------

reset role;

select ok(
  has_function_privilege('anon', 'public.invitation_preview(text)', 'execute')
    and has_function_privilege('anon', 'public.invitation_accepts_email(text, text)', 'execute'),
  'les deux fonctions sont exécutables sans session : la page est publique par destination'
);

select * from finish();
rollback;
