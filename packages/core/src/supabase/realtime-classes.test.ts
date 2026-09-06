import { describe, expect, it } from 'vitest';
import {
  abonneAuxCoursDuTenant,
  appliqueChangementAuCours,
  appliqueChangementDeCours,
  etatAffiche,
  litLigneCours,
  pastilleEtat,
  type LigneCoursChangee,
} from './realtime-classes';
import type { DayClass, DaySchedule } from './planning';

function cours(overrides: Partial<DayClass> = {}): DayClass {
  return {
    id: 'c1',
    starts_at: '2026-09-07T08:00:00.000Z',
    ends_at: '2026-09-07T09:00:00.000Z',
    capacity: 16,
    booked_count: 15,
    status: 'SCHEDULED',
    cancellation_reason: null,
    className: 'WOD',
    classColor: '#000000',
    roomName: 'Salle 1',
    coachName: 'Sarah D.',
    ...overrides,
  };
}

function journee(classes: DayClass[] = [cours()]): DaySchedule {
  return { date: '2026-09-07', classes, fetchedAt: '2026-09-07T07:00:00.000Z' };
}

describe('appliqueChangementDeCours', () => {
  it('met à jour le compteur du cours visé, et lui seul', () => {
    const avant = journee([cours({ id: 'c1' }), cours({ id: 'c2', booked_count: 3 })]);

    const apres = appliqueChangementDeCours(avant, {
      id: 'c1',
      capacity: 16,
      booked_count: 16,
      status: 'SCHEDULED',
    });

    expect(apres.classes[0]?.booked_count).toBe(16);
    expect(apres.classes[1]?.booked_count).toBe(3);
    // L'autre cours n'est pas seulement égal : c'est **le même objet**. Une
    // copie ferait re-rendre sa ligne pour rien.
    expect(apres.classes[1]).toBe(avant.classes[1]);
  });

  it('ne touche à rien pour un cours qui n’est pas à l’écran', () => {
    // Le filtre du canal porte sur la box, pas sur le jour : l'écran reçoit les
    // changements de tous les cours de sa box et jette ceux qu'il n'affiche pas.
    const avant = journee();

    const apres = appliqueChangementDeCours(avant, {
      id: 'un-cours-d-un-autre-jour',
      capacity: 20,
      booked_count: 20,
      status: 'SCHEDULED',
    });

    expect(apres).toBe(avant);
  });

  it('rend la journée **à l’identique** quand rien n’a bougé', () => {
    // React compare par identité. Rendre un objet neuf sur un événement qui ne
    // change rien ferait re-rendre la liste — le défaut que D-018 a coûté.
    const avant = journee();

    const apres = appliqueChangementDeCours(avant, {
      id: 'c1',
      capacity: 16,
      booked_count: 15,
      status: 'SCHEDULED',
    });

    expect(apres).toBe(avant);
  });

  it('ne déplace pas `fetchedAt` : un événement n’est pas une lecture', () => {
    // `fetchedAt` date la dernière lecture réussie, et c'est lui que le bandeau
    // hors ligne affiche. Le bouger ferait dire à l'écran que la journée est
    // plus fraîche qu'elle ne l'est.
    const avant = journee();

    const apres = appliqueChangementDeCours(avant, {
      id: 'c1',
      capacity: 16,
      booked_count: 16,
      status: 'SCHEDULED',
    });

    expect(apres.fetchedAt).toBe(avant.fetchedAt);
  });

  it('porte une annulation de cours, pas seulement un compteur', () => {
    const apres = appliqueChangementDeCours(journee(), {
      id: 'c1',
      capacity: 16,
      booked_count: 15,
      status: 'CANCELLED',
    });

    expect(apres.classes[0]?.status).toBe('CANCELLED');
  });

  it('ne recopie que les trois champs vivants', () => {
    // Une charge utile Realtime n'est pas passée par `fetchDaySchedule()`, qui
    // choisit ses colonnes. L'état de l'écran part en cache sur l'appareil,
    // hors RLS : ce qui entre ici doit être une liste close.
    const avant = journee();
    const ligne = {
      id: 'c1',
      capacity: 16,
      booked_count: 16,
      status: 'SCHEDULED',
      coachName: 'Nom Complet Indésirable',
    } as LigneCoursChangee & { coachName: string };

    const apres = appliqueChangementDeCours(avant, ligne);

    expect(apres.classes[0]?.coachName).toBe('Sarah D.');
  });
});

describe('appliqueChangementAuCours', () => {
  it('met à jour le cours de l’accueil', () => {
    const apres = appliqueChangementAuCours(cours(), {
      id: 'c1',
      capacity: 16,
      booked_count: 16,
      status: 'SCHEDULED',
    });

    expect(apres.booked_count).toBe(16);
  });

  it('ignore une ligne qui parle d’un autre cours', () => {
    // L'accueil n'affiche que le prochain cours ; le canal porte toute la box.
    const avant = cours();

    expect(
      appliqueChangementAuCours(avant, {
        id: 'c2',
        capacity: 20,
        booked_count: 20,
        status: 'SCHEDULED',
      }),
    ).toBe(avant);
  });

  it('rend le cours **à l’identique** quand rien n’a bougé', () => {
    const avant = cours();

    expect(
      appliqueChangementAuCours(avant, {
        id: 'c1',
        capacity: 16,
        booked_count: 15,
        status: 'SCHEDULED',
      }),
    ).toBe(avant);
  });
});

describe('litLigneCours', () => {
  const valide = { id: 'c1', capacity: 16, booked_count: 15, status: 'SCHEDULED' };

  it('accepte une charge utile conforme', () => {
    expect(litLigneCours(valide)).toEqual({
      id: 'c1',
      capacity: 16,
      booked_count: 15,
      status: 'SCHEDULED',
    });
  });

  it.each([
    ['null', null],
    ['une chaîne', 'classes'],
    ['un identifiant vide', { ...valide, id: '' }],
    ['un compteur absent', { id: 'c1', capacity: 16, status: 'SCHEDULED' }],
    ['un compteur en texte', { ...valide, booked_count: '15' }],
    ['un compteur décimal', { ...valide, booked_count: 15.5 }],
    ['un statut inconnu', { ...valide, status: 'DRAFT' }],
  ])('rejette %s au lieu de le deviner', (_cas, brut) => {
    // Un champ manquant traverserait jusqu'à `seatsLeft()` et afficherait
    // « NaN places restantes » — sur l'écran d'où l'on réserve.
    expect(litLigneCours(brut)).toBeNull();
  });
});

describe('etatAffiche', () => {
  it('dit « connecté » quand le canal tient', () => {
    expect(etatAffiche('connecte', true)).toBe('connecte');
  });

  it('dit « reconnexion » quand le canal tombe **avec** du réseau', () => {
    expect(etatAffiche('perdu', true)).toBe('reconnexion');
  });

  it('dit « hors ligne » sans réseau, canal branché ou non', () => {
    // Annoncer « hors ligne » à quelqu'un dont le Wi-Fi marche fait douter de
    // tout le reste de l'écran ; l'inverse aussi.
    expect(etatAffiche('perdu', false)).toBe('hors_ligne');
    expect(etatAffiche('connecte', false)).toBe('hors_ligne');
  });
});

describe('abonneAuxCoursDuTenant', () => {
  /**
   * Un client réduit à ce que l'abonnement touche, et qui **reproduit la
   * réutilisation par nom** de `RealtimeClient.channel()` : c'est elle qui a
   * cassé l'écran, pas le nôtre.
   */
  function clientFactice() {
    const canaux = new Map<string, { topic: string }>();
    const client = {
      channel(topic: string) {
        const existant = canaux.get(topic);
        if (existant !== undefined) throw new Error(`canal déjà pris : ${topic}`);
        const canal = {
          topic,
          on: () => canal,
          subscribe: () => canal,
        };
        canaux.set(topic, canal);
        return canal;
      },
      removeChannel: () => Promise.resolve('ok'),
    };
    return { client, canaux };
  }

  it('ouvre **un canal par abonnement**, même pour la même box', () => {
    // `client.channel(topic)` rend le canal *existant* quand le nom est pris.
    // Deux écrans sur `classes:<tenant>` recevaient donc le même objet, et le
    // second `.on()` levait « cannot add postgres_changes callbacks after
    // subscribe() » — écran blanc, trouvé au harnais le 6 septembre 2026.
    const { client, canaux } = clientFactice();
    const options = {
      tenantId: 't1',
      surChangement: () => {},
      surEtat: () => {},
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- client réduit à la surface touchée
    const premier = abonneAuxCoursDuTenant(client as any, options);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem
    const second = abonneAuxCoursDuTenant(client as any, options);

    expect(premier.topic).not.toBe(second.topic);
    expect(canaux.size).toBe(2);
  });

  it('nomme le canal d’après la box, pour qu’un journal reste lisible', () => {
    const { client } = clientFactice();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem
    const abonnement = abonneAuxCoursDuTenant(client as any, {
      tenantId: 't1',
      surChangement: () => {},
      surEtat: () => {},
    });

    expect(abonnement.topic).toMatch(/^classes:t1:/);
  });
});

describe('pastilleEtat', () => {
  it('donne à chaque état son libellé, son annonce et son ton', () => {
    expect(pastilleEtat('connecte')).toEqual({
      label: 'realtime.live',
      a11y: 'realtime.live_a11y',
      tone: 'success',
    });
    expect(pastilleEtat('reconnexion')).toEqual({
      label: 'realtime.reconnecting',
      a11y: 'realtime.reconnecting_a11y',
      tone: 'warning',
    });
    expect(pastilleEtat('hors_ligne')).toEqual({
      label: 'realtime.offline',
      a11y: 'realtime.offline_a11y',
      tone: 'neutral',
    });
  });

  it('annonce autre chose que ce qu’il affiche, sur les trois états', () => {
    // La pastille arrive **seule** dans le flux d'un lecteur d'écran : « En
    // direct » n'y dit pas de quoi il s'agit. Si les deux clés se confondaient,
    // l'étiquette d'accessibilité ne servirait à rien et personne ne le verrait.
    for (const etat of ['connecte', 'reconnexion', 'hors_ligne'] as const) {
      const { label, a11y } = pastilleEtat(etat);
      expect(a11y).not.toBe(label);
    }
  });
});
