import { describe, expect, it } from 'vitest';
import {
  activityStats,
  attendancePointsDelta,
  attendanceRate,
  checklistProgress,
  fillRate,
  pointsDelta,
  type DashboardChecklist,
} from './dashboard';

describe('fillRate / attendanceRate', () => {
  it('arrondit le pourcentage', () => {
    expect(fillRate({ booked: 412, capacity: 528 })).toBe(78);
    expect(attendanceRate({ present: 318, total: 371 })).toBe(86);
  });

  it('rend null quand il n’y a rien à mesurer — jamais un 0 % mensonger', () => {
    expect(fillRate({ booked: 0, capacity: 0 })).toBeNull();
    expect(attendanceRate({ present: 0, total: 0 })).toBeNull();
  });

  it('0 réel se distingue de « rien à mesurer »', () => {
    expect(fillRate({ booked: 0, capacity: 20 })).toBe(0);
  });
});

describe('pointsDelta — la vraie variation, ou rien', () => {
  it('rend l’écart en points entre deux fenêtres', () => {
    expect(pointsDelta({ booked: 412, capacity: 528 }, { booked: 360, capacity: 500 })).toBe(6);
  });

  it('rend null si une fenêtre n’a rien à mesurer (pas de flèche décorative)', () => {
    expect(pointsDelta({ booked: 5, capacity: 10 }, { booked: 0, capacity: 0 })).toBeNull();
    expect(pointsDelta({ booked: 0, capacity: 0 }, { booked: 5, capacity: 10 })).toBeNull();
  });

  it('peut être négatif', () => {
    expect(pointsDelta({ booked: 5, capacity: 10 }, { booked: 8, capacity: 10 })).toBe(-30);
  });

  it('attendancePointsDelta suit la même règle', () => {
    expect(attendancePointsDelta({ present: 9, total: 10 }, { present: 8, total: 10 })).toBe(10);
    expect(attendancePointsDelta({ present: 1, total: 2 }, { present: 0, total: 0 })).toBeNull();
  });
});

describe('checklistProgress', () => {
  const base: DashboardChecklist = {
    rooms: false,
    class_types: false,
    opening_hours: false,
    schedules: false,
    members: false,
    payment_link: false,
  };

  it('compte les six items', () => {
    expect(checklistProgress(base)).toEqual({ done: 0, total: 6, pct: 0 });
    expect(
      checklistProgress({
        ...base,
        rooms: true,
        class_types: true,
        opening_hours: true,
        schedules: true,
      }),
    ).toEqual({ done: 4, total: 6, pct: 67 });
    expect(
      checklistProgress({
        rooms: true,
        class_types: true,
        opening_hours: true,
        schedules: true,
        members: true,
        payment_link: true,
      }),
    ).toEqual({ done: 6, total: 6, pct: 100 });
  });
});

describe('activityStats', () => {
  it('rend le pic, le total et les bornes', () => {
    const activity = [
      { day: '2026-08-21', count: 4 },
      { day: '2026-08-22', count: 0 },
      { day: '2026-08-23', count: 9 },
    ];
    expect(activityStats(activity)).toEqual({
      max: 9,
      total: 13,
      firstDay: '2026-08-21',
      lastDay: '2026-08-23',
    });
  });

  it('une box sans activité a un pic honnête de 0', () => {
    expect(activityStats([])).toEqual({ max: 0, total: 0, firstDay: null, lastDay: null });
  });
});
