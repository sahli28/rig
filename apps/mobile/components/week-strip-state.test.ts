import { describe, expect, it } from 'vitest';
import { apresBalayage, apresJourChoisi, etatInitial } from './week-strip-state';

/**
 * **Le premier test de `apps/mobile`**, et il existe parce qu'un défaut y a
 * échappé à tout le reste.
 *
 * Le bandeau de semaine (P1-011) changeait de semaine au balayage, puis
 * revenait à la semaine du jour choisi au rendu suivant. Trouvé sur iPhone le
 * 5 septembre 2026, et invisible partout ailleurs :
 *
 * - `apps/mobile` n'avait **aucune** suite de tests, pas même un script ;
 * - le harnais web n'a pas de gestes — et le SDK web de React Native n'émet
 *   même jamais `onMomentumScrollEnd` : seul `onScroll` y est câblé
 *   (`react-native-web/dist/exports/ScrollView/ScrollViewBase.js`). Le balayage
 *   n'existe donc pas au harnais, dans aucune version du composant ;
 * - le typecheck voyait deux règles cohérentes, qui l'étaient chacune.
 *
 * Ce que ces trois assertions couvrent, c'est **la composition** des deux
 * transitions — l'endroit où le défaut vivait, et le seul endroit où il pouvait
 * vivre.
 */

// Samedi 5 septembre 2026. Sa semaine commence le lundi 31 août.
const SAMEDI = '2026-09-05';
const SEMAINE_DU_SAMEDI = '2026-08-31';

describe('le bandeau de semaine, sa machine à états', () => {
  it('part sur la semaine du jour affiché', () => {
    expect(etatInitial(SAMEDI)).toEqual({
      lundi: SEMAINE_DU_SAMEDI,
      dernierJourVu: SAMEDI,
    });
  });

  it('un balayage change la semaine sans toucher au jour choisi', () => {
    // « Glisser pour regarder n'est pas choisir » : c'est ici que la semaine
    // regardée et la semaine du jour se séparent, et c'est voulu.
    const apres = apresBalayage(etatInitial(SAMEDI), 1);
    expect(apres.lundi).toBe('2026-09-07');
    expect(apres.dernierJourVu).toBe(SAMEDI);
  });

  it('**la semaine balayée survit au rendu suivant** — le défaut du 5 septembre', () => {
    // Le rendu suivant repasse le **même** jour choisi. L'ancienne version
    // réconciliait sur le désaccord entre les deux et ramenait la semaine du
    // samedi : le geste s'annulait lui-même, et le bandeau ne défilait pas.
    const balaye = apresBalayage(etatInitial(SAMEDI), 1);
    const rendered = apresJourChoisi(balaye, SAMEDI);

    expect(rendered.lundi).toBe('2026-09-07');
    expect(rendered).toBe(balaye); // rien n'a bougé, pas même une nouvelle référence
  });

  it('mais un vrai changement de jour ramène bien la semaine', () => {
    // L'effet reste légitime : les flèches et « Revenir à aujourd'hui »
    // changent le jour depuis l'extérieur, et la semaine doit suivre. C'est le
    // pendant du test précédent, et sans lui le correctif pourrait être
    // « ne jamais rien synchroniser ».
    const balaye = apresBalayage(etatInitial(SAMEDI), 2);
    const retourAujourdhui = apresJourChoisi(balaye, SAMEDI);
    expect(retourAujourdhui.lundi).toBe('2026-09-14'); // le même jour : rien ne bouge

    const autreJour = apresJourChoisi(balaye, '2026-09-08');
    expect(autreJour.lundi).toBe('2026-09-07'); // la semaine du mardi 8
    expect(autreJour.dernierJourVu).toBe('2026-09-08');
  });

  it('revenir sur un jour déjà vu après en avoir choisi un autre resynchronise', () => {
    // Le cas que le `ref` doit couvrir et qu'un simple « a-t-on déjà vu ce
    // jour ? » raterait : on part du samedi, on choisit le 8, on revient au
    // samedi. Le troisième pas est un vrai changement, donc la semaine suit.
    const etat = apresJourChoisi(apresJourChoisi(etatInitial(SAMEDI), '2026-09-08'), SAMEDI);
    expect(etat.lundi).toBe(SEMAINE_DU_SAMEDI);
  });

  it('un balayage de zéro page ne fait rien', () => {
    const depart = etatInitial(SAMEDI);
    expect(apresBalayage(depart, 0)).toBe(depart);
  });
});
