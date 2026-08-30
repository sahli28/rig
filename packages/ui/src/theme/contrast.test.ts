import { describe, expect, it } from 'vitest';
import { parseHex, rgbToHsl } from './color';
import { AA_TEXT, contrastRatio, ensureContrast, meetsContrast, pickOnColor } from './contrast';

describe('contrastRatio', () => {
  it('donne 21 entre le noir et le blanc', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('donne 1 pour une couleur face à elle-même', () => {
    expect(contrastRatio('#e4572e', '#e4572e')).toBeCloseTo(1, 5);
  });

  it('est symétrique', () => {
    expect(contrastRatio('#e4572e', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#e4572e'),
      10,
    );
  });
});

describe('pickOnColor', () => {
  it('met du texte sombre sur un fond clair', () => {
    expect(pickOnColor('#ffe800', ['#ffffff', '#000000'])).toBe('#000000');
  });

  it('met du texte clair sur un fond sombre', () => {
    expect(pickOnColor('#0f1115', ['#ffffff', '#000000'])).toBe('#ffffff');
  });

  it('refuse une liste vide plutôt que de renvoyer un indéfini', () => {
    expect(() => pickOnColor('#ffffff', [])).toThrow(/au moins une couleur/);
  });
});

describe('ensureContrast', () => {
  it('laisse intacte une couleur qui passe déjà le seuil', () => {
    const fix = ensureContrast('#0f1115', '#ffffff');
    expect(fix.adjusted).toBe(false);
    expect(fix.color).toBe('#0f1115');
    expect(fix.ratio).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('corrige une primaire illisible sur fond blanc', () => {
    // Jaune vif : le cas réel d'une box qui choisit sa couleur de marque.
    const fix = ensureContrast('#ffe800', '#ffffff');
    expect(fix.originalRatio).toBeLessThan(AA_TEXT);
    expect(fix.adjusted).toBe(true);
    expect(fix.ratio).toBeGreaterThanOrEqual(AA_TEXT);
    expect(meetsContrast(fix.color, '#ffffff')).toBe(true);
  });

  it('préserve la teinte de la marque en corrigeant', () => {
    const teinteOrigine = rgbToHsl(parseHex('#ffe800')).h;
    const fix = ensureContrast('#ffe800', '#ffffff');
    const teinteCorrigee = rgbToHsl(parseHex(fix.color)).h;
    expect(teinteCorrigee).toBeCloseTo(teinteOrigine, 0);
  });

  it('assombrit face à un fond clair et éclaircit face à un fond sombre', () => {
    const surBlanc = ensureContrast('#ffe800', '#ffffff');
    const surNoir = ensureContrast('#4a3d00', '#0f1115');
    expect(rgbToHsl(parseHex(surBlanc.color)).l).toBeLessThan(rgbToHsl(parseHex('#ffe800')).l);
    expect(rgbToHsl(parseHex(surNoir.color)).l).toBeGreaterThan(rgbToHsl(parseHex('#4a3d00')).l);
  });

  it('respecte un seuil plus permissif pour les composants', () => {
    const strict = ensureContrast('#ffe800', '#ffffff', 4.5);
    const permissif = ensureContrast('#ffe800', '#ffffff', 3);
    expect(strict.ratio).toBeGreaterThanOrEqual(4.5);
    expect(permissif.ratio).toBeGreaterThanOrEqual(3);
    // Le seuil permissif s'arrête plus tôt, donc reste plus clair.
    expect(rgbToHsl(parseHex(permissif.color)).l).toBeGreaterThan(
      rgbToHsl(parseHex(strict.color)).l,
    );
  });

  it('corrige aussi face à un fond moyen, que nul sens unique ne résout', () => {
    // Cas qui piège une recherche à sens unique : #808080 n'est ni « clair »
    // ni « sombre » au sens de la luminance, et seul l'assombrissement passe.
    const fix = ensureContrast('#808080', '#808080', 4.5);
    expect(fix.adjusted).toBe(true);
    expect(fix.ratio).toBeGreaterThanOrEqual(4.5);
  });
});
