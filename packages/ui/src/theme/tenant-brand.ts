/**
 * Deux chemins mènent à la marque d'une box, et ils ne nomment pas leurs
 * colonnes pareil :
 *
 * - `tenant_public_profile(slug)`, appelé **avant connexion** pour que l'écran
 *   de bienvenue porte déjà les couleurs de la box ;
 * - `me().current_tenant.theme`, une fois la session ouverte.
 *
 * Le premier rend les colonnes de la table (`primary_color`), le second un objet
 * déjà remanié (`primary`). Les deux se ramènent ici à un `TenantBrand` unique,
 * plutôt que dans chaque écran — un mapping recopié est un mapping qui dérive.
 *
 * Les formes attendues sont décrites structurellement : `@rack/ui` n'a pas besoin
 * de dépendre du client Supabase pour savoir lire un thème.
 */

import { DEFAULT_BRAND, type TenantBrand } from './tokens';

/** Ce que `me()` porte sous `current_tenant.theme`. */
export interface TenantThemeRow {
  app_name: string;
  logo_url: string | null;
  primary: string;
  radius: number;
  font: string;
}

/**
 * Ce que `tenant_public_profile()` et `invitation_preview()` rendent : les
 * colonnes de table telles quelles.
 *
 * **Les colonnes de thème sont nulles quand la box n'a pas de ligne de
 * branding.** Les deux fonctions joignent `themes` en jointure **externe**
 * depuis qu'on a vu ce qu'une jointure interne coûtait : une box sans branding
 * disparaissait de son profil public et ses invitations devenaient
 * « invalides », sans qu'aucun message ne puisse le dire.
 *
 * Le repli est ici et pas en SQL : recopier `'#E4572E'` dans deux fonctions
 * Postgres ferait une seconde source de vérité du white-label.
 */
export interface TenantPublicProfileRow {
  app_name: string;
  logo_url: string | null;
  primary_color: string | null;
  radius: number | null;
  font: string | null;
}

export function brandFromTheme(theme: TenantThemeRow): TenantBrand {
  return {
    appName: theme.app_name,
    logoUrl: theme.logo_url,
    primary: theme.primary,
    radius: theme.radius,
    font: theme.font,
  };
}

export function brandFromPublicProfile(profile: TenantPublicProfileRow): TenantBrand {
  return {
    appName: profile.app_name,
    logoUrl: profile.logo_url,
    primary: profile.primary_color ?? DEFAULT_BRAND.primary,
    radius: profile.radius ?? DEFAULT_BRAND.radius,
    font: profile.font ?? DEFAULT_BRAND.font,
  };
}

/**
 * Marque à appliquer quand aucune box n'est encore résolue : ouverture à froid
 * sans lien d'invitation, ou slug inconnu. Le thème Rack neutre, jamais celui de
 * la dernière box vue — afficher les couleurs d'une box qu'on ne rejoindra
 * peut-être pas serait un mensonge visuel.
 */
export function brandOrDefault(brand: TenantBrand | null | undefined): TenantBrand {
  return brand ?? DEFAULT_BRAND;
}
