import { describe, expect, it, vi } from 'vitest';
import type { RackClient } from './client';
import {
  BookingFailed,
  bookClass,
  bookingAffordance,
  cancelBooking,
  cancelConsequence,
  fetchBookedDays,
  affordanceLabelKey,
  affordanceHint,
  type AffordanceInput,
} from './bookings';

/**
 * **La moitié de ce ticket qui se teste sans écran.**
 *
 * Les cinq refus de `book_class()` se jugent autrement à la main : il faut un
 * appareil, un seed préparé, et un cours dans le bon état. `bookingAffordance`
 * est la même décision, prise avant l'appel, sous forme de fonction pure — donc
 * vérifiable aux bornes, à la seconde près, ce qu'aucune passe manuelle ne sait
 * faire.
 *
 * **Ce que ces tests ne prouvent pas** : que la base répondra pareil. C'est
 * `book_class()` qui décide, et elle seule ; l'écran n'a le droit de se tromper
 * que dans un sens — proposer une action que la base refusera, jamais refuser
 * une action que la base aurait acceptée. D'où l'ordre des cas ci-dessous, qui
 * est **celui du SQL**, ligne pour ligne.
 */

const RÈGLES = {
  open_days_before: 7,
  close_minutes_before: 15,
  cancel_window_minutes: 240,
  max_upcoming_bookings: 3,
};

const MAINTENANT = new Date('2026-09-05T10:00:00Z');

/** Un cours dans deux heures, à moitié plein : le cas nominal. */
function entrée(patch: Partial<AffordanceInput> = {}): AffordanceInput {
  return {
    klass: {
      starts_at: '2026-09-05T12:00:00Z',
      capacity: 16,
      booked_count: 3,
      status: 'SCHEDULED',
    },
    rules: RÈGLES,
    now: MAINTENANT,
    alreadyBooked: false,
    upcomingCount: 0,
    online: true,
    origin: 'network',
    ...patch,
  };
}

describe('bookingAffordance — la décision, avant l’appel', () => {
  it('rend « réservable » avec les places restantes', () => {
    expect(bookingAffordance(entrée())).toEqual({ kind: 'bookable', seatsLeft: 13 });
  });

  it('hors ligne : aucune action, même sur un cours parfaitement réservable', () => {
    expect(bookingAffordance(entrée({ online: false }))).toEqual({ kind: 'offline' });
  });

  it('journée venue du cache : aucune action non plus', () => {
    // Le cache ne fait jamais autorité sur une place (P1-002b). Un bouton grisé
    // laisserait croire qu'un tap suffirait ; il n'y a pas de bouton.
    expect(bookingAffordance(entrée({ origin: 'cache' }))).toEqual({ kind: 'offline' });
  });

  it('un cours annulé passe avant tout le reste, comme dans le SQL', () => {
    const a = bookingAffordance(entrée({ klass: { ...entrée().klass, status: 'CANCELLED' } }));
    expect(a).toEqual({ kind: 'cancelled' });
  });

  it('déjà réservé passe avant les fenêtres et le plafond', () => {
    // L'ordre n'est pas cosmétique : qui a déjà sa place ne doit pas s'entendre
    // dire qu'elle est fermée. Le SQL a corrigé exactement ce défaut.
    const a = bookingAffordance(
      entrée({
        alreadyBooked: true,
        upcomingCount: 99,
        klass: { ...entrée().klass, booked_count: 16 },
      }),
    );
    expect(a).toEqual({ kind: 'already_booked' });
  });

  describe('la fenêtre de fermeture', () => {
    it('encore ouverte **pile** au seuil — le SQL compare avec `<`', () => {
      // Écrit d'abord à l'envers, et le test a eu raison : à exactement quinze
      // minutes, `starts_at - now() < 15 min` est faux, donc la base accepte
      // encore. Un écran qui refuserait ici refuserait une action que la base
      // aurait acceptée — la seule erreur qu'il n'a pas le droit de faire.
      const now = new Date('2026-09-05T11:45:00Z');
      expect(bookingAffordance(entrée({ now })).kind).toBe('bookable');
    });

    it('close une seconde plus tard', () => {
      const now = new Date('2026-09-05T11:45:01Z');
      expect(bookingAffordance(entrée({ now }))).toEqual({
        kind: 'window_closed',
        minutes: 15,
      });
    });

    it('close aussi quand le cours a déjà commencé', () => {
      const now = new Date('2026-09-05T13:00:00Z');
      expect(bookingAffordance(entrée({ now })).kind).toBe('window_closed');
    });
  });

  describe('la fenêtre d’ouverture', () => {
    it('ouverte pile au seuil', () => {
      // Exactement 7 jours avant : `>` dans le SQL, donc encore réservable.
      const now = new Date('2026-08-29T12:00:00Z');
      expect(bookingAffordance(entrée({ now })).kind).toBe('bookable');
    });

    it('pas encore ouverte une seconde plus tôt', () => {
      const now = new Date('2026-08-29T11:59:59Z');
      expect(bookingAffordance(entrée({ now }))).toEqual({ kind: 'window_not_open', days: 7 });
    });
  });

  it('le plafond passe avant la capacité, comme dans le SQL', () => {
    const a = bookingAffordance(
      entrée({ upcomingCount: 3, klass: { ...entrée().klass, booked_count: 16 } }),
    );
    expect(a).toEqual({ kind: 'cap_reached', upcoming: 3 });
  });

  it('complet quand le compteur atteint la capacité', () => {
    expect(bookingAffordance(entrée({ klass: { ...entrée().klass, booked_count: 16 } }))).toEqual({
      kind: 'full',
    });
  });

  it('complet aussi si le compteur dépasse la capacité', () => {
    // Ne devrait pas arriver — la base a une contrainte. Un écran qui afficherait
    // « -1 place restante » serait pourtant le symptôme le plus lisible du jour
    // où ça arriverait quand même.
    expect(bookingAffordance(entrée({ klass: { ...entrée().klass, booked_count: 20 } })).kind).toBe(
      'full',
    );
  });
});

describe('les mots que porte chaque état', () => {
  it('chaque état a un libellé de bouton', () => {
    const états: AffordanceInput[] = [
      entrée(),
      entrée({ online: false }),
      entrée({ alreadyBooked: true }),
      entrée({ klass: { ...entrée().klass, status: 'CANCELLED' } }),
      entrée({ klass: { ...entrée().klass, booked_count: 16 } }),
      entrée({ now: new Date('2026-09-05T11:50:00Z') }),
      entrée({ now: new Date('2026-08-01T12:00:00Z') }),
      entrée({ upcomingCount: 3 }),
    ];
    for (const état of états) {
      expect(affordanceLabelKey(bookingAffordance(état))).toMatch(/^(booking|planning)\./);
    }
  });

  it('les trois refus chiffrés portent leur nombre, pour que la phrase soit vraie', () => {
    // « Les réservations ferment 15 minutes avant » : le 15 vient des réglages de
    // la box, jamais d'une constante écrite dans la phrase.
    expect(
      affordanceHint(bookingAffordance(entrée({ now: new Date('2026-09-05T11:50:00Z') }))),
    ).toEqual({ key: 'booking.window_closed_hint', count: 15 });
    expect(
      affordanceHint(bookingAffordance(entrée({ now: new Date('2026-08-01T12:00:00Z') }))),
    ).toEqual({ key: 'booking.window_not_open_hint', count: 7 });
    expect(affordanceHint(bookingAffordance(entrée({ upcomingCount: 3 })))).toEqual({
      key: 'booking.cap_reached_hint',
      count: 3,
    });
  });

  it('un cours complet a une phrase, et elle ne promet rien', () => {
    // Décision du ticket : une impasse se répare par une porte de sortie, pas
    // par une promesse. Ni « reviens plus tard » (rien ne se libère avant
    // P1-004), ni « demande à ta box » (personne ne peut placer personne).
    expect(
      affordanceHint(bookingAffordance(entrée({ klass: { ...entrée().klass, booked_count: 16 } }))),
    ).toEqual({ key: 'booking.full_hint' });
  });

  it('l’état réservable n’a pas de phrase d’excuse', () => {
    expect(affordanceHint(bookingAffordance(entrée()))).toBeNull();
  });
});

/** Client simulé, réduit à `rpc`. Le vrai part sur le réseau, pas celui-ci. */
function fakeClient(réponse: { data?: unknown; error?: unknown }) {
  const appels: { fn: string; args: unknown }[] = [];
  const client = {
    rpc(fn: string, args: unknown) {
      appels.push({ fn, args });
      return Promise.resolve({ data: réponse.data ?? null, error: réponse.error ?? null });
    },
  };
  return { client: client as unknown as RackClient, appels };
}

const RÉSERVATION = '0192f4b2-0000-7000-8000-000000000001';

describe('bookClass', () => {
  it('passe les trois arguments sous leurs noms SQL', async () => {
    const { client, appels } = fakeClient({ data: RÉSERVATION });
    await bookClass(client, {
      classId: 'c1',
      membershipId: 'm1',
      idempotencyKey: 'k1',
    });
    expect(appels).toEqual([
      {
        fn: 'book_class',
        args: { p_class_id: 'c1', p_membership_id: 'm1', p_idempotency_key: 'k1' },
      },
    ]);
  });

  it('rend l’identifiant de la réservation', async () => {
    const { client } = fakeClient({ data: RÉSERVATION });
    await expect(
      bookClass(client, { classId: 'c1', membershipId: 'm1', idempotencyKey: 'k1' }),
    ).resolves.toBe(RÉSERVATION);
  });

  it('rejoue la même clé et rend la même réservation — la règle 4, vue du client', async () => {
    // Côté base, le rejeu est un `select` avant tout travail. Côté client, ce qui
    // compte est qu'on **renvoie la même clé** : c'est l'écran qui la conserve,
    // du premier tap jusqu'à la réponse. Une clé regénérée à chaque essai ne
    // protégerait de rien, et c'est précisément le cas du réseau lent.
    const { client, appels } = fakeClient({ data: RÉSERVATION });
    const args = { classId: 'c1', membershipId: 'm1', idempotencyKey: 'k1' };
    const premier = await bookClass(client, args);
    const second = await bookClass(client, args);
    expect(second).toBe(premier);
    expect(appels[0]?.args).toEqual(appels[1]?.args);
  });

  it('mesure la durée quand on lui donne de quoi la noter', async () => {
    // Ce qui rend le p95 mesurable au lieu d'être une impression. Un rappel
    // plutôt qu'un `console.log` : `packages/core` ne doit rien supposer de son
    // hôte, et l'app décide seule d'écrire ou non.
    const { client } = fakeClient({ data: RÉSERVATION });
    const durées: number[] = [];
    await bookClass(
      client,
      { classId: 'c1', membershipId: 'm1', idempotencyKey: 'k1' },
      { onDuration: (ms) => durées.push(ms) },
    );
    expect(durées).toHaveLength(1);
    expect(durées[0]).toBeGreaterThanOrEqual(0);
  });

  describe('les refus de la base deviennent des clés i18n', () => {
    const CAS = [
      ['CLASS_FULL', 'errors.class_full'],
      ['ALREADY_BOOKED', 'errors.already_booked'],
      ['BOOKING_WINDOW_CLOSED', 'errors.booking_window_closed'],
      ['NO_VALID_ENTITLEMENT', 'errors.no_valid_entitlement'],
      ['MAX_UPCOMING_BOOKINGS_REACHED', 'errors.max_upcoming_bookings_reached'],
      ['IDEMPOTENCY_KEY_REQUIRED', 'errors.idempotency_key_required'],
    ] as const;

    for (const [code, clé] of CAS) {
      it(`${code} → ${clé}`, async () => {
        const { client } = fakeClient({
          error: { code: '23514', details: JSON.stringify({ code }), message: 'boom' },
        });
        const échec = await bookClass(client, {
          classId: 'c1',
          membershipId: 'm1',
          idempotencyKey: 'k1',
        }).catch((e: unknown) => e);
        expect(échec).toBeInstanceOf(BookingFailed);
        expect((échec as BookingFailed).code).toBe(code);
        expect((échec as BookingFailed).messageKey).toBe(clé);
      });
    }

    it('une erreur inconnue rend `errors.unknown`, jamais le texte de la base', async () => {
      // §12.3 : le client réagit au code, et n'affiche jamais un message SQL —
      // qui est en anglais, technique, et parfois révélateur du schéma.
      const { client } = fakeClient({
        error: { code: '42P01', message: 'relation "bookings" does not exist' },
      });
      const échec = await bookClass(client, {
        classId: 'c1',
        membershipId: 'm1',
        idempotencyKey: 'k1',
      }).catch((e: unknown) => e);
      expect((échec as BookingFailed).messageKey).toBe('errors.unknown');
      expect((échec as BookingFailed).code).toBeNull();
    });

    it('un identifiant de réservation absent est un échec, pas un succès muet', async () => {
      // PostgREST rend `null` sans erreur si la fonction ne rend rien. Traiter ça
      // comme une réussite afficherait « c'est réservé » sur une place qui n'existe
      // pas — le mensonge exact que P1-003 a passé un lot à rendre impossible.
      const { client } = fakeClient({ data: null });
      await expect(
        bookClass(client, { classId: 'c1', membershipId: 'm1', idempotencyKey: 'k1' }),
      ).rejects.toBeInstanceOf(BookingFailed);
    });
  });

  it('n’avale pas une panne réseau : elle remonte traduite, pas masquée', async () => {
    const client = {
      rpc: vi.fn(() => Promise.reject(new TypeError('Network request failed'))),
    } as unknown as RackClient;
    const échec = await bookClass(client, {
      classId: 'c1',
      membershipId: 'm1',
      idempotencyKey: 'k1',
    }).catch((e: unknown) => e);
    expect(échec).toBeInstanceOf(BookingFailed);
    expect((échec as BookingFailed).messageKey).toBe('errors.unknown');
  });
});

describe('cancelConsequence', () => {
  const startsAt = '2026-09-10T18:30:00.000Z';
  const à = (iso: string) => new Date(iso);

  // Les bornes sont tout le sujet d'une fenêtre : le ticket demande un test
  // explicite à J-4h01 et J-3h59, et les voici à la minute.
  it('rend « libre » juste avant la borne', () => {
    expect(
      cancelConsequence({
        startsAt,
        cancelWindowMinutes: 240,
        now: à('2026-09-10T14:29:00.000Z'), // 241 minutes avant
      }),
    ).toEqual({ kind: 'free' });
  });

  it('rend « tardive » juste après', () => {
    expect(
      cancelConsequence({
        startsAt,
        cancelWindowMinutes: 240,
        now: à('2026-09-10T14:31:00.000Z'), // 239 minutes avant
      }),
    ).toEqual({ kind: 'late', minutesBefore: 239 });
  });

  // Pile sur la borne : `>=` côté base, donc libre. Les deux comparaisons
  // doivent dire la même chose, sinon l'écran annonce autre chose que ce qui
  // arrivera.
  it('rend « libre » exactement sur la borne, comme la base', () => {
    expect(
      cancelConsequence({
        startsAt,
        cancelWindowMinutes: 240,
        now: à('2026-09-10T14:30:00.000Z'),
      }),
    ).toEqual({ kind: 'free' });
  });

  it('suit le réglage de la box, pas une constante', () => {
    const now = à('2026-09-10T17:00:00.000Z'); // 90 minutes avant
    expect(cancelConsequence({ startsAt, cancelWindowMinutes: 240, now }).kind).toBe('late');
    expect(cancelConsequence({ startsAt, cancelWindowMinutes: 60, now }).kind).toBe('free');
  });

  // ---------------------------------------------------------------------
  // La seconde borne : le début du cours
  // ---------------------------------------------------------------------
  //
  // Elle est arrivée après coup, et ce test-ci disait l'inverse : à J+12 min il
  // attendait `{ late, minutesBefore: 0 }`, c'est-à-dire « tardif mais faisable
  // ». Le titre — « ne rend jamais un nombre de minutes négatif » — décrivait
  // un affichage à corriger, pas une règle métier : la règle manquait, et un
  // cours déjà passé s'annulait.
  //
  // Ce que la garde protège est écrit dans `cancel_booking()` : le no-show de
  // RM3.4 devenait effaçable, et `booked_count` était décrémenté sur un cours
  // qui avait eu lieu.

  it('rend « tardive » une minute avant le début', () => {
    expect(
      cancelConsequence({
        startsAt,
        cancelWindowMinutes: 240,
        now: à('2026-09-10T18:29:00.000Z'),
      }),
    ).toEqual({ kind: 'late', minutesBefore: 1 });
  });

  it('rend « commencé » une minute après le début', () => {
    expect(
      cancelConsequence({
        startsAt,
        cancelWindowMinutes: 240,
        now: à('2026-09-10T18:31:00.000Z'),
      }),
    ).toEqual({ kind: 'started' });
  });

  // Pile au début : `<=` côté base comme ici. À la seconde du début, le cours a
  // commencé — les deux comparaisons doivent dire la même chose.
  it('rend « commencé » exactement au début, comme la base', () => {
    expect(
      cancelConsequence({
        startsAt,
        cancelWindowMinutes: 240,
        now: à('2026-09-10T18:30:00.000Z'),
      }),
    ).toEqual({ kind: 'started' });
  });

  // Le corollaire du cas ci-dessus : plus aucun chemin ne rend un compte à
  // rebours négatif, puisqu'il n'y a plus de conséquence à annoncer passé le
  // début. C'est ce que l'ancien `minutesBefore: 0` bricolait.
  it('ne rend jamais un nombre de minutes négatif', () => {
    const après = cancelConsequence({
      startsAt,
      cancelWindowMinutes: 240,
      now: à('2026-09-10T18:42:00.000Z'),
    });
    expect(après).toEqual({ kind: 'started' });
    expect(après).not.toHaveProperty('minutesBefore');
  });

  // Une box à zéro minute de fenêtre : tout est libre jusqu'au début. C'est un
  // réglage valide (`cancel_window_minutes >= 0`), pas un cas limite absurde.
  it('accepte une fenêtre nulle', () => {
    expect(
      cancelConsequence({
        startsAt,
        cancelWindowMinutes: 0,
        now: à('2026-09-10T18:29:00.000Z'),
      }),
    ).toEqual({ kind: 'free' });
  });
});

describe('cancelBooking', () => {
  it('appelle cancel_booking avec le seul identifiant — il est l’idempotence', async () => {
    const { client, appels } = fakeClient({ data: RÉSERVATION });
    await cancelBooking(client, RÉSERVATION);
    expect(appels).toEqual([{ fn: 'cancel_booking', args: { p_booking_id: RÉSERVATION } }]);
  });

  it('rejoue sans effet : la base rend la même réservation', async () => {
    const { client } = fakeClient({ data: RÉSERVATION });
    expect(await cancelBooking(client, RÉSERVATION)).toBe(RÉSERVATION);
    expect(await cancelBooking(client, RÉSERVATION)).toBe(RÉSERVATION);
  });

  // Le refus qui a sa propre phrase : « ce cours a déjà eu lieu ». Il partage
  // son SQLSTATE avec `BOOKING_WINDOW_CLOSED`, donc seul le code applicatif le
  // distingue — et l'écran ne réagit qu'au code.
  it('traduit CLASS_ALREADY_STARTED en une phrase qui dit quoi faire', async () => {
    const { client } = fakeClient({
      error: {
        code: '23514',
        message: 'Ce cours a déjà eu lieu.',
        details: JSON.stringify({ code: 'CLASS_ALREADY_STARTED' }),
      },
    });
    await expect(cancelBooking(client, RÉSERVATION)).rejects.toMatchObject({
      code: 'CLASS_ALREADY_STARTED',
      messageKey: 'errors.class_already_started',
    });
  });

  it('traduit un refus au lieu de le laisser passer nu', async () => {
    const { client } = fakeClient({
      error: {
        code: 'P0001',
        message: 'refus',
        details: JSON.stringify({ code: 'FORBIDDEN_ROLE' }),
      },
    });
    await expect(cancelBooking(client, RÉSERVATION)).rejects.toMatchObject({
      code: 'FORBIDDEN_ROLE',
    });
  });

  // Même piège que `bookClass()` : PostgREST rend `null` sans erreur si la
  // fonction ne rend rien. Le traiter comme une réussite afficherait « annulé »
  // sur une place toujours prise.
  it('refuse un null silencieux', async () => {
    const { client } = fakeClient({});
    await expect(cancelBooking(client, RÉSERVATION)).rejects.toBeInstanceOf(BookingFailed);
  });
});

// ---------------------------------------------------------------------------
// fetchBookedDays — P1-014
// ---------------------------------------------------------------------------

/**
 * Client simulé avec un constructeur de requête **attendable**, contrairement à
 * `fakeClient()` plus haut qui ne connaît que `rpc()`. Il rend une réponse par
 * table et retient les filtres — ce sont eux qui portent tout le risque de cette
 * fonction : mal borner, c'est ramener un mois qu'on n'affiche pas, ou en
 * manquer un bout.
 */
function fakeTableClient(parTable: Record<string, unknown[]>) {
  const filtres: Record<string, [string, unknown][]> = {};

  function builder(table: string) {
    filtres[table] ??= [];
    const chaine = {
      eq(colonne: string, valeur: unknown) {
        filtres[table]?.push([colonne, valeur]);
        return chaine;
      },
      is(colonne: string, valeur: unknown) {
        filtres[table]?.push([`is:${colonne}`, valeur]);
        return chaine;
      },
      gte(colonne: string, valeur: unknown) {
        filtres[table]?.push([`gte:${colonne}`, valeur]);
        return chaine;
      },
      lt(colonne: string, valeur: unknown) {
        filtres[table]?.push([`lt:${colonne}`, valeur]);
        return chaine;
      },
      then(resolve: (r: { data: unknown[]; error: null }) => unknown) {
        return Promise.resolve({ data: parTable[table] ?? [], error: null }).then(resolve);
      },
    };
    return chaine;
  }

  const client = {
    from(table: string) {
      return { select: () => builder(table) };
    },
  };

  return { client: client as unknown as RackClient, filtres };
}

const TENANT = 'aaaaaaaa-0000-4000-8000-000000000001';

describe('fetchBookedDays', () => {
  it('ne part pas chercher les cours quand il n’y a aucune réservation', async () => {
    const { client, filtres } = fakeTableClient({ bookings: [] });
    await expect(
      fetchBookedDays(client, {
        tenantId: TENANT,
        membershipId: 'm1',
        timeZone: 'Europe/Paris',
        from: '2026-09-01',
        to: '2026-09-30',
      }),
    ).resolves.toEqual({});
    // La seconde requête n'a pas eu lieu : rien à croiser, rien à demander.
    expect(filtres.classes).toBeUndefined();
  });

  it('range les cours réservés par jour, et ignore ceux qu’on n’a pas réservés', async () => {
    const { client } = fakeTableClient({
      bookings: [{ class_id: 'c1' }, { class_id: 'c2' }, { class_id: 'c3' }],
      classes: [
        { id: 'c1', starts_at: '2026-09-07T16:30:00.000Z' },
        { id: 'c2', starts_at: '2026-09-07T05:00:00.000Z' },
        { id: 'c3', starts_at: '2026-09-11T16:30:00.000Z' },
        // Celui-là est dans l'intervalle mais n'est pas réservé.
        { id: 'c9', starts_at: '2026-09-09T16:30:00.000Z' },
      ],
    });

    await expect(
      fetchBookedDays(client, {
        tenantId: TENANT,
        membershipId: 'm1',
        timeZone: 'Europe/Paris',
        from: '2026-09-01',
        to: '2026-09-30',
      }),
    ).resolves.toEqual({ '2026-09-07': ['c1', 'c2'], '2026-09-11': ['c3'] });
  });

  /**
   * **Le piège de tout ce ticket, et le seul qui ne se verrait pas à l'écran.**
   *
   * Un cours à 00h30 le 1er octobre à Paris est le 30 septembre à 22h30 en UTC.
   * Un `starts_at.slice(0, 10)` poserait la pastille sur le 30 septembre — donc
   * sur le mauvais jour **et le mauvais mois**, une fois par mois, et seulement
   * pour les cours de fin de soirée. Règle 9 de `CLAUDE.md`.
   */
  it('pose la pastille sur la date locale de la box, jamais sur l’UTC', async () => {
    const { client } = fakeTableClient({
      bookings: [{ class_id: 'nuit' }],
      classes: [{ id: 'nuit', starts_at: '2026-09-30T22:30:00.000Z' }],
    });

    await expect(
      fetchBookedDays(client, {
        tenantId: TENANT,
        membershipId: 'm1',
        timeZone: 'Europe/Paris',
        from: '2026-10-01',
        to: '2026-10-31',
      }),
    ).resolves.toEqual({ '2026-10-01': ['nuit'] });
  });

  it('borne la requête sur la journée locale, pas sur minuit UTC', async () => {
    const { client, filtres } = fakeTableClient({
      bookings: [{ class_id: 'c1' }],
      classes: [],
    });

    await fetchBookedDays(client, {
      tenantId: TENANT,
      membershipId: 'm1',
      timeZone: 'Europe/Paris',
      from: '2026-09-01',
      to: '2026-09-30',
    });

    // Septembre à Paris est en heure d'été : minuit local est 22 h la veille.
    // La borne haute est **le 1er octobre local**, exclu — sans quoi un cours du
    // 30 septembre à 23 h manquerait au mois qui l'affiche.
    expect(filtres.classes).toEqual([
      ['tenant_id', TENANT],
      ['is:deleted_at', null],
      ['gte:starts_at', '2026-08-31T22:00:00.000Z'],
      ['lt:starts_at', '2026-09-30T22:00:00.000Z'],
    ]);
  });

  it('ne lit que ses propres réservations confirmées', async () => {
    const { client, filtres } = fakeTableClient({ bookings: [] });
    await fetchBookedDays(client, {
      tenantId: TENANT,
      membershipId: 'm1',
      timeZone: 'Europe/Paris',
      from: '2026-09-01',
      to: '2026-09-30',
    });
    // `tenant_id` est posé par `tenantScope()`, les deux autres par la fonction.
    expect(filtres.bookings).toEqual([
      ['tenant_id', TENANT],
      ['membership_id', 'm1'],
      ['status', 'CONFIRMED'],
    ]);
  });
});
