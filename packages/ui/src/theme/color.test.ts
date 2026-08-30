import { describe, expect, it } from 'vitest';
import { hslToRgb, parseHex, relativeLuminance, rgbToHsl, toHex, withLightness } from './color';

describe('parseHex', () => {
  it('lit la forme courte et la forme longue de façon identique', () => {
    expect(parseHex('#fff')).toEqual(parseHex('#ffffff'));
    expect(parseHex('#e42')).toEqual(parseHex('#ee4422'));
  });

  it('ignore la casse et les espaces autour', () => {
    expect(parseHex('  #E4572E  ')).toEqual(parseHex('#e4572e'));
  });

  it('refuse ce qui n’est pas un hexadécimal', () => {
    expect(() => parseHex('red')).toThrow(/Couleur invalide/);
    expect(() => parseHex('#12345')).toThrow(/Couleur invalide/);
    expect(() => parseHex('rgb(1,2,3)')).toThrow(/Couleur invalide/);
    // L'alpha n'est pas accepté : un token de thème est opaque.
    expect(() => parseHex('#ffffff80')).toThrow(/Couleur invalide/);
  });
});

describe('conversions', () => {
  it('fait l’aller-retour hex → hsl → hex sans dériver', () => {
    for (const hex of ['#e4572e', '#0f1115', '#ffffff', '#000000', '#3a86ff']) {
      expect(toHex(hslToRgb(rgbToHsl(parseHex(hex))))).toBe(hex);
    }
  });

  it('traite le gris comme une couleur sans saturation', () => {
    expect(rgbToHsl(parseHex('#808080')).s).toBe(0);
  });
});

describe('relativeLuminance', () => {
  it('place le noir à 0 et le blanc à 1', () => {
    expect(relativeLuminance(parseHex('#000000'))).toBeCloseTo(0, 5);
    expect(relativeLuminance(parseHex('#ffffff'))).toBeCloseTo(1, 5);
  });

  it('classe les gris dans l’ordre', () => {
    const sombre = relativeLuminance(parseHex('#333333'));
    const moyen = relativeLuminance(parseHex('#888888'));
    const clair = relativeLuminance(parseHex('#dddddd'));
    expect(sombre).toBeLessThan(moyen);
    expect(moyen).toBeLessThan(clair);
  });
});

describe('withLightness', () => {
  it('conserve la teinte en changeant la clarté', () => {
    const teinteOrigine = rgbToHsl(parseHex('#e4572e')).h;
    const eclairci = withLightness('#e4572e', 0.8);
    expect(rgbToHsl(parseHex(eclairci)).h).toBeCloseTo(teinteOrigine, 0);
    expect(rgbToHsl(parseHex(eclairci)).l).toBeCloseTo(0.8, 1);
  });

  it('borne les valeurs hors de [0,1]', () => {
    expect(withLightness('#e4572e', -5)).toBe('#000000');
    expect(withLightness('#e4572e', 12)).toBe('#ffffff');
  });
});
