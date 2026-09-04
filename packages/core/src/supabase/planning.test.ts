import { describe, expect, it } from 'vitest';
import { groupByDay, instantLocal, localDay, localDayIn, type Occurrence } from './planning';

/**
 * Ces fonctions ont vécu deux semaines dans `apps/web` **sans un seul test** —
 * `apps/web` n'a pas de suite, et personne ne l'avait remarqué. Elles portent
 * pourtant la seule règle non triviale du planning : dans quel jour tombe une
 * occurrence, selon le fuseau de la box.
 *
 * Les descendre dans `@rig/core` pour que le mobile les partage était la moitié
 * du gain. L'autre moitié est ici.
 */

function occurrence(id: string, startsAt: string): Occurrence {
  return {
    id,
    schedule_id: 's1',
    starts_at: startsAt,
    ends_at: startsAt,
    capacity: 12,
    booked_count: 0,
    status: 'SCHEDULED',
    cancellation_reason: null,
    className: 'WOD',
    roomName: 'Salle principale',
    coachName: 'Sarah',
  };
}

describe('localDay — le jour de la box, pas celui du lecteur', () => {
  it('range un cours de fin de soirée dans le bon jour', () => {
    // 22 h 30 heure de Paris le 3 septembre = 20 h 30 UTC. Lu en UTC, c'est
    // encore le 3 : ce cas-là ne prouve rien tout seul.
    expect(localDay('2026-09-03T20:30:00Z', 'Europe/Paris')).toBe('2026-09-03');
  });

  it('range un cours d’après minuit dans le jour de la box, pas celui d’UTC', () => {
    // 00 h 30 heure de Paris le 4 septembre = 22 h 30 UTC le 3. C'est le cas
    // qui décide : lu sans conversion, ce cours apparaîtrait la veille.
    expect(localDay('2026-09-03T22:30:00Z', 'Europe/Paris')).toBe('2026-09-04');
    expect(localDay('2026-09-03T22:30:00Z', 'UTC')).toBe('2026-09-03');
  });

  it('suit l’heure d’été', () => {
    // Même heure UTC, deux saisons : Paris est à UTC+2 en août, UTC+1 en
    // décembre. Un décalage figé se tromperait la moitié de l'année.
    expect(localDay('2026-08-15T23:30:00Z', 'Europe/Paris')).toBe('2026-08-16');
    expect(localDay('2026-12-15T23:30:00Z', 'Europe/Paris')).toBe('2026-12-16');
    expect(localDay('2026-12-15T22:30:00Z', 'Europe/Paris')).toBe('2026-12-15');
  });

  it('vaut pour un fuseau qui n’est pas le nôtre', () => {
    // Le produit est vendu en France, mais rien dans le code ne le suppose —
    // `tenants.timezone` est une colonne, pas une constante.
    expect(localDay('2026-09-03T22:30:00Z', 'America/New_York')).toBe('2026-09-03');
    expect(localDay('2026-09-03T22:30:00Z', 'Australia/Sydney')).toBe('2026-09-04');
  });

  it('`localDayIn` rend une fonction réutilisable, au même résultat', () => {
    const dayOf = localDayIn('Europe/Paris');
    expect(dayOf('2026-09-03T22:30:00Z')).toBe(localDay('2026-09-03T22:30:00Z', 'Europe/Paris'));
  });
});

describe('instantLocal — l’inverse, pour borner une requête', () => {
  it('convertit minuit local en instant UTC, été comme hiver', () => {
    // Paris : UTC+2 en été, UTC+1 en hiver. Minuit local tombe donc la veille
    // à 22 h en août et à 23 h en décembre.
    expect(instantLocal('2026-08-17T00:00:00', 'Europe/Paris')).toBe('2026-08-16T22:00:00.000Z');
    expect(instantLocal('2026-12-14T00:00:00', 'Europe/Paris')).toBe('2026-12-13T23:00:00.000Z');
  });

  it('ne bouge rien en UTC', () => {
    expect(instantLocal('2026-09-07T00:00:00', 'UTC')).toBe('2026-09-07T00:00:00.000Z');
  });

  it('fait l’aller-retour avec `localDay`', () => {
    // L'invariant qui compte : la borne d'une requête et le rangement d'une
    // ligne doivent parler du même jour. Sans lui, un cours entre dans la
    // fenêtre puis se range dans une colonne qui n'y est pas.
    for (const date of ['2026-01-05', '2026-03-30', '2026-08-17', '2026-11-02']) {
      expect(localDay(instantLocal(`${date}T00:00:00`, 'Europe/Paris'), 'Europe/Paris')).toBe(date);
    }
  });
});

describe('groupByDay', () => {
  const monday = '2026-09-07';
  const dayOf = localDayIn('Europe/Paris');

  it('rend les sept jours, même vides', () => {
    const jours = groupByDay(monday, [], dayOf);
    expect(jours).toHaveLength(7);
    expect(jours.map((j) => j.date)).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ]);
    expect(jours.every((j) => j.occurrences.length === 0)).toBe(true);
  });

  it('range chaque occurrence dans son jour **local**', () => {
    // 22 h 30 UTC le lundi = 00 h 30 le mardi à Paris. La colonne attendue est
    // donc mardi, et c'est tout l'objet de la conversion.
    const jours = groupByDay(
      monday,
      [occurrence('a', '2026-09-07T16:30:00Z'), occurrence('b', '2026-09-07T22:30:00Z')],
      dayOf,
    );
    expect(jours[0]?.occurrences.map((o) => o.id)).toEqual(['a']);
    expect(jours[1]?.occurrences.map((o) => o.id)).toEqual(['b']);
  });

  it('trie les occurrences d’un jour par heure', () => {
    const jours = groupByDay(
      monday,
      [
        occurrence('soir', '2026-09-07T16:30:00Z'),
        occurrence('matin', '2026-09-07T05:00:00Z'),
        occurrence('midi', '2026-09-07T10:00:00Z'),
      ],
      dayOf,
    );
    expect(jours[0]?.occurrences.map((o) => o.id)).toEqual(['matin', 'midi', 'soir']);
  });

  it('ignore une occurrence hors de la semaine plutôt que de lever', () => {
    // Une requête mal bornée ne doit pas casser l'écran : elle doit se voir
    // parce qu'il manque une ligne, pas parce que tout est blanc.
    const jours = groupByDay(monday, [occurrence('avant', '2026-08-01T10:00:00Z')], dayOf);
    expect(jours.flatMap((j) => j.occurrences)).toHaveLength(0);
  });
});
