import { describe, expect, it } from 'vitest';
import { sourcesPourOccurrence, workoutTitle, type ClassWorkout } from './workouts';

function seance(overrides: Partial<ClassWorkout> = {}): ClassWorkout {
  return {
    id: 'w1',
    classId: 'c1',
    title: null,
    body: 'Échauffement 10 min',
    publishedAt: null,
    ...overrides,
  };
}

describe('workoutTitle', () => {
  it('prend le titre du coach quand il en a écrit un', () => {
    expect(workoutTitle(seance({ title: 'Jeudi endurance' }), 'WOD')).toBe('Jeudi endurance');
  });

  it('retombe sur le nom du type de cours quand il n’a pas titré', () => {
    // Le titre est **facultatif** : le coach veut pouvoir titrer, pas devoir.
    expect(workoutTitle(seance({ title: null }), 'WOD')).toBe('WOD');
  });

  it('traite un titre fait de blancs comme absent', () => {
    // Sinon un espace tapé par mégarde remplacerait « WOD » par rien du tout,
    // et l'écran afficherait une ligne vide sans que personne comprenne.
    expect(workoutTitle(seance({ title: '   ' }), 'WOD')).toBe('WOD');
  });

  it('retombe aussi quand il n’y a pas de séance du tout', () => {
    expect(workoutTitle(null, 'Haltérophilie')).toBe('Haltérophilie');
  });

  it('n’ampute pas un titre qui contient des espaces', () => {
    expect(workoutTitle(seance({ title: '  Jeudi endurance  ' }), 'WOD')).toBe('Jeudi endurance');
  });
});

describe('sourcesPourOccurrence', () => {
  const cible = { id: 'soir', classTypeId: 'wod', day: '2026-09-10' };
  const workouts: Record<string, ClassWorkout> = {
    matin: seance({ id: 'w-matin', classId: 'matin', body: 'Metcon du matin' }),
    haltero: seance({ id: 'w-halt', classId: 'haltero', body: 'Squat 5x5' }),
    'wod-avant': seance({ id: 'w-avant', classId: 'wod-avant', body: 'WOD de jeudi dernier' }),
    'autre-type-avant': seance({ id: 'w-x', classId: 'autre-type-avant', body: 'Sans rapport' }),
  };
  const candidates = [
    { id: 'matin', classTypeId: 'wod', day: '2026-09-10', label: '07:00 · WOD' },
    { id: 'haltero', classTypeId: 'halt', day: '2026-09-10', label: '12:00 · Haltéro' },
    { id: 'wod-avant', classTypeId: 'wod', day: '2026-09-03', label: 'jeu. dernier · WOD' },
    {
      id: 'autre-type-avant',
      classTypeId: 'halt',
      day: '2026-09-03',
      label: 'jeu. dernier · Haltéro',
    },
    { id: 'sans-seance', classTypeId: 'wod', day: '2026-09-10', label: '18:00 · WOD' },
    { id: 'soir', classTypeId: 'wod', day: '2026-09-10', label: '19:00 · WOD' },
  ];

  it('propose les autres cours du même jour, quel que soit leur type', () => {
    // « S'il y a un Haltéro dans la journée, je ne retape pas le même WOD. »
    const ids = sourcesPourOccurrence({ occurrence: cible, candidates, workouts }).map(
      (s) => s.classId,
    );
    expect(ids).toContain('matin');
    expect(ids).toContain('haltero');
  });

  it('propose le même type la semaine précédente', () => {
    const ids = sourcesPourOccurrence({ occurrence: cible, candidates, workouts }).map(
      (s) => s.classId,
    );
    expect(ids).toContain('wod-avant');
  });

  it('ne propose pas un **autre** type de la semaine précédente', () => {
    // La règle est « le même cours la semaine dernière », pas « la semaine
    // dernière ». Sans ça, la liste deviendrait le planning entier.
    const ids = sourcesPourOccurrence({ occurrence: cible, candidates, workouts }).map(
      (s) => s.classId,
    );
    expect(ids).not.toContain('autre-type-avant');
  });

  it('ne se propose pas elle-même', () => {
    const ids = sourcesPourOccurrence({ occurrence: cible, candidates, workouts }).map(
      (s) => s.classId,
    );
    expect(ids).not.toContain('soir');
  });

  it('écarte une occurrence sans séance', () => {
    // Proposer un texte vide ferait croire à un pré-remplissage qui efface.
    const ids = sourcesPourOccurrence({ occurrence: cible, candidates, workouts }).map(
      (s) => s.classId,
    );
    expect(ids).not.toContain('sans-seance');
  });

  it('rend le **texte**, jamais une référence — le pré-remplissage copie', () => {
    const source = sourcesPourOccurrence({ occurrence: cible, candidates, workouts }).find(
      (s) => s.classId === 'matin',
    );
    expect(source?.body).toBe('Metcon du matin');
  });
});
