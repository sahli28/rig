-- Une box sans ligne de branding doit rester joignable.
--
-- `tenant_public_profile()` et `invitation_preview()` joignaient `themes` en
-- **jointure interne**. Conséquence : une ligne de branding manquante fait
-- disparaître la box de son propre profil public, et **rend ses invitations
-- « invalides ou expirées »**.
--
-- C'est vrai aujourd'hui que `create_tenant()` en insère toujours une. Mais
-- « aujourd'hui c'est vrai » n'est pas un invariant : une migration, une
-- suppression manuelle, ou un futur P1-001e qui permettrait de réinitialiser
-- l'apparence suffirait. Et le défaut serait **indiagnosticable par
-- construction** — les cinq causes d'invalidité sont indiscernables à dessein,
-- ce qui protège d'un attaquant et aveugle celui qui dépanne.
--
-- Même famille que les gardes qui rendent zéro ligne sans le dire (piège 10 de
-- `.claude/rules/database.md`). Et **les deux fonctions avaient le défaut** :
-- ne corriger que la nouvelle aurait répété exactement le motif que ce dépôt
-- passe son temps à rattraper.
--
-- La réparation est une jointure externe, et le repli vit **là où il vit
-- déjà** : `DEFAULT_BRAND` dans `packages/ui/src/theme/tokens.ts`. Recopier
-- `'#E4572E'` ici en ferait une seconde source de vérité du white-label — ce
-- que la règle 7 de `CLAUDE.md` interdit. Les colonnes de thème peuvent donc
-- sortir **nulles**, et `brandFromPublicProfile()` les comble.
--
-- Seule exception : `app_name` se replie sur le nom de la box, qui est sous la
-- main et vaut mieux que « Rack » pour quelqu'un qu'on invite.

create or replace function public.tenant_public_profile(p_slug text)
returns table (
  slug text,
  name text,
  app_name text,
  logo_url text,
  primary_color text,
  radius integer,
  font text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.slug,
    t.name,
    coalesce(th.app_name, t.name),
    th.logo_url,
    th.primary_color,
    th.radius,
    th.font
  from public.tenants t
  left join public.themes th on th.tenant_id = t.id
  where t.slug = p_slug
    and t.status = 'ACTIVE'
    and t.deleted_at is null;
$$;

comment on function public.tenant_public_profile(text) is
  'Profil public d''une box. Jointure externe sur themes : une box sans branding reste visible, le client comble avec DEFAULT_BRAND.';

-- ---------------------------------------------------------------------------
-- invitation_preview — même correction, plus un masque qui masque vraiment
-- ---------------------------------------------------------------------------

-- Le masque laissait le domaine entier : `l***@rueil.example`. Pour reconnaître
-- son adresse, `l***@r***.example` suffit. Le porteur du jeton connaît déjà
-- l'adresse — mais tant qu'à masquer, autant masquer, et l'écran est public.
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
    coalesce(th.app_name, t.name),
    th.logo_url,
    th.primary_color,
    th.radius,
    th.font,
    i.role,
    i.email is not null as nominative,
    -- `l***@r***.example` : la partie locale **et** le premier libellé du
    -- domaine. Le suffixe reste — c'est lui qui permet de reconnaître son
    -- fournisseur — et un domaine sans point donne simplement `l***@r***`.
    case
      when i.email is null then null
      else
        left(split_part(i.email::text, '@', 1), 1) || '***@' ||
        left(split_part(i.email::text, '@', 2), 1) || '***' ||
        substr(
          split_part(i.email::text, '@', 2),
          length(split_part(split_part(i.email::text, '@', 2), '.', 1)) + 1
        )
    end
  from public.invitations i
  join public.tenants t on t.id = i.tenant_id
  left join public.themes th on th.tenant_id = t.id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and i.status = 'PENDING'
    and i.expires_at > now()
    and t.status = 'ACTIVE'
    and t.deleted_at is null;
$$;

comment on function public.invitation_preview(text) is
  'Aperçu public d''une invitation. Zéro ligne pour un jeton inconnu, expiré, consommé ou d''une box fermée — indiscernables à dessein. L''e-mail sort masqué, domaine compris. Jointure externe sur themes : une box sans branding invite quand même.';
