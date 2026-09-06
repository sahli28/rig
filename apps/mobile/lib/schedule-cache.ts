/**
 * Le cache du planning — **une copie de données de box posée hors RLS**.
 *
 * Une fois écrite sur l'appareil, plus aucune policy ne la protège : elle
 * survit à la déconnexion si personne ne l'efface, elle part dans une
 * sauvegarde, elle appartient au téléphone et non plus à la base. La
 * minimisation de `.claude/rules/privacy.md` — qui vaut **aussi à l'intérieur
 * d'une box** — s'applique donc plus strictement ici qu'à une requête.
 *
 * Trois décisions, toutes tranchées dans P1-002b avant d'écrire :
 *
 * 1. **ce qui entre** est décidé par la forme de `DaySchedule` : créneaux,
 *    capacité, compteur, type de cours, salle. Jamais d'adresse, jamais un
 *    inscrit, jamais un jeton. La forme est dans `@rack/core` pour que l'ajout
 *    d'un champ soit une décision visible, pas un `select *` qui déborde ;
 * 2. **la clé est `(utilisateur, box, jour)`.** Une clé par box seule ferait
 *    voir à deux membres d'un téléphone partagé les données l'un de l'autre ;
 * 3. **le cache ne fait jamais autorité sur une place.** Ce module ne rend
 *    jamais un `DaySchedule` sans dire d'où il vient — l'écran ne peut pas
 *    l'oublier, parce que le type l'y oblige.
 *
 * `AsyncStorage` et non le trousseau : ce ne sont pas des secrets, et un
 * trousseau plafonne à 2 Ko par valeur. Ce qui est un secret — la session —
 * reste dans le trousseau.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { DayScheduleSchema, type BookedDays, type DaySchedule } from '@rack/core/supabase';

/** Jour → identifiants de cours. Écrit ici et non dans `@rack/core` : c'est la
 * forme du **cache**, pas celle de la lecture réseau — et un schéma partagé
 * aurait fait croire que les deux doivent rester identiques.
 *
 * Portait des comptes jusqu'à P1-012. Un cache de la version précédente ne
 * valide donc plus, et c'est exactement ce qu'on veut : `readBookedDays()` le
 * jette et la première lecture réseau le remplace. */
const BookedDaysSchema = z.record(z.string(), z.array(z.string()));

/** Préfixe commun : c'est lui qui rend l'effacement complet possible. */
const PREFIX = 'rack.schedule.';

/**
 * Les jours réservés d'un mois (P1-014). **Préfixe distinct, purge commune** :
 * ce sont deux formes différentes, mais une seule règle d'effacement — et une
 * seconde purge à tenir d'accord avec la première serait une purge qui finit
 * par oublier une moitié.
 */
const PREFIX_JOURS = 'rack.bookeddays.';

function keyFor(userId: string, tenantId: string, date: string): string {
  return `${PREFIX}${userId}.${tenantId}.${date}`;
}

function keyForMonth(userId: string, tenantId: string, mois: string): string {
  return `${PREFIX_JOURS}${userId}.${tenantId}.${mois}`;
}

/**
 * D'où vient ce qui est à l'écran.
 *
 * `'network'` — lu à l'instant, la place affichée est celle de la base.
 * `'cache'` — lu sur l'appareil, daté, et **aucune réservation n'est possible**.
 *
 * Le type force l'écran à trancher : il n'existe pas de `DaySchedule` sans
 * origine, donc pas d'écran qui affiche « 3 places » sans savoir de quand elles
 * datent.
 */
export type ScheduleOrigin = 'network' | 'cache';

export interface LoadedSchedule {
  schedule: DaySchedule;
  origin: ScheduleOrigin;
}

/** Écrit une journée. Un échec n'a pas de conséquence : le réseau reste la vérité. */
export async function writeDay(
  userId: string,
  tenantId: string,
  schedule: DaySchedule,
): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId, tenantId, schedule.date), JSON.stringify(schedule));
  } catch {
    /* pas de cache cette fois-ci ; l'écran fonctionne, il sera juste moins bavard hors ligne */
  }
}

/**
 * Relit une journée, ou `null`.
 *
 * **Validé, pas transtypé.** Ce que le disque rend a pu être écrit par une
 * version antérieure de l'app ; un champ manquant traverserait jusqu'au rendu
 * et casserait l'écran **hors ligne**, c'est-à-dire au moment où l'on peut le
 * moins se le permettre. Un cache illisible se jette.
 */
export async function readDay(
  userId: string,
  tenantId: string,
  date: string,
): Promise<DaySchedule | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId, tenantId, date));
    if (raw === null) return null;
    const parsed = DayScheduleSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Les jours réservés d'un mois — **des dates et un compte, rien d'autre**
 * (P1-014).
 *
 * **Exactement l'option B de P1-012** : des identifiants de cours, et rien
 * d'autre — ni heure, ni nom, ni identifiant de réservation. Ce que ce cache
 * révèle à qui prend le téléphone, c'est « quelqu'un s'est entraîné ces
 * jours-là » — et la personne qui le lit est celle qui y était.
 *
 * Même clé `(utilisateur, box, …)` que le planning, pour la même raison : sur
 * un téléphone partagé, deux membres ne se voient pas.
 */
export async function writeBookedDays(
  userId: string,
  tenantId: string,
  mois: string,
  jours: BookedDays,
): Promise<void> {
  try {
    await AsyncStorage.setItem(keyForMonth(userId, tenantId, mois), JSON.stringify(jours));
  } catch {
    /* pas de cache ce mois-ci ; les pastilles reviendront avec le réseau */
  }
}

/**
 * Relit les jours réservés d'un mois, ou `{}`.
 *
 * **Validé, pas transtypé**, comme `readDay()` : ce que le disque rend a pu être
 * écrit par une version antérieure. Un cache illisible se jette — une pastille
 * absente est un désagrément, un écran cassé hors ligne en est un autre.
 */
export async function readBookedDays(
  userId: string,
  tenantId: string,
  mois: string,
): Promise<BookedDays> {
  try {
    const raw = await AsyncStorage.getItem(keyForMonth(userId, tenantId, mois));
    if (raw === null) return {};
    const parsed = BookedDaysSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

/**
 * Efface tout ce que ce module a écrit sur cet appareil.
 *
 * Appelé à la **déconnexion**, et il le sera au **changement de box** (P1-009) :
 * la contrainte est inscrite des deux côtés, sinon elle n'existe d'aucun.
 *
 * Efface tout le préfixe plutôt que les seules clés d'un compte : sur un
 * téléphone partagé, ce qui reste du compte précédent est précisément ce qu'on
 * ne veut pas garder. Un cache de trop effacé se recharge en une requête.
 */
export async function clearScheduleCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    // **Les deux préfixes, une seule purge.** Une seconde fonction d'effacement
    // serait une fonction qu'on oublie d'appeler le jour où la déconnexion
    // change de forme.
    const ours = keys.filter((key) => key.startsWith(PREFIX) || key.startsWith(PREFIX_JOURS));
    if (ours.length > 0) await AsyncStorage.multiRemove(ours);
  } catch {
    /* rien à faire : les clés suivantes écraseront celles-ci */
  }
}
