import { describe, expect, it } from 'vitest';
import { INITIAL_SCHEME, nextScheme } from './color-scheme';

/**
 * **Le défaut que ces trois lignes attrapent ne se voit qu'en mode sombre**, et
 * seulement le temps d'une image — autant dire qu'aucune capture ne l'aurait
 * montré. Il a été signalé à l'usage : le bouton retour du planning qui
 * clignote.
 *
 * Ce qui le rend testable est de l'avoir sorti du `.tsx` : la question « que
 * fait-on d'un `null` ? » est une décision, pas du rendu.
 */

describe('nextScheme', () => {
  it('suit le système quand il répond', () => {
    expect(nextScheme('light', 'dark')).toBe('dark');
    expect(nextScheme('dark', 'light')).toBe('light');
    expect(nextScheme('dark', 'dark')).toBe('dark');
  });

  // **Le cas du bug.** Avant, `null` valait « clair » : en sombre, le thème
  // entier basculait le temps d'une image, ce qui donnait un flash blanc. Et
  // `tsc` ne pouvait rien y voir — React Native déclare `useColorScheme()`
  // non-nullable alors qu'elle rend `null`.
  it('garde le mode courant quand le système ne répond pas', () => {
    expect(nextScheme('dark', null)).toBe('dark');
    expect(nextScheme('dark', undefined)).toBe('dark');
  });

  // La deuxième erreur de la même ligne : `'unspecified'` veut dire « suis le
  // système », donc sombre quand le système est sombre — jamais « clair ».
  it('ne prend pas « unspecified » pour « clair »', () => {
    expect(nextScheme('dark', 'unspecified')).toBe('dark');
    expect(nextScheme('light', 'unspecified')).toBe('light');
  });

  // Le pendant, pour que le test ne prouve pas seulement « ça rend sombre » :
  // en clair aussi, un trou ne doit rien changer.
  it('ne bascule pas non plus en sombre sur un trou', () => {
    expect(nextScheme('light', null)).toBe('light');
    expect(nextScheme('light', undefined)).toBe('light');
  });

  // Une rafale de trous — ce que fait iOS pendant une transition — ne doit
  // produire aucune bascule, quelle que soit sa longueur.
  it('traverse une rafale de trous sans jamais basculer', () => {
    let scheme = nextScheme(INITIAL_SCHEME, 'dark');
    for (const signal of [null, 'unspecified', undefined, null] as const) {
      scheme = nextScheme(scheme, signal);
    }
    expect(scheme).toBe('dark');
  });

  it('part en clair, le défaut de la plateforme', () => {
    expect(INITIAL_SCHEME).toBe('light');
    expect(nextScheme(INITIAL_SCHEME, null)).toBe('light');
  });
});
