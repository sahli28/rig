import { describe, expect, it } from 'vitest';
import {
  SEMAINES_VISIBLES,
  apresJourChoisi,
  fenetreInitiale,
  pageVisible,
  semainesDeLaFenetre,
} from './week-strip-state';

/**
 * **Le premier test de `apps/mobile`**, et il existe parce qu'un défaut y a
 * échappé à tout le reste — deux fois.
 *
 * Le bandeau de semaine (P1-011) ne défilait pas : on glissait vers la semaine
 * suivante et on revenait à la semaine courante. Invisible partout ailleurs :
 *
 * - `apps/mobile` n'avait aucune suite de tests avant ce ticket ;
 * - le harnais web n'a pas de gestes, et le SDK web de React Native n'émet
 *   **jamais** `onMomentumScrollEnd` : seul `onScroll` y est câblé. Le balayage
 *   n'existe pas au harnais, dans aucune version du composant ;
 * - le typecheck voyait des règles cohérentes, qui l'étaient chacune.
 *
 * Ce que ces tests couvrent maintenant, c'est ce qui **reste** à couvrir une
 * fois la conception changée : il n'y a plus d'état à tenir d'accord avec le
 * défilement, donc plus de composition à faire échouer. Restent la fenêtre de
 * semaines et la lecture d'une position — deux fonctions pures.
 */

// Samedi 5 septembre 2026. Sa semaine commence le lundi 31 août.
const SAMEDI = '2026-09-05';
const SEMAINE_DU_SAMEDI = '2026-08-31';

describe('la fenêtre du bandeau', () => {
  it('part sur la semaine du jour affiché', () => {
    expect(fenetreInitiale(SAMEDI)).toEqual({
      base: SEMAINE_DU_SAMEDI,
      dernierJourVu: SAMEDI,
    });
  });

  it('montre la semaine du jour et les suivantes, jamais le passé', () => {
    // Le passé se rejoint par les flèches de jour. Un cours passé ne se réserve
    // pas — `open_days_before` vaut sept jours — donc balayer en arrière
    // n'ouvrirait sur rien d'actionnable.
    const semaines = semainesDeLaFenetre(fenetreInitiale(SAMEDI));
    expect(semaines).toEqual(['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21']);
    expect(semaines).toHaveLength(SEMAINES_VISIBLES);
  });

  it('ne bouge pas quand le jour choisi ne change pas', () => {
    // **Le défaut du 5 septembre, pris à la racine.** Regarder une autre
    // semaine ne change pas le jour choisi ; si un rendu suivant devait
    // « corriger » quoi que ce soit à partir du jour, le geste serait défait.
    // Ici la fenêtre sort intacte, et la position de défilement — qui est la
    // vraie mémoire de ce qu'on regarde — n'est pas touchée.
    const depart = fenetreInitiale(SAMEDI);
    expect(apresJourChoisi(depart, SAMEDI)).toBe(depart);
  });

  it('se rebase quand le jour change vraiment', () => {
    // Le pendant : les flèches de jour et « Revenir à aujourd'hui » changent le
    // jour depuis l'extérieur, et la fenêtre doit suivre. Sans ce test, le
    // correctif pourrait être « ne jamais rien resynchroniser ».
    const apres = apresJourChoisi(fenetreInitiale(SAMEDI), '2026-09-16');
    expect(apres.base).toBe('2026-09-14');
    expect(apres.dernierJourVu).toBe('2026-09-16');
  });

  it('revenir sur un jour déjà quitté rebase aussi', () => {
    const etat = apresJourChoisi(apresJourChoisi(fenetreInitiale(SAMEDI), '2026-09-16'), SAMEDI);
    expect(etat.base).toBe(SEMAINE_DU_SAMEDI);
  });
});

describe('pageVisible — lire une position, pas la décider', () => {
  it('rend la page sous le doigt', () => {
    expect(pageVisible(0, 400)).toBe(0);
    expect(pageVisible(400, 400)).toBe(1);
    expect(pageVisible(1200, 400)).toBe(3);
  });

  it('arrondit à la page la plus proche pendant le geste', () => {
    // `onScroll` est émis pendant le glissement, pas seulement à la fin : le
    // libellé doit basculer quand on a passé la moitié, pas trembler.
    expect(pageVisible(180, 400)).toBe(0);
    expect(pageVisible(220, 400)).toBe(1);
  });

  it('borne aux pages qui existent — le rebond élastique d’iOS', () => {
    // iOS rend des offsets négatifs quand on tire au-delà du début, et
    // au-delà du contenu quand on tire à la fin. Un index hors bornes
    // afficherait une semaine vide le temps d'un rendu.
    expect(pageVisible(-120, 400)).toBe(0);
    expect(pageVisible(5000, 400)).toBe(SEMAINES_VISIBLES - 1);
  });

  it('ne divise pas par zéro avant la première mesure', () => {
    expect(pageVisible(0, 0)).toBe(0);
  });
});
