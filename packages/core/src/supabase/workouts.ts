/**
 * La séance d'un cours — le texte que le coach écrit (P1-015).
 *
 * **Le produit stocke et affiche, il ne modélise pas.** Ni blocs, ni formats, ni
 * mouvements, ni variantes : le coach tape son texte et le structure lui-même,
 * en y écrivant « Rx » et « Scaled ». Modéliser tout ça parce que `P2-009` en
 * aura besoin reviendrait à construire le Program Builder déguisé, pour
 * quelqu'un qui n'en veut pas.
 *
 * Ce fichier ne porte donc **aucune règle métier transactionnelle** — écrire une
 * séance ne touche ni argent, ni compteur, ni verrou. Ce sont des lectures et
 * une écriture simple ; la règle 3 ne s'applique pas, et c'est pour ça qu'il n'y
 * a pas de fonction PLpgSQL ici.
 */

import { z } from 'zod';
import { tenantScope } from './active-tenant';
import { shiftDays } from './class-schedules';
import type { RackClient } from './client';

/** Une séance, telle qu'un écran l'affiche ou l'édite. */
export interface ClassWorkout {
  id: string;
  classId: string;
  /** `null` quand le coach n'a pas titré : l'affichage retombe sur le type de cours. */
  title: string | null;
  body: string;
  /** `null` = brouillon. Un brouillon n'existe pas pour un membre. */
  publishedAt: string | null;
}

const WorkoutRowSchema = z.object({
  id: z.string(),
  class_id: z.string(),
  title: z.string().nullable(),
  body: z.string(),
  published_at: z.string().nullable(),
});

function toWorkout(row: z.infer<typeof WorkoutRowSchema>): ClassWorkout {
  return {
    id: row.id,
    classId: row.class_id,
    title: row.title,
    body: row.body,
    publishedAt: row.published_at,
  };
}

/**
 * Le titre affiché d'une séance.
 *
 * **Le titre est facultatif**, et le nom du type de cours prend le relais : le
 * coach veut pouvoir titrer ses séances, il ne veut pas y être obligé. Un titre
 * fait de blancs compte comme absent — sinon un espace tapé par mégarde
 * remplacerait « WOD » par rien du tout.
 */
export function workoutTitle(workout: ClassWorkout | null, className: string): string {
  const titre = workout?.title?.trim() ?? '';
  return titre === '' ? className : titre;
}

/** La séance d'une occurrence, ou `null`. La RLS décide de ce qui est lisible. */
export async function fetchClassWorkout(
  client: RackClient,
  { tenantId, classId }: { tenantId: string; classId: string },
): Promise<ClassWorkout | null> {
  const { data, error } = await tenantScope(client, tenantId)
    .select('class_workouts')
    .eq('class_id', classId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) return null;
  return toWorkout(WorkoutRowSchema.parse(data));
}

/**
 * Les séances d'un ensemble d'occurrences, indexées par `classId`.
 *
 * Une requête pour toute la semaine plutôt qu'une par cellule : la grille du
 * back-office en affiche une quarantaine.
 */
export async function fetchWorkoutsByClass(
  client: RackClient,
  { tenantId, classIds }: { tenantId: string; classIds: string[] },
): Promise<Record<string, ClassWorkout>> {
  if (classIds.length === 0) return {};

  const { data, error } = await tenantScope(client, tenantId)
    .select('class_workouts')
    .in('class_id', classIds)
    .is('deleted_at', null);

  if (error !== null) throw error;

  const par: Record<string, ClassWorkout> = {};
  for (const brut of data ?? []) {
    const workout = toWorkout(WorkoutRowSchema.parse(brut));
    par[workout.classId] = workout;
  }
  return par;
}

/**
 * Ce qu'on peut reprendre pour pré-remplir une séance.
 *
 * **Le pré-remplissage copie, il ne lie pas.** Deux occurrences pré-remplies
 * depuis la même source restent indépendantes ensuite — c'est toute la
 * différence entre alléger le cours du soir et subir une contrainte. Cette
 * fonction rend donc du **texte**, jamais une référence.
 */
export interface WorkoutSource {
  classId: string;
  /** Ce qui aide à choisir : « 07:00 · WOD » ou « lundi dernier · Haltéro ». */
  label: string;
  title: string | null;
  body: string;
}

/**
 * Les sources de pré-remplissage d'une occurrence : les **autres cours du même
 * jour**, et **le même type de cours la semaine précédente**.
 *
 * Ce sont les deux gestes que le coach décrit — « s'il y a un Haltéro dans la
 * journée je ne retape pas le même WOD », et « un WOD endurance du lundi ne sera
 * pas forcément le même le jeudi ». Rien de plus : une bibliothèque de séances
 * serait un autre produit, et `P2-009` est déjà celui-là.
 *
 * **Pure, et alimentée par ce que l'écran a déjà chargé.** La première version
 * interrogeait la base par occurrence : deux requêtes par cellule, sur une
 * grille qui en affiche une quarantaine. Ici la page charge deux semaines une
 * fois, et cette fonction trie — ce qui la rend aussi testable sans base.
 */
export function sourcesPourOccurrence({
  occurrence,
  candidates,
  workouts,
}: {
  occurrence: { id: string; classTypeId: string; day: string };
  candidates: Array<{ id: string; classTypeId: string; day: string; label: string }>;
  workouts: Record<string, ClassWorkout>;
}): WorkoutSource[] {
  const semainePrecedente = shiftDays(occurrence.day, -7);

  const sources: WorkoutSource[] = [];
  for (const candidat of candidates) {
    // Se pré-remplir depuis soi n'a pas de sens : l'écran affiche déjà son texte.
    if (candidat.id === occurrence.id) continue;

    const memeJour = candidat.day === occurrence.day;
    const memeTypeSemaineAvant =
      candidat.classTypeId === occurrence.classTypeId && candidat.day === semainePrecedente;
    if (!memeJour && !memeTypeSemaineAvant) continue;

    const seance = workouts[candidat.id];
    // Une occurrence sans séance n'est pas une source : proposer un texte vide
    // ferait croire à un pré-remplissage qui efface.
    if (seance === undefined) continue;

    sources.push({
      classId: candidat.id,
      label: candidat.label,
      title: seance.title,
      body: seance.body,
    });
  }

  return sources.sort((a, b) => a.label.localeCompare(b.label));
}
