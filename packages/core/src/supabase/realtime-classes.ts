/**
 * Le canal des places restantes (P1-005a).
 *
 * **Le temps réel est du confort d'affichage.** La vérité est la transaction
 * SQL — spec §10, en face de « Réservation temps réel », et c'est la seule
 * ligne du ticket qui ne se négocie pas. Ce que ce module fait, c'est éviter
 * qu'on apprenne en appuyant sur « Réserver » ce qu'un compteur aurait pu dire.
 *
 * Le module est coupé en deux, et le découpage n'est pas cosmétique :
 *
 * - `appliqueChangementDeCours()` est **pur**, donc testable sans client, sans
 *   réseau et sans écran. C'est là que vit tout ce qui peut se tromper ;
 * - `abonneAuxCoursDuTenant()` ne fait que brancher des fils. Ce qui reste
 *   d'incertain là-dedans n'est pas du ressort d'un test unitaire — c'est le
 *   service Realtime, et ça se vérifie à deux clients.
 */

import type { RealtimeChannel, RealtimePostgresUpdatePayload } from '@supabase/supabase-js';
import type { TranslationKey } from '../i18n/types';
import type { RackClient } from './client';
import type { DayClass, DaySchedule } from './planning';

/**
 * Les seules colonnes qu'un événement fait bouger, et **la raison de cette
 * liste close.**
 *
 * Realtime envoie l'enregistrement entier ; on n'en prend que trois champs.
 * Recopier le reste ferait entrer dans l'état de l'écran des colonnes que la
 * lecture ne projette pas — et cet état part en cache sur l'appareil, hors RLS
 * (contrainte 1 de P1-002b). Une charge utile n'est pas une lecture : elle
 * n'est pas passée par `fetchDaySchedule()`, qui, lui, choisit ses colonnes.
 */
type ChampsVivants = Pick<DayClass, 'capacity' | 'booked_count' | 'status'>;

/** Ce qu'une ligne `classes` porte dans une charge utile Realtime. */
export interface LigneCoursChangee extends ChampsVivants {
  id: string;
}

/**
 * Applique un changement à une journée déjà affichée, **sans jamais la
 * remplacer**.
 *
 * Trois propriétés, et chacune répond à un défaut qu'on aurait sinon :
 *
 * 1. **Un cours absent de la journée ne la modifie pas.** Le filtre du canal
 *    porte sur la box, pas sur le jour — `postgres_changes` n'accepte qu'un
 *    prédicat — donc l'écran reçoit les changements de *tous* les cours de sa
 *    box et jette ceux qu'il n'affiche pas. Ce n'est pas une fuite : la RLS
 *    autorise déjà la box entière. C'est du tri.
 * 2. **L'objet est rendu à l'identique quand rien ne change.** React compare
 *    par identité ; rendre un objet neuf à chaque événement ferait re-rendre la
 *    liste pour rien, et `D-018` vient de coûter cher sur exactement ce sujet.
 * 3. **`fetchedAt` ne bouge pas.** Il date la dernière *lecture*, et c'est lui
 *    que l'écran montre hors ligne (« Planning enregistré {date} »). Un
 *    événement n'est pas une lecture : le déplacer ferait dire au bandeau hors
 *    ligne que la journée est plus fraîche qu'elle ne l'est.
 */
export function appliqueChangementDeCours(
  journee: DaySchedule,
  ligne: LigneCoursChangee,
): DaySchedule {
  const index = journee.classes.findIndex((cours) => cours.id === ligne.id);
  if (index === -1) return journee;

  const actuel = journee.classes[index];
  if (actuel === undefined) return journee;

  const suivant = appliqueChangementAuCours(actuel, ligne);
  if (suivant === actuel) return journee;

  const classes = [...journee.classes];
  classes[index] = suivant;

  return { ...journee, classes };
}

/**
 * Le même changement, sur **un seul cours** — l'accueil n'affiche que le
 * prochain, pas une journée.
 *
 * C'est la moitié partagée des deux écrans, et elle est ici pour la raison qui
 * a fait remonter `groupByDay` dans `packages/core` : une correspondance
 * recopiée diverge en silence. Ici, ce qui divergerait est **la liste close des
 * trois champs qu'on accepte de recopier**, et c'est précisément la ligne qu'on
 * ne veut pas voir s'allonger dans un écran sans que l'autre le sache.
 *
 * Rend `cours` **à l'identique** si rien n'a bougé, ou si la ligne parle d'un
 * autre cours.
 */
export function appliqueChangementAuCours(cours: DayClass, ligne: LigneCoursChangee): DayClass {
  if (cours.id !== ligne.id) return cours;

  const inchange =
    cours.capacity === ligne.capacity &&
    cours.booked_count === ligne.booked_count &&
    cours.status === ligne.status;
  if (inchange) return cours;

  return {
    ...cours,
    capacity: ligne.capacity,
    booked_count: ligne.booked_count,
    status: ligne.status,
  };
}

/**
 * Ce qu'une charge utile Realtime **peut** contenir, et pourquoi on ne la croit
 * pas sur parole.
 *
 * Elle arrive typée `Record<string, unknown>` du service, pas de PostgREST :
 * elle n'a traversé ni Zod ni le typage généré. Un champ manquant ou d'un autre
 * type traverserait jusqu'à `seatsLeft()` et afficherait `NaN places restantes`
 * — sur l'écran d'où l'on réserve. On rejette au lieu de deviner.
 */
export function litLigneCours(brut: unknown): LigneCoursChangee | null {
  if (typeof brut !== 'object' || brut === null) return null;
  const ligne = brut as Record<string, unknown>;

  const { id, capacity, booked_count: bookedCount, status } = ligne;

  if (typeof id !== 'string' || id === '') return null;
  if (!Number.isInteger(capacity) || !Number.isInteger(bookedCount)) return null;
  if (status !== 'SCHEDULED' && status !== 'CANCELLED') return null;

  return {
    id,
    capacity: capacity as number,
    booked_count: bookedCount as number,
    status,
  };
}

/**
 * Ce que le **canal** sait de lui-même. Deux valeurs, parce qu'il n'en sait pas
 * plus : il est branché, ou il ne l'est pas.
 */
export type EtatCanal = 'connecte' | 'perdu';

/** Ce que l'**écran** montre. Trois valeurs, et la troisième n'est pas la même chose. */
export type EtatAffiche = 'connecte' | 'reconnexion' | 'hors_ligne';

/**
 * Traduit « le canal est tombé » en quelque chose de vrai pour la personne qui
 * regarde.
 *
 * **Un canal perdu ne veut pas dire la même chose selon qu'on a du réseau.**
 * Sans réseau, c'est « hors ligne » : la cause est connue, le compteur affiché
 * date, et l'écran le dit déjà par ailleurs. Avec du réseau, c'est
 * « reconnexion » : quelque chose ne va pas côté service, on replie en lecture
 * périodique, et ça se terminera tout seul.
 *
 * Les confondre donnerait un « hors ligne » à quelqu'un dont le Wi-Fi marche —
 * le genre de message qui fait douter de tout le reste de l'écran.
 */
export function etatAffiche(canal: EtatCanal, enLigne: boolean): EtatAffiche {
  if (!enLigne) return 'hors_ligne';
  return canal === 'connecte' ? 'connecte' : 'reconnexion';
}

/**
 * Ce que la pastille dit, à l'œil et à l'oreille.
 *
 * **Ici plutôt que dans chaque écran**, parce que deux écrans la portent et
 * qu'une correspondance dupliquée diverge en silence : c'est déjà l'argument de
 * `groupByDay` en haut de `planning.ts`. La `tone` est une union de valeurs, pas
 * un import de `@rack/ui` — `packages/core` ne dépend d'aucune plateforme.
 *
 * **Deux clés par état, et la seconde n'est pas décorative.** Le libellé visible
 * est court parce que l'œil voit le compteur juste à côté ; le lecteur d'écran,
 * lui, reçoit la pastille seule dans le flux. « En direct » ne dit alors pas de
 * quoi il s'agit.
 */
export function pastilleEtat(etat: EtatAffiche): {
  label: TranslationKey;
  a11y: TranslationKey;
  tone: 'success' | 'warning' | 'neutral';
} {
  if (etat === 'connecte')
    return { label: 'realtime.live', a11y: 'realtime.live_a11y', tone: 'success' };
  if (etat === 'reconnexion')
    return {
      label: 'realtime.reconnecting',
      a11y: 'realtime.reconnecting_a11y',
      tone: 'warning',
    };
  return { label: 'realtime.offline', a11y: 'realtime.offline_a11y', tone: 'neutral' };
}

export interface AbonnementCours {
  /** À appeler au démontage **et** au passage en arrière-plan. */
  arrete: () => void;
  /** Le nom du canal ouvert. Exposé pour être **vérifiable**, pas pour être lu. */
  topic: string;
}

/**
 * **Un canal par abonnement, et c'est un correctif, pas une précaution.**
 *
 * `client.channel(topic)` **rend le canal existant** quand le nom est déjà pris
 * (`RealtimeClient.ts:473`) — il n'en crée pas un second. Deux écrans qui
 * demandaient `classes:<tenant>` recevaient donc le *même* objet, et le second
 * `.on('postgres_changes', …)` sur un canal déjà abonné lève :
 *
 *     cannot add `postgres_changes` callbacks for realtime:classes:… after `subscribe()`
 *
 * Écran blanc sur le planning, trouvé au harnais le 6 septembre 2026. C'est la
 * règle des sœurs sous une forme nouvelle : deux appelants du même helper, une
 * ressource nommée par un identifiant qu'ils partagent sans le savoir.
 *
 * Un compteur de module, et pas d'aléa : `crypto` est interdit hors de sa
 * façade et `Math.random()` serait un repli silencieux là où un entier suffit.
 */
let compteurDeCanal = 0;

/**
 * Branche un canal sur les `update` de `classes` pour une box.
 *
 * **`event: 'UPDATE'` est une décision côté client, et elle ne peut pas être en
 * base.** `pubinsert` / `pubupdate` / `pubdelete` sont des propriétés de la
 * *publication*, pas de la table qu'on y ajoute : `supabase_realtime` publie
 * les trois pour tout ce qu'elle porte. La restriction vit donc ici.
 *
 * **Le repli ne vit pas dans ce module**, et c'est voulu : relire une journée
 * demande `fetchDaySchedule()`, son fuseau, sa locale et son délai
 * d'expiration — tout ce que l'écran connaît et que ce module n'a pas à
 * apprendre. Il rend l'état du canal ; l'appelant décide quoi en faire.
 */
export function abonneAuxCoursDuTenant(
  client: RackClient,
  {
    tenantId,
    surChangement,
    surEtat,
  }: {
    tenantId: string;
    surChangement: (ligne: LigneCoursChangee) => void;
    surEtat: (etat: EtatCanal) => void;
  },
): AbonnementCours {
  const topic = `classes:${tenantId}:${(compteurDeCanal += 1)}`;
  const canal: RealtimeChannel = client
    .channel(topic)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'classes',
        filter: `tenant_id=eq.${tenantId}`,
      },
      (charge: RealtimePostgresUpdatePayload<Record<string, unknown>>) => {
        const ligne = litLigneCours(charge.new);
        if (ligne !== null) surChangement(ligne);
      },
    )
    .subscribe((statut) => {
      // `CLOSED` n'est pas une panne : c'est aussi ce qu'on reçoit après
      // `arrete()`. L'écran est démonté ou en arrière-plan — lui annoncer
      // « hors ligne » ferait clignoter une pastille que personne ne regarde,
      // et relancerait un repli sur un écran qu'on vient de quitter.
      if (statut === 'SUBSCRIBED') surEtat('connecte');
      else if (statut === 'CHANNEL_ERROR' || statut === 'TIMED_OUT') surEtat('perdu');
    });

  return {
    topic,
    arrete: () => {
      void client.removeChannel(canal);
    },
  };
}
