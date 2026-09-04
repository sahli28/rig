/**
 * Passerelle vers le web : le back-office Next n'utilise pas les composants
 * React Native, mais il doit porter exactement les mêmes couleurs que l'app
 * membre. On expose donc le thème en variables CSS, et le CSS du web s'y branche.
 *
 * C'est ce qui permet à `packages/ui` de rester la seule source de vérité du
 * white-label sans imposer React Native au web.
 */

import type { Theme } from './tokens';

const PREFIX = '--rack';

export function themeToCssVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {
    [`${PREFIX}-color-primary`]: theme.colors.primary,
    [`${PREFIX}-color-on-primary`]: theme.colors.onPrimary,
    [`${PREFIX}-color-surface`]: theme.colors.surface,
    [`${PREFIX}-color-surface-2`]: theme.colors.surface2,
    [`${PREFIX}-color-text`]: theme.colors.text,
    [`${PREFIX}-color-text-muted`]: theme.colors.textMuted,
    [`${PREFIX}-color-border`]: theme.colors.border,
    [`${PREFIX}-color-success`]: theme.colors.success,
    [`${PREFIX}-color-warning`]: theme.colors.warning,
    [`${PREFIX}-color-danger`]: theme.colors.danger,
    [`${PREFIX}-color-on-danger`]: theme.colors.onDanger,
    [`${PREFIX}-color-overlay`]: theme.colors.overlay,
    [`${PREFIX}-radius-sm`]: `${theme.radius.sm}px`,
    [`${PREFIX}-radius-md`]: `${theme.radius.md}px`,
    [`${PREFIX}-radius-lg`]: `${theme.radius.lg}px`,
    [`${PREFIX}-radius-full`]: `${theme.radius.full}px`,
    [`${PREFIX}-font-family`]: theme.fontFamily,
    [`${PREFIX}-touch-target`]: `${theme.minTouchTarget}px`,
  };

  for (const [name, size] of Object.entries(theme.typography)) {
    vars[`${PREFIX}-text-${name}`] = `${size}px`;
  }

  return vars;
}

/** Rend les variables sous forme de bloc `:root { … }` injectable en SSR. */
export function themeToCssRule(theme: Theme, selector = ':root'): string {
  const body = Object.entries(themeToCssVars(theme))
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
  return `${selector} {\n${body}\n}`;
}
