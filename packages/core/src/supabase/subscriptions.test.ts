import { describe, expect, it } from 'vitest';
import { accessUntil } from './subscriptions';

/**
 * `accessUntil` est la moitié affichage de RM2.8 : la même frontière que
 * l'oracle SQL — borne incluse, le lendemain de `ends_on` ne couvre plus —
 * appliquée à des dates **locales de la box** déjà résolues (`localDay`).
 * Les chaînes `YYYY-MM-DD` se comparent lexicographiquement, c'est le contrat.
 */

const ligne = (starts_on: string, ends_on: string) => ({ starts_on, ends_on });

describe('accessUntil', () => {
  it("rend l'échéance de la ligne qui couvre aujourd'hui", () => {
    expect(accessUntil([ligne('2026-09-01', '2026-11-30')], '2026-09-16')).toBe('2026-11-30');
  });

  it('sans aucune ligne, pas d’accès', () => {
    expect(accessUntil([], '2026-09-16')).toBeNull();
  });

  it('le dernier jour compte encore, le lendemain plus (borne incluse)', () => {
    const lignes = [ligne('2026-09-01', '2026-09-30')];
    expect(accessUntil(lignes, '2026-09-30')).toBe('2026-09-30');
    expect(accessUntil(lignes, '2026-10-01')).toBeNull();
  });

  it('le premier jour compte déjà, la veille pas encore', () => {
    const lignes = [ligne('2026-09-16', '2026-10-15')];
    expect(accessUntil(lignes, '2026-09-16')).toBe('2026-10-15');
    expect(accessUntil(lignes, '2026-09-15')).toBeNull();
  });

  it('un renouvellement anticipé (deux lignes qui se chevauchent) affiche la plus lointaine', () => {
    const lignes = [ligne('2026-07-01', '2026-09-30'), ligne('2026-09-16', '2026-12-15')];
    expect(accessUntil(lignes, '2026-09-20')).toBe('2026-12-15');
  });

  it("une ligne future ne donne pas d'accès aujourd'hui", () => {
    expect(accessUntil([ligne('2026-10-01', '2026-10-31')], '2026-09-16')).toBeNull();
  });

  it('une ligne expirée non plus', () => {
    expect(accessUntil([ligne('2026-01-01', '2026-01-31')], '2026-09-16')).toBeNull();
  });
});
