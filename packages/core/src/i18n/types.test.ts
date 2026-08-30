import { describe, expect, it } from 'vitest';
import { FALLBACK_LOCALE, isLocale, localeFromTag } from './types';

describe('isLocale', () => {
  it('reconnaît les langues du produit', () => {
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('en')).toBe(true);
  });

  it('rejette tout le reste', () => {
    expect(isLocale('de')).toBe(false);
    expect(isLocale('fr-FR')).toBe(false);
    expect(isLocale('')).toBe(false);
  });
});

describe('localeFromTag', () => {
  it('ramène une variante régionale à sa langue', () => {
    expect(localeFromTag('fr-FR')).toBe('fr');
    expect(localeFromTag('fr-CA')).toBe('fr');
    expect(localeFromTag('en-GB')).toBe('en');
    expect(localeFromTag('en-US')).toBe('en');
  });

  it('accepte le séparateur souligné des étiquettes Android', () => {
    expect(localeFromTag('fr_FR')).toBe('fr');
  });

  it('ignore la casse', () => {
    expect(localeFromTag('FR-fr')).toBe('fr');
  });

  it('bascule sur la langue de repli pour une langue non gérée', () => {
    expect(localeFromTag('de-DE')).toBe(FALLBACK_LOCALE);
    expect(localeFromTag('es')).toBe(FALLBACK_LOCALE);
  });

  it('tolère une valeur absente sans lever', () => {
    // La langue de l'appareil peut être indisponible : ce n'est pas une raison
    // de bloquer le démarrage de l'app.
    expect(localeFromTag(null)).toBe(FALLBACK_LOCALE);
    expect(localeFromTag(undefined)).toBe(FALLBACK_LOCALE);
    expect(localeFromTag('')).toBe(FALLBACK_LOCALE);
  });
});
