/**
 * Primitives couleur. Aucune dépendance plateforme : ce module tourne
 * indifféremment dans React Native, dans Next et dans les tests.
 *
 * Les boxes choisissent leur couleur en hexadécimal. C'est le seul format
 * accepté en entrée : pas de `rgb()`, pas de noms CSS, pas d'alpha.
 */

export interface Rgb {
  /** 0–255 */
  r: number;
  /** 0–255 */
  g: number;
  /** 0–255 */
  b: number;
}

export interface Hsl {
  /** 0–360 */
  h: number;
  /** 0–1 */
  s: number;
  /** 0–1 */
  l: number;
}

const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Lève si la chaîne n'est pas un hexadécimal `#rgb` ou `#rrggbb`. */
export function parseHex(hex: string): Rgb {
  const value = hex.trim();
  if (!HEX_PATTERN.test(value)) {
    throw new Error(`Couleur invalide : "${hex}". Format attendu : #rgb ou #rrggbb.`);
  }

  const body = value.slice(1);
  const full =
    body.length === 3
      ? body
          .split('')
          .map((c) => c + c)
          .join('')
      : body;

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function channelToHex(value: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  return clamped.toString(16).padStart(2, '0');
}

export function toHex({ r, g, b }: Rgb): string {
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) {
    return { h: 0, s: 0, l };
  }

  const s = delta / (1 - Math.abs(2 * l - 1));

  let h: number;
  if (max === rn) {
    h = ((gn - bn) / delta) % 6;
  } else if (max === gn) {
    h = (bn - rn) / delta + 2;
  } else {
    h = (rn - gn) / delta + 4;
  }

  h *= 60;
  if (h < 0) h += 360;

  return { h, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (hp < 1) [rp, gp, bp] = [c, x, 0];
  else if (hp < 2) [rp, gp, bp] = [x, c, 0];
  else if (hp < 3) [rp, gp, bp] = [0, c, x];
  else if (hp < 4) [rp, gp, bp] = [0, x, c];
  else if (hp < 5) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];

  const m = l - c / 2;
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

/** Luminance relative WCAG 2.x. 0 = noir, 1 = blanc. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const linear = (channel: number): number => {
    const v = channel / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Décale la clarté d'une couleur en conservant sa teinte et sa saturation. */
export function withLightness(hex: string, lightness: number): string {
  const hsl = rgbToHsl(parseHex(hex));
  return toHex(hslToRgb({ ...hsl, l: Math.max(0, Math.min(1, lightness)) }));
}
