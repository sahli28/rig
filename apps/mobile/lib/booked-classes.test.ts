import { describe, expect, it } from 'vitest';
import { comptesDuMois, moisACharger, reservesDuJour } from './booked-classes';

/**
 * **Ce que ces tests protègent est un badge faux, pas un badge absent.**
 *
 * Un marqueur est un état dérivé, et les états dérivés de cet écran ont déjà
 * affiché le contraire de la base deux fois (P1-003c, puis `D-016`). Le cas qui
 * compte ici est celui que le ticket ne voyait pas : le mois feuilleté et le
 * jour affiché sont **séparés**, donc lire « le mois chargé » ne suffit pas.
 */

const SEPTEMBRE = {
  '2026-09-04': ['c-vendredi'],
  '2026-09-07': ['c-lundi-matin', 'c-lundi-soir'],
};

const PAR_MOIS = { '2026-09': SEPTEMBRE, '2026-10': { '2026-10-02': ['c-octobre'] } };

describe('reservesDuJour', () => {
  it('rend les cours réservés du jour, prêts pour un test d’appartenance', () => {
    const set = reservesDuJour(PAR_MOIS, '2026-09-07');
    expect(set.has('c-lundi-matin')).toBe(true);
    expect(set.has('c-lundi-soir')).toBe(true);
    expect(set.size).toBe(2);
  });

  it('rend un ensemble vide sur un jour sans réservation', () => {
    expect(reservesDuJour(PAR_MOIS, '2026-09-08').size).toBe(0);
  });

  // **Le cas du trou.** On feuillette octobre, la liste affiche toujours le
  // 7 septembre : ses badges doivent survivre. Ils ne le peuvent que si le mois
  // du **jour** est chargé, et c'est lui qu'on va chercher — pas le mois affiché.
  it('lit le mois du jour affiché, pas celui qu’on feuillette', () => {
    expect(reservesDuJour(PAR_MOIS, '2026-10-02').size).toBe(1);
    expect(reservesDuJour(PAR_MOIS, '2026-09-07').size).toBe(2);
  });

  it('ne casse pas quand le mois n’est pas encore chargé', () => {
    expect(reservesDuJour(PAR_MOIS, '2026-11-03').size).toBe(0);
    expect(reservesDuJour({}, '2026-09-07').size).toBe(0);
  });
});

describe('moisACharger', () => {
  it('n’en demande qu’un quand le jour est dans le mois feuilleté', () => {
    expect(moisACharger('2026-09', '2026-09-07')).toEqual(['2026-09']);
  });

  // Le prix de la séparation, et il est payé seulement quand on feuillette
  // vraiment ailleurs.
  it('en demande deux quand on feuillette un autre mois', () => {
    expect(moisACharger('2026-10', '2026-09-07')).toEqual(['2026-10', '2026-09']);
  });
});

describe('comptesDuMois', () => {
  it('dérive le compte des identifiants, au lieu de le stocker à côté', () => {
    expect(comptesDuMois(SEPTEMBRE)).toEqual({ '2026-09-04': 1, '2026-09-07': 2 });
  });

  it('rend un objet vide quand le mois n’est pas chargé', () => {
    expect(comptesDuMois(undefined)).toEqual({});
  });
});
