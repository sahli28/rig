import { describe, expect, it } from 'vitest';

import {
  ClassSchedulePatchSchema,
  RRULE_DAYS,
  buildWeeklyRrule,
  dayOfWeekday,
  isCalendarDate,
  isPilotRrule,
  mondayOf,
  parseWeeklyRrule,
  shiftWeeks,
  weekDates,
  weekdayOf,
} from './class-schedules';

/**
 * Ces deux listes sont la **moitié TypeScript** d'un contrôle de parité. Leur
 * jumelle vit dans `supabase/tests/class_schedules_test.sql`, sur les mêmes
 * chaînes : si l'une des deux grammaires dérive, une des deux suites rougit.
 *
 * C'est le seul moyen honnête de tenir une règle écrite à deux endroits. La
 * tenir à un seul n'était pas possible : la base ne peut pas exécuter de
 * TypeScript, et un écran ne peut pas se reposer sur une contrainte qui ne
 * remonte qu'un code d'erreur.
 */
const ACCEPTÉES = [
  'FREQ=WEEKLY;BYDAY=MO',
  'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;UNTIL=20261231',
  'FREQ=WEEKLY;INTERVAL=52;BYDAY=SU',
  'FREQ=WEEKLY;BYDAY=SA,SU;UNTIL=20270101',
];

const REFUSÉES = [
  // Fréquences hors pilote : les approximer ferait tenir un cours à une heure
  // que la box n'a jamais choisie.
  'FREQ=MONTHLY;BYDAY=MO',
  'FREQ=DAILY;BYDAY=MO',
  // `COUNT` n'est jamais interprété : il faudrait dérouler la série pour savoir
  // quand elle s'arrête, ce que la contrainte de table ne peut pas faire.
  'FREQ=WEEKLY;BYDAY=MO;COUNT=8',
  // Clés inconnues, même inoffensives en apparence.
  'FREQ=WEEKLY;BYDAY=MO;BYHOUR=18',
  'FREQ=WEEKLY;WKST=SU;BYDAY=MO',
  // `BYDAY` est obligatoire : sans lui, la RFC déduit le jour de `DTSTART`, ce
  // que la base ne fait pas.
  'FREQ=WEEKLY',
  'FREQ=WEEKLY;BYDAY=',
  // Bornes d'`INTERVAL`.
  'FREQ=WEEKLY;INTERVAL=0;BYDAY=MO',
  'FREQ=WEEKLY;INTERVAL=53;BYDAY=MO',
  // Ordre des clés : la forme est canonique, pas approximative.
  'BYDAY=MO;FREQ=WEEKLY',
  // Jour inconnu, et jour répété.
  'FREQ=WEEKLY;BYDAY=XX',
  'FREQ=WEEKLY;BYDAY=MO,MO',
  // `UNTIL` mal formé, et une date qui n'existe pas.
  'FREQ=WEEKLY;BYDAY=MO;UNTIL=2026-12-31',
  'FREQ=WEEKLY;BYDAY=MO;UNTIL=20260230',
];

describe('grammaire RRULE du pilote', () => {
  it.each(ACCEPTÉES)('accepte %s', (rrule) => {
    expect(isPilotRrule(rrule)).toBe(true);
  });

  it.each(REFUSÉES)('refuse %s', (rrule) => {
    expect(isPilotRrule(rrule)).toBe(false);
  });
});

describe('parseWeeklyRrule', () => {
  it('rend les jours triés du lundi au dimanche, quel que soit l’ordre saisi', () => {
    expect(parseWeeklyRrule('FREQ=WEEKLY;BYDAY=FR,MO,WE')?.days).toEqual(['MO', 'WE', 'FR']);
  });

  it('rend 1 quand INTERVAL est absent, comme le veut la RFC', () => {
    expect(parseWeeklyRrule('FREQ=WEEKLY;BYDAY=MO')?.interval).toBe(1);
  });

  it('rend UNTIL en date ISO, pas dans la forme compacte de la RFC', () => {
    expect(parseWeeklyRrule('FREQ=WEEKLY;BYDAY=MO;UNTIL=20261231')?.until).toBe('2026-12-31');
  });

  it('rend null sur une série sans fin', () => {
    expect(parseWeeklyRrule('FREQ=WEEKLY;BYDAY=MO')?.until).toBeNull();
  });

  // Une série illisible venue de la base est un cas à afficher, pas à faire
  // planter : on rend `null`, on ne lève pas.
  it('rend null plutôt que de lever sur une chaîne hors grammaire', () => {
    expect(parseWeeklyRrule('n’importe quoi')).toBeNull();
  });
});

describe('buildWeeklyRrule', () => {
  it('omet INTERVAL=1, qui est le défaut de la RFC', () => {
    expect(buildWeeklyRrule({ days: ['MO'], interval: 1, until: null })).toBe(
      'FREQ=WEEKLY;BYDAY=MO',
    );
  });

  it('trie les jours et déduplique', () => {
    expect(buildWeeklyRrule({ days: ['FR', 'MO', 'FR'], interval: 1, until: null })).toBe(
      'FREQ=WEEKLY;BYDAY=MO,FR',
    );
  });

  it('écrit UNTIL dans la forme compacte de la RFC', () => {
    expect(buildWeeklyRrule({ days: ['SU'], interval: 3, until: '2027-01-01' })).toBe(
      'FREQ=WEEKLY;INTERVAL=3;BYDAY=SU;UNTIL=20270101',
    );
  });

  // Le point de tout ça : rouvrir une série sans rien toucher ne doit pas la
  // faire paraître modifiée.
  it.each(ACCEPTÉES)('fait un aller-retour stable sur %s', (rrule) => {
    const relu = parseWeeklyRrule(rrule);
    expect(relu).not.toBeNull();
    expect(isPilotRrule(buildWeeklyRrule(relu!))).toBe(true);
    expect(buildWeeklyRrule(parseWeeklyRrule(buildWeeklyRrule(relu!))!)).toBe(
      buildWeeklyRrule(relu!),
    );
  });
});

describe('conventions de jour', () => {
  // Trois conventions cohabitent — BYDAY en lettres, `opening_hours.weekday` en
  // 0–6, `isodow` en 1–7 — et les confondre est une erreur silencieuse.
  it('aligne MO sur 0, comme opening_hours.weekday', () => {
    expect(weekdayOf('MO')).toBe(0);
    expect(weekdayOf('SU')).toBe(6);
  });

  it.each([...RRULE_DAYS])('fait un aller-retour sur %s', (day) => {
    expect(dayOfWeekday(weekdayOf(day))).toBe(day);
  });
});

describe('isCalendarDate', () => {
  // Ce test existe parce que la fonction a cassé : ses antislashs avaient sauté
  // à l'écriture (`/^d{4}-…/`), si bien qu'elle n'acceptait plus que la chaîne
  // littérale « dddd-dd-dd ». Le planning retombait donc silencieusement sur la
  // semaine courante, quel que soit le lien suivi — un écran qui ment sans rien
  // signaler. Elle vivait alors dans la couche web, seule de sa famille et hors
  // de portée de Vitest.
  it('accepte une date bien formée', () => {
    expect(isCalendarDate('2026-09-07')).toBe(true);
  });

  it('refuse la forme littérale qu’une expression régulière cassée accepterait', () => {
    expect(isCalendarDate('dddd-dd-dd')).toBe(false);
  });

  it.each(['2026-9-7', '07/09/2026', '2026-09-07T18:30', '', 'la semaine prochaine'])(
    'refuse %s',
    (value) => {
      expect(isCalendarDate(value)).toBe(false);
    },
  );

  it('refuse une date bien formée qui n’existe pas', () => {
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(isCalendarDate('2026-13-01')).toBe(false);
  });

  it('accepte un 29 février bissextile et refuse celui qui ne l’est pas', () => {
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
  });

  it('refuse l’absence de valeur, qui est le cas d’un paramètre d’URL manquant', () => {
    expect(isCalendarDate(undefined)).toBe(false);
    expect(isCalendarDate(null)).toBe(false);
  });
});

describe('semaine affichée', () => {
  it('ramène un mercredi au lundi de sa semaine', () => {
    expect(mondayOf('2026-10-21')).toBe('2026-10-19');
  });

  // Le dimanche est le piège : `getUTCDay()` le rend 0, donc sans correction il
  // repartirait sur le lundi suivant.
  it('ramène un dimanche au lundi qui le précède, pas à celui qui le suit', () => {
    expect(mondayOf('2026-10-25')).toBe('2026-10-19');
  });

  it('laisse un lundi en place', () => {
    expect(mondayOf('2026-10-19')).toBe('2026-10-19');
  });

  it('rend sept dates, du lundi au dimanche', () => {
    expect(weekDates('2026-10-19')).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
  });

  // Le 25 octobre 2026 est le dimanche du retour à l'heure d'hiver en France.
  // Ces dates sont des étiquettes de calendrier, pas des instants : la semaine
  // suivante commence le 26, quoi qu'il arrive aux horloges.
  it('traverse le changement d’heure sans perdre un jour', () => {
    expect(shiftWeeks('2026-10-19', 1)).toBe('2026-10-26');
    expect(weekDates('2026-10-26')[0]).toBe('2026-10-26');
  });

  it('recule avec un décalage négatif', () => {
    expect(shiftWeeks('2026-10-19', -2)).toBe('2026-10-05');
  });
});

describe('ClassSchedulePatchSchema', () => {
  const valide = {
    class_type_id: '00000000-0000-4000-8000-000000000001',
    room_id: '00000000-0000-4000-8000-000000000002',
    coach_membership_id: '00000000-0000-4000-8000-000000000003',
    starts_on: '2026-10-19',
    starts_at_local: '18:30',
    rrule: 'FREQ=WEEKLY;BYDAY=MO',
    capacity: 16,
  };

  it('accepte une série bien formée', () => {
    expect(ClassSchedulePatchSchema.safeParse(valide).success).toBe(true);
  });

  // La base rend `HH:MM:SS` ; sans normalisation, un aller-retour ferait
  // apparaître un faux changement.
  it('ramène une heure à HH:MM', () => {
    const parsed = ClassSchedulePatchSchema.parse({ ...valide, starts_at_local: '18:30:00' });
    expect(parsed.starts_at_local).toBe('18:30');
  });

  it('refuse une RRULE hors grammaire', () => {
    expect(
      ClassSchedulePatchSchema.safeParse({ ...valide, rrule: 'FREQ=MONTHLY;BYDAY=MO' }).success,
    ).toBe(false);
  });

  // Miroir de `class_schedules_until_after_start` : la base refuse déjà, mais
  // sans nom de champ.
  it('refuse une fin antérieure au début', () => {
    const result = ClassSchedulePatchSchema.safeParse({
      ...valide,
      rrule: 'FREQ=WEEKLY;BYDAY=MO;UNTIL=20261001',
    });
    expect(result.success).toBe(false);
  });

  it('refuse une capacité nulle ou négative', () => {
    expect(ClassSchedulePatchSchema.safeParse({ ...valide, capacity: 0 }).success).toBe(false);
    expect(ClassSchedulePatchSchema.safeParse({ ...valide, capacity: -3 }).success).toBe(false);
  });
});
