import { describe, expect, it } from 'vitest';
import { attendanceStateOf, summarizeAttendance, type AttendanceRow } from './attendance';

/**
 * La logique pure de la feuille — la seule part testable sous Node (le rendu
 * mobile se regarde, il ne se monte pas : dette D-015). Ce qui compte : que
 * l'état dérivé des deux horodatages soit sans ambiguïté, et que le compteur
 * dise la vérité.
 */

function row(over: Partial<AttendanceRow>): AttendanceRow {
  return {
    membership_id: 'm',
    booking_id: 'b',
    first_name: 'Léa',
    last_initial: 'M',
    attended_at: null,
    no_show_at: null,
    ...over,
  };
}

describe('attendanceStateOf', () => {
  it('ni pointé ni absent → en attente', () => {
    expect(attendanceStateOf(row({}))).toBe('pending');
  });

  it('pointé → présent', () => {
    expect(attendanceStateOf(row({ attended_at: '2026-09-10T18:00:00Z' }))).toBe('present');
  });

  it('marqué absent par le job → no-show', () => {
    expect(attendanceStateOf(row({ no_show_at: '2026-09-10T20:00:00Z' }))).toBe('no_show');
  });

  it('la présence prime sur le no-show : un retardataire pointé après coup est présent', () => {
    // Le job avait marqué l'absence, le coach corrige : présent l'emporte.
    expect(
      attendanceStateOf(
        row({ attended_at: '2026-09-10T18:20:00Z', no_show_at: '2026-09-10T20:00:00Z' }),
      ),
    ).toBe('present');
  });
});

describe('summarizeAttendance', () => {
  it('compte chaque état, et le total est le nombre de lignes', () => {
    const rows = [
      row({ attended_at: '2026-09-10T18:00:00Z' }),
      row({ attended_at: '2026-09-10T18:01:00Z' }),
      row({ no_show_at: '2026-09-10T20:00:00Z' }),
      row({}),
    ];
    expect(summarizeAttendance(rows)).toEqual({ present: 2, noShow: 1, pending: 1, total: 4 });
  });

  it('une feuille vide est tout à zéro', () => {
    expect(summarizeAttendance([])).toEqual({ present: 0, noShow: 0, pending: 0, total: 0 });
  });
});
