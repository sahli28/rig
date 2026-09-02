import { describe, expect, it } from 'vitest';

import {
  BoxIdentitySchema,
  ClassTypePatchSchema,
  LocalizedTextSchema,
  OpeningHourSchema,
  isSupportedTimeZone,
  localizedText,
  normalizeTime,
  overlappingSlots,
  timeZoneOptions,
} from './box-settings';

describe('localizedText', () => {
  it('rend la langue demandée', () => {
    expect(localizedText({ fr: 'Haltérophilie', en: 'Weightlifting' }, 'en')).toBe('Weightlifting');
  });

  it('se replie sur le français, seule langue garantie en base', () => {
    expect(localizedText({ fr: 'Open gym' }, 'en')).toBe('Open gym');
  });

  it('se replie sur l’anglais si le français est vide', () => {
    expect(localizedText({ fr: '   ', en: 'Gymnastics' }, 'fr')).toBe('Gymnastics');
  });

  // Un catalogue mal saisi doit rendre un écran fade, pas un écran blanc.
  it('rend une chaîne vide sur une valeur qui n’est pas un texte multilingue', () => {
    expect(localizedText(null, 'fr')).toBe('');
    expect(localizedText('WOD', 'fr')).toBe('');
    expect(localizedText({ de: 'Gut' }, 'fr')).toBe('');
  });
});

describe('LocalizedTextSchema', () => {
  it('exige le français', () => {
    expect(LocalizedTextSchema.safeParse({ en: 'Only english' }).success).toBe(false);
  });

  // Miroir de `class_types_name_locales` : la base refuserait, autant le dire
  // dans le champ plutôt que de laisser remonter un 400 opaque.
  it('refuse une langue que la base n’accepte pas', () => {
    expect(LocalizedTextSchema.safeParse({ fr: 'Bon', de: 'Gut' }).success).toBe(false);
  });

  it('accepte le français seul', () => {
    expect(LocalizedTextSchema.parse({ fr: 'WOD' })).toEqual({ fr: 'WOD' });
  });
});

describe('ClassTypePatchSchema', () => {
  const valide = {
    name_i18n: { fr: 'WOD' },
    description_i18n: null,
    duration_minutes: 60,
    color: '#E4572E',
    default_capacity: 16,
  };

  it('accepte un type de cours conforme', () => {
    expect(ClassTypePatchSchema.safeParse(valide).success).toBe(true);
  });

  it.each([
    ['une durée hors bornes', { ...valide, duration_minutes: 0 }],
    ['une couleur qui n’est pas un hexadécimal', { ...valide, color: 'rouge' }],
    ['une capacité nulle', { ...valide, default_capacity: 0 }],
  ])('refuse %s', (_libelle, patch) => {
    expect(ClassTypePatchSchema.safeParse(patch).success).toBe(false);
  });
});

describe('BoxIdentitySchema', () => {
  const valide = {
    name: 'CrossFit Rueil',
    slug: 'crossfit-rueil',
    timezone: 'Europe/Paris',
    currency: 'EUR',
    default_locale: 'fr' as const,
  };

  it('accepte une identité conforme', () => {
    expect(BoxIdentitySchema.safeParse(valide).success).toBe(true);
  });

  it.each([
    ['un slug à majuscules', { ...valide, slug: 'CrossFit-Rueil' }],
    ['un slug à tiret final', { ...valide, slug: 'crossfit-' }],
    ['un fuseau inexistant', { ...valide, timezone: 'Europe/Neverland' }],
    ['une devise en minuscules', { ...valide, currency: 'eur' }],
    ['une langue non gérée', { ...valide, default_locale: 'de' }],
  ])('refuse %s', (_libelle, identite) => {
    expect(BoxIdentitySchema.safeParse(identite).success).toBe(false);
  });
});

describe('isSupportedTimeZone', () => {
  it('reconnaît un fuseau réel', () => {
    expect(isSupportedTimeZone('Indian/Reunion')).toBe(true);
  });

  it('rejette une chaîne quelconque', () => {
    expect(isSupportedTimeZone('Paris')).toBe(false);
  });
});

describe('timeZoneOptions', () => {
  it('n’ajoute rien quand le fuseau courant est déjà proposé', () => {
    expect(timeZoneOptions('Europe/Paris')).toEqual(timeZoneOptions('Europe/Berlin'));
  });

  // Sinon une box réglée autrement perdrait son fuseau au premier
  // enregistrement — silencieusement, en la regardant.
  it('ajoute le fuseau courant en tête quand il est hors liste', () => {
    expect(timeZoneOptions('Asia/Tokyo')[0]).toBe('Asia/Tokyo');
  });
});

describe('OpeningHourSchema', () => {
  it('normalise les secondes rendues par la base', () => {
    expect(
      OpeningHourSchema.parse({ weekday: 0, opens_at: '06:00:00', closes_at: '13:00:00' }),
    ).toEqual({ weekday: 0, opens_at: '06:00', closes_at: '13:00' });
  });

  it('refuse un créneau qui se ferme avant d’ouvrir', () => {
    expect(
      OpeningHourSchema.safeParse({ weekday: 2, opens_at: '20:00', closes_at: '08:00' }).success,
    ).toBe(false);
  });

  it('refuse un huitième jour', () => {
    expect(
      OpeningHourSchema.safeParse({ weekday: 7, opens_at: '08:00', closes_at: '12:00' }).success,
    ).toBe(false);
  });

  it('refuse une heure impossible', () => {
    expect(
      OpeningHourSchema.safeParse({ weekday: 0, opens_at: '25:00', closes_at: '26:00' }).success,
    ).toBe(false);
  });
});

describe('normalizeTime', () => {
  it('ramène `HH:MM:SS` à `HH:MM`', () => {
    expect(normalizeTime('06:00:00')).toBe('06:00');
    expect(normalizeTime('06:00')).toBe('06:00');
  });
});

// La base ne porte pas cette règle — elle le dit dans un commentaire, et c'est
// ici qu'elle vit. Ces tests sont donc la seule preuve qu'elle existe.
describe('overlappingSlots', () => {
  it('ne voit aucun conflit sur la coupure du midi', () => {
    expect(
      overlappingSlots([
        { weekday: 0, opens_at: '06:00', closes_at: '13:00' },
        { weekday: 0, opens_at: '16:00', closes_at: '21:30' },
      ]),
    ).toEqual([]);
  });

  it('ignore deux créneaux identiques posés sur des jours différents', () => {
    expect(
      overlappingSlots([
        { weekday: 0, opens_at: '06:00', closes_at: '21:00' },
        { weekday: 1, opens_at: '06:00', closes_at: '21:00' },
      ]),
    ).toEqual([]);
  });

  it('rend les deux index en conflit', () => {
    expect(
      overlappingSlots([
        { weekday: 3, opens_at: '06:00', closes_at: '14:00' },
        { weekday: 3, opens_at: '13:00', closes_at: '21:00' },
      ]),
    ).toEqual([0, 1]);
  });

  it('accepte deux créneaux qui se touchent sans se recouvrir', () => {
    expect(
      overlappingSlots([
        { weekday: 4, opens_at: '12:00', closes_at: '13:00' },
        { weekday: 4, opens_at: '13:00', closes_at: '14:00' },
      ]),
    ).toEqual([]);
  });

  it('compare des heures venues de la base, secondes comprises', () => {
    expect(
      overlappingSlots([
        { weekday: 5, opens_at: '09:00:00', closes_at: '13:00:00' },
        { weekday: 5, opens_at: '12:00', closes_at: '14:00' },
      ]),
    ).toEqual([0, 1]);
  });

  it('signale les trois index quand trois créneaux se recouvrent', () => {
    expect(
      overlappingSlots([
        { weekday: 6, opens_at: '08:00', closes_at: '12:00' },
        { weekday: 6, opens_at: '11:00', closes_at: '15:00' },
        { weekday: 6, opens_at: '09:00', closes_at: '10:00' },
      ]),
    ).toEqual([0, 1, 2]);
  });
});
