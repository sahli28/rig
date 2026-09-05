import { describe, expect, it } from 'vitest';
import {
  dernierJourDu,
  estDansLe,
  moisDe,
  moisPrecedent,
  moisSuivant,
  peutReculer,
  premierJourDu,
  semainesDu,
} from './month-grid-state';

/**
 * **L'arithmétique de calendrier se teste, le rendu se regarde.**
 *
 * C'est la même règle que `week-strip-state.test.ts`, que ce fichier remplace,
 * et elle sépare mieux ici : une grille de mois n'a aucun geste — pas de
 * balayage, pas de position de défilement — donc **tout ce qui peut être faux
 * est dans ce fichier**. Ce qui reste à regarder sur appareil est de la mise en
 * page.
 *
 * Les cas ci-dessous ne sont pas décoratifs : chacun est un mois dont la forme
 * casse une implémentation naïve.
 */

describe('les bornes d’un mois', () => {
  it('donne le premier et le dernier jour', () => {
    expect(premierJourDu('2026-09')).toBe('2026-09-01');
    expect(dernierJourDu('2026-09')).toBe('2026-09-30');
  });

  // Le dernier jour se calcule par « premier du mois suivant moins un » : ces
  // trois cas passent sans qu'aucune longueur de mois soit écrite nulle part.
  it('tient les 31, les 30 et les deux février', () => {
    expect(dernierJourDu('2026-01')).toBe('2026-01-31');
    expect(dernierJourDu('2026-02')).toBe('2026-02-28');
    expect(dernierJourDu('2028-02')).toBe('2028-02-29');
    expect(dernierJourDu('2026-04')).toBe('2026-04-30');
  });

  it('passe l’année dans les deux sens', () => {
    expect(moisSuivant('2026-12')).toBe('2027-01');
    expect(moisPrecedent('2027-01')).toBe('2026-12');
    expect(dernierJourDu('2026-12')).toBe('2026-12-31');
  });

  it('lit le mois d’une date', () => {
    expect(moisDe('2026-09-05')).toBe('2026-09');
    expect(estDansLe('2026-09', '2026-09-30')).toBe(true);
    expect(estDansLe('2026-09', '2026-10-01')).toBe(false);
  });
});

describe('la grille', () => {
  // Septembre 2026 : le 1er est un mardi, le 30 un mercredi. La grille part donc
  // du lundi 31 août et finit le dimanche 4 octobre — c'est exactement la
  // capture qui a servi de référence.
  it('commence au lundi de la semaine du 1er et couvre tout le mois', () => {
    const semaines = semainesDu('2026-09');
    expect(semaines[0]?.[0]).toBe('2026-08-31');
    expect(semaines.at(-1)?.at(-1)).toBe('2026-10-04');
    expect(semaines).toHaveLength(5);
  });

  it('rend toujours des semaines de sept jours, lundi en tête', () => {
    for (const mois of ['2026-01', '2026-02', '2026-09', '2027-05', '2028-02']) {
      for (const semaine of semainesDu(mois)) {
        expect(semaine).toHaveLength(7);
      }
    }
  });

  it('contient chaque jour du mois, une fois et une seule', () => {
    const jours = semainesDu('2026-09')
      .flat()
      .filter((date) => estDansLe('2026-09', date));
    expect(jours).toHaveLength(30);
    expect(new Set(jours).size).toBe(30);
  });

  // **Le nombre de lignes varie, et c'est le sujet du cas.** Une grille figée à
  // six lignes ajouterait une ligne vide onze mois sur douze ; une grille figée
  // à cinq perdrait des jours au mois qui en demande six.
  it('demande quatre lignes au minimum et six au maximum', () => {
    // Février 2027 : 28 jours commençant un lundi — le seul cas à quatre lignes.
    expect(semainesDu('2027-02')).toHaveLength(4);
    // Mai 2027 : 31 jours commençant un samedi — le cas à six.
    expect(semainesDu('2027-05')).toHaveLength(6);
  });

  // Un mois qui commence un dimanche est le piège classique des grilles qui
  // comptent en semaines commençant le dimanche : le 1er doit tomber en
  // **dernière** colonne de la première ligne, pas en première.
  it('place un 1er tombant un dimanche en fin de première ligne', () => {
    const semaines = semainesDu('2026-11'); // 1er novembre 2026 = dimanche
    expect(semaines[0]?.at(-1)).toBe('2026-11-01');
    expect(semaines[0]?.[0]).toBe('2026-10-26');
  });

  it('traverse le 29 février sans le perdre', () => {
    expect(semainesDu('2028-02').flat()).toContain('2028-02-29');
  });
});

describe('la borne du passé', () => {
  it('laisse reculer tant qu’on est après le mois d’adhésion', () => {
    expect(peutReculer('2026-09', '2026-03')).toBe(true);
  });

  it('s’arrête au mois d’adhésion — il n’y a rien avant', () => {
    expect(peutReculer('2026-03', '2026-03')).toBe(false);
    expect(peutReculer('2026-02', '2026-03')).toBe(false);
  });

  // Une adhésion inconnue ne doit pas bloquer la navigation : on ne ferme pas
  // une porte sur une donnée absente.
  it('ne bloque pas quand l’adhésion est inconnue', () => {
    expect(peutReculer('2026-09', null)).toBe(true);
  });
});
