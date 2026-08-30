import { describe, expect, it } from 'vitest';
import { buildTheme } from './build-theme';
import { themeToCssRule, themeToCssVars } from './css-vars';
import { DEFAULT_BRAND } from './tokens';

const theme = buildTheme(DEFAULT_BRAND, 'light');

describe('themeToCssVars', () => {
  it('expose chaque couleur du thème', () => {
    const vars = themeToCssVars(theme);
    expect(vars['--rig-color-primary']).toBe(theme.colors.primary);
    expect(vars['--rig-color-on-primary']).toBe(theme.colors.onPrimary);
    expect(vars['--rig-color-surface']).toBe(theme.colors.surface);
    expect(vars['--rig-color-surface-2']).toBe(theme.colors.surface2);
    expect(vars['--rig-color-text-muted']).toBe(theme.colors.textMuted);
    expect(vars['--rig-color-overlay']).toBe(theme.colors.overlay);
  });

  it('exprime les tailles en pixels', () => {
    const vars = themeToCssVars(theme);
    expect(vars['--rig-radius-md']).toBe(`${theme.radius.md}px`);
    expect(vars['--rig-text-body']).toBe(`${theme.typography.body}px`);
    expect(vars['--rig-touch-target']).toBe(`${theme.minTouchTarget}px`);
  });

  it('génère une variable par taille typographique', () => {
    const vars = themeToCssVars(theme);
    for (const name of Object.keys(theme.typography)) {
      expect(vars).toHaveProperty(`--rig-text-${name}`);
    }
  });

  it('préfixe toutes les variables, pour ne rien écraser dans la page', () => {
    for (const name of Object.keys(themeToCssVars(theme))) {
      expect(name.startsWith('--rig-')).toBe(true);
    }
  });

  it('suit la couleur de marque', () => {
    const autre = buildTheme({ ...DEFAULT_BRAND, primary: '#16457a' }, 'light');
    expect(themeToCssVars(autre)['--rig-color-primary']).not.toBe(
      themeToCssVars(theme)['--rig-color-primary'],
    );
  });
});

describe('themeToCssRule', () => {
  it('enveloppe les variables dans le sélecteur demandé', () => {
    const rule = themeToCssRule(theme, ':root');
    expect(rule.startsWith(':root {')).toBe(true);
    expect(rule.trimEnd().endsWith('}')).toBe(true);
    expect(rule).toContain(`--rig-color-primary: ${theme.colors.primary};`);
  });

  it('produit autant de déclarations que de variables', () => {
    const rule = themeToCssRule(theme);
    const declarations = rule.split('\n').filter((line) => line.trim().startsWith('--rig-'));
    expect(declarations).toHaveLength(Object.keys(themeToCssVars(theme)).length);
  });
});
