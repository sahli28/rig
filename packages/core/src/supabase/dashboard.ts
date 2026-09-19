import { z } from 'zod';
import type { RackClient } from './client';

/**
 * Le tableau de bord d'une box (P2-004), lu en un appel via la fonction SQL
 * `box_dashboard`. Toute la logique d'agrégation vit côté base (un instantané
 * cohérent, RLS contournée mais gardée) ; ici on **valide** le retour et on
 * dérive l'affichage par des fonctions pures, testées sous Node — le `.tsx` ne
 * fait que rendre.
 *
 * Fenêtre = 30 derniers jours écoulés ; `*_prev` = les 30 jours d'avant, pour la
 * **vraie** variation (jamais une flèche sans chiffre derrière).
 */

const WindowSchema = z.object({ booked: z.number(), capacity: z.number() });
const AttendanceSchema = z.object({ present: z.number(), total: z.number() });

export const BoxDashboardSchema = z.object({
  members_active: z.number(),
  fill: WindowSchema,
  fill_prev: WindowSchema,
  attendance: AttendanceSchema,
  attendance_prev: AttendanceSchema,
  /** `null` pour un COACH : les expirations sont réservées à OWNER/MANAGER. */
  subs_expiring: z.number().nullable(),
  activity: z.array(z.object({ day: z.string(), count: z.number() })),
  checklist: z.object({
    rooms: z.boolean(),
    class_types: z.boolean(),
    opening_hours: z.boolean(),
    schedules: z.boolean(),
    members: z.boolean(),
    payment_link: z.boolean(),
  }),
});

export type BoxDashboard = z.infer<typeof BoxDashboardSchema>;
export type DashboardChecklist = BoxDashboard['checklist'];

export async function fetchBoxDashboard(
  client: RackClient,
  tenantId: string,
): Promise<BoxDashboard> {
  const { data, error } = await client.rpc('box_dashboard', { p_tenant_id: tenantId });
  if (error !== null) throw error;
  return BoxDashboardSchema.parse(data);
}

/**
 * Taux de remplissage en pourcentage entier, ou `null` s'il n'y a rien à mesurer
 * (aucune capacité sur la fenêtre) — un `0 %` mensonger n'est pas une option.
 */
export function fillRate(w: { booked: number; capacity: number }): number | null {
  if (w.capacity <= 0) return null;
  return Math.round((w.booked / w.capacity) * 100);
}

/** Idem pour les présences : présents / réservations confirmées de la fenêtre. */
export function attendanceRate(a: { present: number; total: number }): number | null {
  if (a.total <= 0) return null;
  return Math.round((a.present / a.total) * 100);
}

/**
 * Variation **réelle** en points entre deux fenêtres de même mesure, ou `null`
 * quand elle n'a pas de sens (une des deux fenêtres n'a rien à mesurer) : pas de
 * flèche décorative. Rendre les points, pas un ratio de ratios — « +6 points de
 * remplissage » se lit, « +8 % de 78 % » non.
 */
export function pointsDelta(
  current: { booked: number; capacity: number },
  previous: { booked: number; capacity: number },
): number | null {
  const cur = fillRate(current);
  const prev = fillRate(previous);
  if (cur === null || prev === null) return null;
  return cur - prev;
}

export function attendancePointsDelta(
  current: { present: number; total: number },
  previous: { present: number; total: number },
): number | null {
  const cur = attendanceRate(current);
  const prev = attendanceRate(previous);
  if (cur === null || prev === null) return null;
  return cur - prev;
}

/** L'ordre d'affichage de la checklist. Les libellés (i18n) vivent côté web. */
export const CHECKLIST_ORDER = [
  'rooms',
  'class_types',
  'opening_hours',
  'schedules',
  'members',
  'payment_link',
] as const satisfies ReadonlyArray<keyof DashboardChecklist>;

export interface ChecklistProgress {
  done: number;
  total: number;
  /** Pourcentage entier, pour l'anneau. */
  pct: number;
}

export function checklistProgress(checklist: DashboardChecklist): ChecklistProgress {
  const total = CHECKLIST_ORDER.length;
  const done = CHECKLIST_ORDER.filter((key) => checklist[key]).length;
  return { done, total, pct: Math.round((done / total) * 100) };
}

export interface ActivityStats {
  /** Pic de la période — sert l'échelle du graphe et son ancrage chiffré. */
  max: number;
  total: number;
  /** Bornes de la fenêtre (`YYYY-MM-DD`), pour dater le graphe. `null` si vide. */
  firstDay: string | null;
  lastDay: string | null;
}

/**
 * Résume la série pour le graphe : pic, total, premières/dernières dates. Le pic
 * plancherait à 1 côté rendu (division par zéro), mais on rend le vrai max ici —
 * une box sans réservation a un pic de 0, et c'est une information honnête.
 */
export function activityStats(
  activity: ReadonlyArray<{ day: string; count: number }>,
): ActivityStats {
  let max = 0;
  let total = 0;
  for (const point of activity) {
    if (point.count > max) max = point.count;
    total += point.count;
  }
  return {
    max,
    total,
    firstDay: activity[0]?.day ?? null,
    lastDay: activity.length > 0 ? (activity[activity.length - 1]?.day ?? null) : null,
  };
}
