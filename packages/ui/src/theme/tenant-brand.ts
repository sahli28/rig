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
 * Les formes attendues sont décrites structurellement : `@rig/ui` n'a pas besoin
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

/** Ce que `tenant_public_profile()` rend, colonnes de table telles quelles. */
export interface TenantPublicProfileRow {
  app_name: string;
  logo_url: string | null;
  primary_color: string;
  radius: number;
  font: string;
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
    primary: profile.primary_color,
    radius: profile.radius,
    font: profile.font,
  };
}

/**
 * Marque à appliquer quand aucune box n'est encore résolue : ouverture à froid
 * sans lien d'invitation, ou slug inconnu. Le thème RIG neutre, jamais celui de
 * la dernière box vue — afficher les couleurs d'une box qu'on ne rejoindra
 * peut-être pas serait un mensonge visuel.
 */
export function brandOrDefault(brand: TenantBrand | null | undefined): TenantBrand {
  return brand ?? DEFAULT_BRAND;
}
