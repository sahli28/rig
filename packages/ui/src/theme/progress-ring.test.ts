import { describe, expect, it } from 'vitest';
import { progressRing } from './progress-ring';

describe('progressRing', () => {
  it('dérive rayon et circonférence de la taille et du trait', () => {
    const g = progressRing(50, { size: 120, strokeWidth: 12 });
    expect(g.radius).toBe(54); // (120 - 12) / 2
    expect(g.center).toBe(60);
    expect(g.circumference).toBeCloseTo(2 * Math.PI * 54, 6);
  });

  it('0 % ne peint rien, 100 % peint tout', () => {
    const g0 = progressRing(0);
    expect(g0.dashOffset).toBeCloseTo(g0.circumference, 6);
    const g100 = progressRing(100);
    expect(g100.dashOffset).toBeCloseTo(0, 6);
  });

  it('50 % laisse la moitié vide', () => {
    const g = progressRing(50);
    expect(g.dashOffset).toBeCloseTo(g.circumference / 2, 6);
  });

  it('borne les valeurs hors [0, 100] au lieu de déborder', () => {
    expect(progressRing(-20).dashOffset).toBeCloseTo(progressRing(0).circumference, 6);
    expect(progressRing(140).dashOffset).toBeCloseTo(0, 6);
  });
});
