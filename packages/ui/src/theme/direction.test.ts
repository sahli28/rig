import { describe, expect, it } from 'vitest';
import { buildTheme } from './build-theme';
import { mixHex, withAlpha } from './color';
import { AA_TEXT, contrastRatio } from './contrast';
import { scrimBands } from './scrim';
import { softTone } from './soft-tone';
import { DEFAULT_BRAND, type ColorScheme } from './tokens';

const SCHEMES: ColorScheme[] = ['light', 'dark'];
// Le même échantillon hostile que `build-theme.test.ts`, plus les deux du seed.
const PRIMAIRES = [
  '#ffe800',
  '#ffffff',
  '#000000',
  '#f3d9e2',
  '#ff00ff',
  '#808080',
  '#E4572E',
  '#16457A',
];

describe('direction P2-021 — ce qui se lit sur les nouvelles surfaces', () => {
  for (const scheme of SCHEMES) {
    it(`${scheme} : texte et texte secondaire restent AA sur surface2 et surface3`, () => {
      const { colors } = buildTheme(DEFAULT_BRAND, scheme);
      for (const fond of [colors.surface2, colors.surface3]) {
        expect(contrastRatio(colors.text, fond)).toBeGreaterThanOrEqual(AA_TEXT);
        expect(contrastRatio(colors.textMuted, fond)).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });

    it(`${scheme} : un aplat doux porte toujours un texte AA, quelle que soit la box`, () => {
      for (const primary of PRIMAIRES) {
        const theme = buildTheme({ ...DEFAULT_BRAND, primary }, scheme);
        for (const couleur of [
          theme.colors.primary,
          theme.colors.success,
          theme.colors.warning,
          theme.colors.danger,
          theme.colors.textMuted,
        ]) {
          const doux = softTone(theme, couleur);
          expect(contrastRatio(doux.foreground, doux.background)).toBeGreaterThanOrEqual(AA_TEXT);
        }
      }
    });

    it(`${scheme} : le texte sur image est AA là où le voile est plein`, () => {
      const { colors } = buildTheme(DEFAULT_BRAND, scheme);
      // Pire cas : une image blanche sous le voile. À l'alpha du bas (0,9), le
      // fond effectif est le mélange voile/blanc.
      const pire = mixHex(colors.scrim, '#ffffff', 0.9);
      expect(contrastRatio(colors.onImage, pire)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrastRatio(colors.onImageMuted, pire)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  }

  it('le voile ne dépend pas du schéma', () => {
    const clair = buildTheme(DEFAULT_BRAND, 'light').colors;
    const sombre = buildTheme(DEFAULT_BRAND, 'dark').colors;
    expect(clair.scrim).toBe(sombre.scrim);
    expect(clair.onImage).toBe(sombre.onImage);
  });
});

describe('scrimBands', () => {
  it('va de `from` à `to`, sans jamais redescendre', () => {
    const bandes = scrimBands('#0c0b0a', 0.2, 0.95, 24);
    expect(bandes).toHaveLength(24);
    expect(bandes[0]?.color).toBe(withAlpha('#0c0b0a', 0.2));
    expect(bandes[23]?.color).toBe(withAlpha('#0c0b0a', 0.95));
    const alphas = bandes.map((bande) => Number.parseInt(bande.color.slice(7), 16));
    for (let i = 1; i < alphas.length; i += 1) {
      expect(alphas[i]).toBeGreaterThanOrEqual(alphas[i - 1] ?? 0);
    }
  });
});

describe('mixHex / withAlpha', () => {
  it('mélange aux bornes et au milieu', () => {
    expect(mixHex('#ffffff', '#000000', 0)).toBe('#000000');
    expect(mixHex('#ffffff', '#000000', 1)).toBe('#ffffff');
    expect(mixHex('#ffffff', '#000000', 0.5)).toBe('#808080');
  });

  it('écrit un alpha sur deux chiffres', () => {
    expect(withAlpha('#0c0b0a', 0)).toBe('#0c0b0a00');
    expect(withAlpha('#0c0b0a', 1)).toBe('#0c0b0aff');
  });
});
