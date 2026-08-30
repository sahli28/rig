import { describe, expect, it } from 'vitest';
import { buildTheme } from './build-theme';
import { AA_TEXT, contrastRatio } from './contrast';
import { DEFAULT_BRAND, type ColorScheme, type TenantBrand } from './tokens';

const SCHEMES: ColorScheme[] = ['light', 'dark'];

function brandWith(overrides: Partial<TenantBrand>): TenantBrand {
  return { ...DEFAULT_BRAND, ...overrides };
}

describe('buildTheme — lisibilité garantie', () => {
  for (const scheme of SCHEMES) {
    describe(`schéma ${scheme}`, () => {
      it('rend le texte principal et secondaire lisibles sur le fond', () => {
        const theme = buildTheme(DEFAULT_BRAND, scheme);
        expect(contrastRatio(theme.colors.text, theme.colors.surface)).toBeGreaterThanOrEqual(
          AA_TEXT,
        );
        expect(contrastRatio(theme.colors.textMuted, theme.colors.surface)).toBeGreaterThanOrEqual(
          AA_TEXT,
        );
      });

      it('rend lisible ce qui se pose sur la primaire et sur le danger', () => {
        const theme = buildTheme(DEFAULT_BRAND, scheme);
        expect(contrastRatio(theme.colors.onPrimary, theme.colors.primary)).toBeGreaterThanOrEqual(
          AA_TEXT,
        );
        expect(contrastRatio(theme.colors.onDanger, theme.colors.danger)).toBeGreaterThanOrEqual(
          AA_TEXT,
        );
      });

      it('garde les couleurs d’état lisibles sur le fond', () => {
        const theme = buildTheme(DEFAULT_BRAND, scheme);
        for (const état of ['success', 'warning', 'danger'] as const) {
          expect(contrastRatio(theme.colors[état], theme.colors.surface)).toBeGreaterThanOrEqual(
            AA_TEXT,
          );
        }
      });

      it('reste lisible quelle que soit la couleur choisie par la box', () => {
        // Un échantillon volontairement hostile : jaune fluo, blanc, noir,
        // pastel délavé, fuchsia saturé.
        for (const primary of ['#ffe800', '#ffffff', '#000000', '#f3d9e2', '#ff00ff', '#808080']) {
          const theme = buildTheme(brandWith({ primary }), scheme);
          expect(
            contrastRatio(theme.colors.primary, theme.colors.surface),
            `primaire ${primary} illisible sur le fond en ${scheme}`,
          ).toBeGreaterThanOrEqual(AA_TEXT);
          expect(
            contrastRatio(theme.colors.onPrimary, theme.colors.primary),
            `texte illisible sur la primaire ${primary} en ${scheme}`,
          ).toBeGreaterThanOrEqual(AA_TEXT);
        }
      });
    });
  }
});

describe('buildTheme — rapport de contraste rendu à la box', () => {
  it('signale une primaire corrigée, avec les deux ratios', () => {
    const theme = buildTheme(brandWith({ primary: '#ffe800' }), 'light');
    expect(theme.contrast.adjusted).toBe(true);
    expect(theme.contrast.requestedPrimary).toBe('#ffe800');
    expect(theme.contrast.appliedPrimary).not.toBe('#ffe800');
    expect(theme.contrast.requestedRatio).toBeLessThan(AA_TEXT);
    expect(theme.contrast.appliedRatio).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('laisse intacte une primaire déjà conforme', () => {
    const theme = buildTheme(brandWith({ primary: '#7a2f16' }), 'light');
    expect(theme.contrast.adjusted).toBe(false);
    expect(theme.colors.primary).toBe('#7a2f16');
  });
});

describe('buildTheme — dérivations', () => {
  it('propage la couleur de marque à tout le thème depuis un seul champ', () => {
    const a = buildTheme(brandWith({ primary: '#7a2f16' }), 'light');
    const b = buildTheme(brandWith({ primary: '#16457a' }), 'light');
    expect(a.colors.primary).not.toBe(b.colors.primary);
    // Le socle neutre, lui, ne bouge pas : seule la marque change.
    expect(a.colors.surface).toBe(b.colors.surface);
    expect(a.colors.text).toBe(b.colors.text);
  });

  it('déduit les rayons du rayon de base', () => {
    const theme = buildTheme(brandWith({ radius: 12 }), 'light');
    expect(theme.radius).toMatchObject({ sm: 6, md: 12, lg: 18 });
  });

  it('applique une échelle d’espacement de 4 points', () => {
    const theme = buildTheme(DEFAULT_BRAND, 'light');
    expect(theme.space(0)).toBe(0);
    expect(theme.space(3)).toBe(12);
  });

  it('impose une cible tactile d’au moins 44 points', () => {
    expect(buildTheme(DEFAULT_BRAND, 'light').minTouchTarget).toBeGreaterThanOrEqual(44);
  });

  it('refuse une couleur de marque invalide plutôt que de la contourner', () => {
    expect(() => buildTheme(brandWith({ primary: 'orange' }), 'light')).toThrow(/Couleur invalide/);
  });
});
