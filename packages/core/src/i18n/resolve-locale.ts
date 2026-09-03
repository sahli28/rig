/**
 * D-004 — quelle langue afficher, et qui a raison quand deux sources se
 * contredisent.
 *
 * La question n'était pas tranchée : le mobile lisait la langue de l'appareil,
 * le web lisait `localStorage`, et `users.locale` — la seule source où quelqu'un
 * a *dit* quelque chose, déjà téléchargée par `me()` — n'était lue nulle part.
 *
 * Quatre rangs, du plus fort au plus faible :
 *
 * 1. **la préférence enregistrée sur l'appareil.** Un choix explicite et récent
 *    l'emporte sur tout ;
 * 2. **`users.locale`, le profil serveur.** Un choix explicite fait ailleurs :
 *    c'est lui qui rend la langue cohérente entre le web et le mobile pour la
 *    même personne ;
 * 3. **la langue de l'appareil.** Une préférence réelle, mais qui n'est pas à
 *    propos de ce produit ;
 * 4. **le repli**, qui ne s'applique qu'aux cas où l'on ne sait rien.
 *
 * Tout est pur et sans React : la mécanique de « quand » chaque source arrive
 * appartient aux applications, la règle de « qui gagne » appartient ici.
 */

import { FALLBACK_LOCALE, isLocale, type Locale } from './types';

/**
 * Comme `localeFromTag`, mais rend `null` plutôt que le repli quand l'étiquette
 * ne désigne aucune langue gérée.
 *
 * La distinction est ce qui rend la résolution possible : `localeFromTag('de')`
 * rend `'fr'`, ce qui est le bon comportement pour *afficher* quelque chose,
 * et le mauvais pour *choisir* entre plusieurs sources — un rang répondrait
 * toujours, et aucun ne passerait jamais la main au suivant.
 */
export function localeFromTagOrNull(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  const base = tag.replace('_', '-').split('-')[0]?.toLowerCase() ?? '';
  return isLocale(base) ? base : null;
}

export interface LocaleSources {
  /** Rang 1 — préférence enregistrée sur l'appareil (trousseau, `localStorage`). */
  stored?: string | null;
  /** Rang 2 — `users.locale`, rendu par `me()`. Disponible après authentification seulement. */
  profile?: string | null;
  /** Rang 3 — langue de l'appareil ou du navigateur, en étiquette BCP-47. */
  device?: string | null;
}

/** La langue à afficher, une fois les sources connues. */
export function resolveLocale({ stored, profile, device }: LocaleSources): Locale {
  return (
    localeFromTagOrNull(stored) ??
    localeFromTagOrNull(profile) ??
    localeFromTagOrNull(device) ??
    FALLBACK_LOCALE
  );
}

/**
 * La langue à réécrire dans `users.locale`, ou `null` s'il n'y a rien à faire.
 *
 * Une préférence posée sur un appareil l'emporte sur le profil (rang 1), mais si
 * elle s'arrête là, les deux sources divergent en silence : le web et le
 * téléphone suivant continuent d'afficher l'ancienne langue du compte. La
 * réconciliation est donc la contrepartie du rang 1, pas une commodité.
 *
 * Elle ne va que dans un sens. Un appareil sans préférence n'a rien à imposer au
 * compte — écrire ici renverserait les deux premiers rangs.
 */
export function profileLocaleToSync(
  stored: Locale | null,
  profile: string | null | undefined,
): Locale | null {
  if (stored === null) return null;
  return localeFromTagOrNull(profile) === stored ? null : stored;
}
