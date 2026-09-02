/**
 * Apparence de la box — ce que l'écran de branding écrit dans `themes`.
 *
 * Réservé à l'OWNER : la spec §5.2 exclut le gestionnaire du white-label, et la
 * policy `themes_update` le dit déjà en base. Ce fichier ne porte que la forme.
 *
 * `logo_url` n'y est **pas**. La colonne existe, mais l'exposer dans un
 * formulaire ferait charger une ressource distante arbitraire dans le navigateur
 * des membres — lien mort, hotlinking, contenu mixte, pixel de suivi. Le
 * téléversement passera par Storage (P1-001f), avec son bucket et ses limites.
 */

import { z } from 'zod';

/**
 * Polices proposées.
 *
 * Une liste, pas un champ libre : une famille arbitraire ne se charge pas,
 * `--rig-font-family` retombe sur `system-ui`, et la box croirait avoir changé
 * quelque chose. Celles-ci sont présentes sur les systèmes courants ou se
 * dégradent sur une famille générique du même genre.
 *
 * Charger de vraies webfonts est un autre sujet : il faut les servir, les
 * précharger, et accepter le coût réseau sur le premier écran.
 */
export const FONT_OPTIONS = [
  'Inter',
  'system-ui',
  'Georgia',
  'Verdana',
  'Trebuchet MS',
  'Courier New',
] as const;

/**
 * La police enregistrée est toujours proposée, même hors liste — sinon une box
 * réglée autrement la perdrait au premier enregistrement, silencieusement.
 * Même raison que `timeZoneOptions()`.
 */
export function fontOptions(current: string): string[] {
  const options = [...FONT_OPTIONS];
  return options.includes(current as (typeof FONT_OPTIONS)[number])
    ? options
    : [current, ...options];
}

/**
 * Couleur d'une box **pas encore configurée**.
 *
 * Elle reprend le défaut de la colonne `themes.primary_color`, et ne sert que
 * dans un cas que la base ne produit pas : une box **sans ligne de branding du
 * tout**. `create_tenant()` en insère toujours une ; ce repli existe parce
 * qu'une jointure interne sur `themes` nous a déjà coûté un défaut (P1-001c),
 * et qu'on ne suppose plus que la ligne est là.
 *
 * À ne pas confondre avec `DEFAULT_BRAND.primary` de `@rig/ui/theme`, qui est
 * la couleur de **RIG** avant qu'une box soit résolue. Deux concepts, deux
 * valeurs — c'était tout l'objet de la migration qui les a séparés.
 */
export const UNCONFIGURED_BOX_PRIMARY = '#4A5568';

/**
 * Miroir des contraintes de `themes` : `themes_primary_color_hex` et
 * `themes_radius_sane` (0 à 48).
 *
 * **La couleur est enregistrée telle que la box la saisit.** La correction de
 * contraste se fait à l'affichage, dans `buildTheme()` — jamais avant l'écriture.
 * Corriger en base ferait perdre le choix de la box, et l'écran ne pourrait plus
 * expliquer l'écart entre ce qui a été demandé et ce qui s'affiche.
 */
export const BoxAppearanceSchema = z.object({
  app_name: z.string().trim().min(1).max(60),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  radius: z.number().int().min(0).max(48),
  font: z.string().trim().min(1).max(60),
});

export type BoxAppearance = z.infer<typeof BoxAppearanceSchema>;
