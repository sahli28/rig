import { buildTheme, themeToCssRule, DEFAULT_BRAND, type TenantBrand } from '@rig/ui/theme';

/**
 * Injecte le thème de la box en variables CSS, côté serveur.
 *
 * Le web n'utilise pas le kit React Native (spec §12.2) mais il porte
 * exactement les mêmes couleurs : `@rig/ui/theme` reste la seule source de
 * vérité du white-label. Rendu en SSR pour éviter tout flash de thème.
 */
export function ThemeStyle({ brand = DEFAULT_BRAND }: { brand?: TenantBrand }) {
  const css = [
    themeToCssRule(buildTheme(brand, 'light'), ':root'),
    `@media (prefers-color-scheme: dark) {\n${themeToCssRule(buildTheme(brand, 'dark'), ':root')}\n}`,
  ].join('\n\n');

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
