import { describe, expect, it } from 'vitest';
import { FALLBACK_LOCALE } from './types';
import { localeFromTagOrNull, profileLocaleToSync, resolveLocale } from './resolve-locale';

describe('localeFromTagOrNull', () => {
  it('rend la langue quand elle est gérée', () => {
    expect(localeFromTagOrNull('fr-FR')).toBe('fr');
    expect(localeFromTagOrNull('en_US')).toBe('en');
  });

  it('rend `null` — et non le repli — pour une langue non gérée', () => {
    // C'est toute la raison d'être de cette fonction à côté de `localeFromTag` :
    // « allemand » et « rien du tout » doivent se distinguer, sinon un rang de
    // la résolution ne peut jamais passer la main au suivant.
    expect(localeFromTagOrNull('de-DE')).toBeNull();
    expect(localeFromTagOrNull(null)).toBeNull();
    expect(localeFromTagOrNull('')).toBeNull();
  });
});

describe('resolveLocale — les quatre rangs', () => {
  it('rang 1 : une préférence enregistrée l’emporte sur tout', () => {
    expect(resolveLocale({ stored: 'en', profile: 'fr', device: 'fr-FR' })).toBe('en');
  });

  it('rang 2 : sans préférence locale, le profil serveur décide', () => {
    // C'est lui qui rend la langue cohérente entre le web et le mobile pour la
    // même personne : un second téléphone doit parler la langue du compte.
    expect(resolveLocale({ stored: null, profile: 'en', device: 'fr-FR' })).toBe('en');
  });

  it('rang 3 : sans profil, la langue de l’appareil', () => {
    expect(resolveLocale({ stored: null, profile: null, device: 'fr-FR' })).toBe('fr');
  });

  it('rang 4 : quand on ne sait rien, le repli', () => {
    expect(resolveLocale({ stored: null, profile: null, device: null })).toBe(FALLBACK_LOCALE);
  });

  it('saute un rang dont la valeur n’est pas une langue gérée', () => {
    // Un téléphone en allemand ne doit pas court-circuiter le profil : il ne
    // dit rien d'utilisable, il ne dit pas « anglais ».
    expect(resolveLocale({ stored: 'de', profile: 'fr', device: 'de-DE' })).toBe('fr');
    expect(resolveLocale({ stored: null, profile: 'de', device: 'en-GB' })).toBe('en');
  });

  it('accepte des sources absentes', () => {
    expect(resolveLocale({})).toBe(FALLBACK_LOCALE);
    expect(resolveLocale({ device: 'fr' })).toBe('fr');
  });
});

describe('FALLBACK_LOCALE', () => {
  it('est le français', () => {
    // Décision de D-004, tranchée explicitement plutôt que subie : le produit
    // est vendu à des boxes françaises et ses écrans sont pensés en français.
    // Un repli anglais était l'inverse du défaut attendu. Ce test existe pour
    // que le retour en arrière soit un choix, pas une régression silencieuse.
    expect(FALLBACK_LOCALE).toBe('fr');
  });
});

describe('profileLocaleToSync', () => {
  it('rend la préférence locale quand le profil dit autre chose', () => {
    // Sans cette réconciliation, un choix fait sur un téléphone resterait
    // invisible du web et du téléphone suivant : les deux sources divergeraient
    // en silence, ce que le ticket interdit.
    expect(profileLocaleToSync('en', 'fr')).toBe('en');
  });

  it('rend la préférence locale quand le profil ne dit rien d’utilisable', () => {
    expect(profileLocaleToSync('fr', null)).toBe('fr');
    expect(profileLocaleToSync('fr', 'de')).toBe('fr');
  });

  it('ne rend rien quand les deux sont d’accord', () => {
    expect(profileLocaleToSync('fr', 'fr')).toBeNull();
  });

  it('ne rend rien quand aucune préférence locale n’a été posée', () => {
    // Personne n'a rien choisi sur cet appareil : il n'a rien à imposer au
    // compte. Écrire ici renverserait les rangs 1 et 2.
    expect(profileLocaleToSync(null, 'en')).toBeNull();
    expect(profileLocaleToSync(null, null)).toBeNull();
  });
});
