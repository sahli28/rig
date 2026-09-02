-- Ce qu'une page publique d'invitation a le droit de savoir.
--
-- `invitations` n'est lisible que par OWNER et MANAGER, ce qui est correct — et
-- ce qui rend une page d'acceptation impossible sans une porte dédiée. Voici
-- cette porte, taillée sur le même patron que `tenant_public_profile()` :
-- `security definer`, **un seul paramètre**, et rien qui vienne du client
-- n'influence la sélection des lignes autrement que par le jeton lui-même.
--
-- Aucune fuite nouvelle : qui détient le jeton détient déjà l'invitation, et le
-- jeton fait 192 bits. L'e-mail, lui, sort **masqué** — jamais en clair.
--
-- La recherche se fait par **empreinte**, comme `accept_invitation()` : le clair
-- n'existe nulle part en base (D-005).

-- ---------------------------------------------------------------------------
-- invitation_preview — le branding, le rôle proposé, et l'e-mail masqué
-- ---------------------------------------------------------------------------

-- Les sept premières colonnes reprennent **exactement** la forme de
-- `tenant_public_profile()`, pour que `brandFromPublicProfile()` de
-- `@rig/ui/theme` se réutilise tel quel plutôt que d'avoir une seconde
-- conversion à tenir.
--
-- **Zéro ligne** pour un jeton inconnu, expiré, déjà consommé, révoqué, ou dont
-- la box est fermée. Les cinq cas sont indiscernables par construction, et
-- l'écran n'a qu'un seul message : « invitation invalide ou expirée ». Même
-- discipline que « box inconnue ou accès refusé » — distinguer, ce serait
-- répondre à qui essaie des jetons au hasard.
create or replace function public.invitation_preview(p_token text)
returns table (
  slug text,
  name text,
  app_name text,
  logo_url text,
  primary_color text,
  radius integer,
  font text,
  role public.membership_role,
  nominative boolean,
  email_masked text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.slug,
    t.name,
    th.app_name,
    th.logo_url,
    th.primary_color,
    th.radius,
    th.font,
    i.role,
    i.email is not null as nominative,
    -- `l***@rueil.example` : assez pour reconnaître son adresse, pas assez pour
    -- la découvrir. `split_part` rend une chaîne vide si l'adresse est
    -- malformée, ce qui donne un masque inutile plutôt qu'une erreur.
    case
      when i.email is null then null
      else left(split_part(i.email::text, '@', 1), 1) || '***@' ||
           split_part(i.email::text, '@', 2)
    end as email_masked
  from public.invitations i
  join public.tenants t on t.id = i.tenant_id
  join public.themes th on th.tenant_id = t.id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and i.status = 'PENDING'
    and i.expires_at > now()
    and t.status = 'ACTIVE'
    and t.deleted_at is null;
$$;

comment on function public.invitation_preview(text) is
  'Aperçu public d''une invitation, par son jeton. Rend zéro ligne pour un jeton inconnu, expiré, consommé ou d''une box fermée — les quatre sont indiscernables à dessein. L''e-mail sort masqué.';

revoke execute on function public.invitation_preview(text) from public;
grant execute on function public.invitation_preview(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- invitation_accepts_email — la sœur sans laquelle le masque ne sert à rien
-- ---------------------------------------------------------------------------

-- Sans elle, le piège est le suivant : une invitation nominative pour
-- `lea@example.com`, quelqu'un saisit une autre adresse, reçoit son lien
-- magique, **un compte est créé** (`shouldCreateUser: true` est indispensable
-- pour un nouveau membre), puis `accept_invitation()` refuse en
-- `INVITATION_EMAIL_MISMATCH`. La personne se retrouve avec un compte et sans
-- appartenance, sans comprendre pourquoi.
--
-- La vérification doit donc avoir lieu **avant l'envoi du lien**. Elle ne
-- divulgue rien de plus que le masque : il faut déjà détenir le jeton, et la
-- réponse est un booléen sur une adresse que l'appelant a lui-même proposée.
--
-- Un jeton invalide rend `false`, comme une adresse qui ne correspond pas : là
-- encore, un seul message à l'écran.
create or replace function public.invitation_accepts_email(p_token text, p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select i.email is null or lower(i.email::text) = lower(trim(p_email))
     from public.invitations i
     join public.tenants t on t.id = i.tenant_id
     where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
       and i.status = 'PENDING'
       and i.expires_at > now()
       and t.status = 'ACTIVE'
       and t.deleted_at is null),
    false
  );
$$;

comment on function public.invitation_accepts_email(text, text) is
  'Vrai si l''invitation est ouverte à cette adresse. Contrôlée AVANT l''envoi du lien magique, sinon une adresse non correspondante crée un compte orphelin.';

revoke execute on function public.invitation_accepts_email(text, text) from public;
grant execute on function public.invitation_accepts_email(text, text) to anon, authenticated;
