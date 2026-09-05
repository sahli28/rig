import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDayOfMonth,
  formatMoney,
  formatRelativeDate,
  formatTime,
  formatWeekday,
} from './format';

/**
 * Intl insère des espaces insécables (U+00A0) et insécables étroites (U+202F)
 * avant le symbole monétaire et entre les milliers. Ils sont typographiquement
 * corrects mais invisibles dans un message d'échec : on les normalise pour que
 * les assertions restent lisibles.
 */
const norm = (value: string) => value.replace(/[\u00A0\u202F]/g, ' ');

const PARIS = 'Europe/Paris';
// 31 août 2026, 18h30 heure de Paris (UTC+2 en été) = 16h30 UTC.
const COURS = new Date('2026-08-31T16:30:00Z');

describe('formatMoney', () => {
  it('affiche 89,00 € en français et €89.00 en anglais', () => {
    expect(norm(formatMoney(8900, { locale: 'fr' }))).toBe('89,00 €');
    expect(norm(formatMoney(8900, { locale: 'en' }))).toBe('€89.00');
  });

  it('travaille en centimes entiers, jamais en unités', () => {
    expect(norm(formatMoney(199, { locale: 'fr' }))).toBe('1,99 €');
    expect(norm(formatMoney(1, { locale: 'fr' }))).toBe('0,01 €');
    expect(norm(formatMoney(0, { locale: 'fr' }))).toBe('0,00 €');
  });

  it('refuse un montant non entier plutôt que d’arrondir en silence', () => {
    expect(() => formatMoney(89.5, { locale: 'fr' })).toThrow(/centimes entiers/);
    expect(() => formatMoney(Number.NaN, { locale: 'fr' })).toThrow(/centimes entiers/);
  });

  it('gère les montants négatifs (remboursement, contre-écriture)', () => {
    expect(norm(formatMoney(-1550, { locale: 'fr' }))).toBe('-15,50 €');
  });

  it('sépare les milliers selon la langue', () => {
    expect(norm(formatMoney(1234567, { locale: 'fr' }))).toBe('12 345,67 €');
    expect(norm(formatMoney(1234567, { locale: 'en' }))).toBe('€12,345.67');
  });

  it('accepte une autre devise que l’euro', () => {
    expect(norm(formatMoney(8900, { locale: 'en', currency: 'GBP' }))).toBe('£89.00');
  });
});

describe('formatTime — fuseau de la box, pas de l’appareil', () => {
  it('affiche 18:30 pour un cours parisien, quel que soit l’endroit du membre', () => {
    expect(formatTime(COURS, { locale: 'fr', timeZone: PARIS })).toBe('18:30');
    expect(formatTime(COURS, { locale: 'en', timeZone: PARIS })).toBe('18:30');
  });

  it('changerait d’heure si on utilisait le fuseau du membre — ce qu’on ne fait pas', () => {
    // Preuve que le fuseau est bien pris en compte : le même instant lu à
    // New York ne donne pas 18:30. La box reste la référence.
    expect(formatTime(COURS, { locale: 'fr', timeZone: 'America/New_York' })).not.toBe('18:30');
  });
});

describe('formatDate', () => {
  it('rend une date courte dans les deux langues', () => {
    expect(formatDate(COURS, { locale: 'fr', timeZone: PARIS })).toBe('31/08/2026');
    expect(formatDate(COURS, { locale: 'en', timeZone: PARIS })).toBe('31/08/2026');
  });

  it('rend une date longue localisée', () => {
    expect(formatDate(COURS, { locale: 'fr', timeZone: PARIS, style: 'long' })).toContain('août');
    expect(formatDate(COURS, { locale: 'en', timeZone: PARIS, style: 'long' })).toContain('August');
  });
});

describe('formatWeekday et formatDayOfMonth — le bandeau de semaine', () => {
  it('rend le jour abrégé dans les deux langues', () => {
    // 31 août 2026 est un lundi. L'abréviation porte un point en français et
    // pas en anglais : c'est ICU qui décide, et c'est bien ce qu'on veut —
    // aucune abréviation écrite à la main dans un fichier de traduction.
    expect(formatWeekday(COURS, { locale: 'fr', timeZone: PARIS })).toBe('lun.');
    expect(formatWeekday(COURS, { locale: 'en', timeZone: PARIS })).toBe('Mon');
  });

  it('rend le numéro du jour sans zéro devant', () => {
    // « 7 », pas « 07 » : dans une pastille de bandeau, le zéro déséquilibre la
    // colonne et n'apporte rien.
    expect(
      formatDayOfMonth(new Date('2026-09-07T10:00:00Z'), { locale: 'fr', timeZone: PARIS }),
    ).toBe('7');
  });

  it('compte le jour dans le fuseau de la box, pas en UTC', () => {
    // 13 h UTC le 8 septembre, c'est 23 h à Sydney — encore le 8 là-bas. Un
    // bandeau calculé en UTC afficherait le bon jour ici et le mauvais à 14 h.
    // Même piège que `localDay`, et il vaut aussi pour une pastille de date.
    const tard = new Date('2026-09-08T13:00:00Z');
    expect(formatDayOfMonth(tard, { locale: 'fr', timeZone: 'Australia/Sydney' })).toBe('8');
    expect(formatWeekday(tard, { locale: 'fr', timeZone: 'Australia/Sydney' })).toBe('mar.');
  });
});

describe('formatRelativeDate', () => {
  const options = { locale: 'fr', timeZone: PARIS } as const;

  it('dit « aujourd’hui » le jour même, avec l’apostrophe typographique', () => {
    const now = new Date('2026-08-31T08:00:00Z');
    // U+2019, pas U+0027 : c'est ce que produit Intl, et c'est la graphie
    // correcte en français. On assert la vraie sortie, pas une approximation.
    expect(formatRelativeDate(COURS, { ...options, now })).toBe('aujourd’hui à 18:30');
  });

  it('dit « demain » la veille', () => {
    const now = new Date('2026-08-30T08:00:00Z');
    expect(formatRelativeDate(COURS, { ...options, now })).toBe('demain à 18:30');
  });

  it('dit « tomorrow » en anglais', () => {
    const now = new Date('2026-08-30T08:00:00Z');
    expect(formatRelativeDate(COURS, { locale: 'en', timeZone: PARIS, now })).toBe(
      'tomorrow at 18:30',
    );
  });

  it('bascule en date absolue au-delà de deux jours', () => {
    const now = new Date('2026-08-25T08:00:00Z');
    expect(formatRelativeDate(COURS, { ...options, now })).toContain('31/08/2026');
  });

  it('compte les jours dans le fuseau de la box, pas en UTC', () => {
    // 31 août 00h30 heure de Paris = 30 août 22h30 UTC. En UTC on dirait
    // « demain » ; à Paris c'est déjà le même jour.
    const minuitPasse = new Date('2026-08-30T22:30:00Z');
    const now = new Date('2026-08-30T21:00:00Z'); // 30 août 23h à Paris
    expect(formatRelativeDate(minuitPasse, { ...options, now })).toBe('demain à 00:30');
  });
});
