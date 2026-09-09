import { z } from 'zod';
import type { RackClient } from './client';
import { tenantScope } from './active-tenant';

/**
 * La feuille de présence d'un cours, côté staff (P1-008a).
 *
 * La lecture passe par la vue `class_attendance_sheet` — **pas** `class_roster`,
 * qui est « pair » et vide pour un coach non inscrit au cours. L'écriture passe
 * par la RPC `set_attendance()` : `bookings` n'a aucune policy d'écriture, la
 * présence ne se pose que par fonction.
 *
 * Toute la **logique** vit ici, en fonctions pures testées sous Node — le `.tsx`
 * mobile ne fait que rendre (`.claude/rules/ui.md`, dette D-015).
 */

/**
 * Un inscrit sur la feuille : prénom + initiale (règle d'exposition commune,
 * `.claude/rules/privacy.md`), plus l'état de présence. `booking_id` est la
 * ligne que `set_attendance()` marque ; les horodatages arrivent en chaîne ou
 * `null` (sérialisation PostgREST).
 */
export interface AttendanceRow {
  membership_id: string;
  booking_id: string;
  first_name: string | null;
  last_initial: string | null;
  attended_at: string | null;
  no_show_at: string | null;
}

/**
 * Frontière de type, comme `class_roster` : `selectView()` rend des lignes non
 * typées faute de liste de colonnes (compromis d'`active-tenant.ts`).
 */
const AttendanceRowSchema = z.object({
  membership_id: z.string(),
  booking_id: z.string(),
  first_name: z.string().nullable(),
  last_initial: z.string().nullable(),
  attended_at: z.string().nullable(),
  no_show_at: z.string().nullable(),
});

/** Les trois états d'une réservation vus depuis la feuille. */
export type AttendanceState = 'present' | 'no_show' | 'pending';

/**
 * L'état d'une ligne, dérivé des deux horodatages. **La présence prime** : si le
 * coach a pointé quelqu'un après que le job l'a marqué absent (il est arrivé en
 * retard, le coach corrige), il est présent. `set_attendance(false)` remet
 * `attended_at` à `null` et la ligne redevient `pending` — le job la remarquera
 * `no_show` au prochain passage si le cours est terminé.
 */
export function attendanceStateOf(row: {
  attended_at: string | null;
  no_show_at: string | null;
}): AttendanceState {
  if (row.attended_at !== null) return 'present';
  if (row.no_show_at !== null) return 'no_show';
  return 'pending';
}

export interface AttendanceSummary {
  present: number;
  noShow: number;
  pending: number;
  total: number;
}

/** Le compteur de la feuille : « 12 présents, 3 absents ». */
export function summarizeAttendance(rows: readonly AttendanceRow[]): AttendanceSummary {
  const summary: AttendanceSummary = { present: 0, noShow: 0, pending: 0, total: rows.length };
  for (const row of rows) {
    const state = attendanceStateOf(row);
    if (state === 'present') summary.present += 1;
    else if (state === 'no_show') summary.noShow += 1;
    else summary.pending += 1;
  }
  return summary;
}

/**
 * Les inscrits d'un cours, pour la feuille du staff. Triés côté base — prénom,
 * puis `membership_id` pour un ordre stable — plutôt que côté client : pas de
 * comparaison de chaînes à confier à Hermes.
 */
export async function fetchAttendanceSheet(
  client: RackClient,
  { tenantId, classId }: { tenantId: string; classId: string },
): Promise<AttendanceRow[]> {
  const { data, error } = await tenantScope(client, tenantId)
    .selectView('class_attendance_sheet')
    .eq('class_id', classId)
    .order('first_name')
    .order('membership_id');

  if (error !== null) throw error;

  return AttendanceRowSchema.array().parse(data ?? []);
}

/**
 * Pointe (`present`) ou dépointe (`!present`) une réservation. La RPC est
 * idempotente et garde la fenêtre et le rôle ; ici on ne fait que la relayer et
 * laisser remonter l'erreur — l'écran la traduit par `errorMessageKeyOf()`,
 * comme `setRosterVisibility()`.
 */
export async function setAttendance(
  client: RackClient,
  { bookingId, present }: { bookingId: string; present: boolean },
): Promise<void> {
  const { error } = await client.rpc('set_attendance', {
    p_booking_id: bookingId,
    p_present: present,
  });
  if (error) throw error;
}
