import { describe, expect, it } from 'vitest';
import { interpolate, translate } from './translate';

describe('interpolate', () => {
  it('remplace les placeholders par leur valeur', () => {
    expect(interpolate('Bonjour {name}', { name: 'Léa' })).toBe('Bonjour Léa');
  });

  it('accepte les nombres', () => {
    expect(interpolate('{count} places', { count: 3 })).toBe('3 places');
  });

  it('laisse le placeholder visible quand la valeur manque', () => {
    // Un trou silencieux dans une phrase est pire qu'un « {name} » voyant :
    // le second se remarque en relecture, le premier passe en production.
    expect(interpolate('Bonjour {name}', {})).toBe('Bonjour {name}');
  });
});

describe('translate', () => {
  it('rend la chaîne de la langue demandée', () => {
    expect(translate('fr', 'common.cancel')).toBe('Annuler');
    expect(translate('en', 'common.cancel')).toBe('Cancel');
  });

  it('renvoie la clé plutôt que de lever quand elle est inconnue', () => {
    // Une clé manquante ne doit jamais faire tomber un écran de réservation.
    // C'est `pnpm i18n:check` qui la rattrape, en CI, avant la production.
    // @ts-expect-error clé volontairement inexistante
    expect(translate('fr', 'clef.qui.nexiste.pas')).toBe('clef.qui.nexiste.pas');
  });
});

describe('translate — pluriel', () => {
  it('choisit la forme selon le nombre', () => {
    expect(translate('fr', 'class.spots_left', { count: 1 })).toBe('1 place restante');
    expect(translate('fr', 'class.spots_left', { count: 3 })).toBe('3 places restantes');
    expect(translate('en', 'class.spots_left', { count: 1 })).toBe('1 spot left');
    expect(translate('en', 'class.spots_left', { count: 3 })).toBe('3 spots left');
  });

  it('respecte la règle française du zéro, différente de l’anglaise', () => {
    // En français, 0 prend le singulier ; en anglais, le pluriel. C'est
    // exactement ce qu'un `count > 1` écrit à la main se serait trompé à faire.
    expect(translate('fr', 'class.spots_left', { count: 0 })).toBe('0 place restante');
    expect(translate('en', 'class.spots_left', { count: 0 })).toBe('0 spots left');
  });

  it('expose `count` à l’interpolation sans qu’on ait à le repasser', () => {
    expect(translate('fr', 'class.spots_left', { count: 12 })).toContain('12');
  });

  it('combine pluriel et autres valeurs', () => {
    expect(translate('fr', 'waitlist.position', { count: 2, position: 3, total: 5 })).toBe(
      'Tu es 3ᵉ sur la liste, sur 5 personnes en attente.',
    );
  });
});
