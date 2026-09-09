import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@rack/ui/theme';
import { useI18n } from '@rack/ui/i18n';
import { Badge, Banner, EmptyState, Skeleton, Switch, Toast } from '@rack/ui/native';
import { errorMessageKeyOf, type TranslationKey } from '@rack/core';
import {
  attendanceStateOf,
  canTakeAttendance,
  coachDisplayName,
  fetchAttendanceSheet,
  setAttendance,
  summarizeAttendance,
  type AttendanceRow,
} from '@rack/core/supabase';
import { supabase } from '../../../lib/supabase';
import { useSession } from '../../../lib/session';

/**
 * La feuille de présence d'un cours — **la première surface de l'app réservée à
 * un rôle** (P1-008a).
 *
 * Le coach coche en salle, pendant que les membres arrivent. **Écriture
 * immédiate**, sans bouton « Enregistrer » : même motif optimiste que
 * `preferences.tsx`, et même raison — un état intermédiaire où l'interface dit
 * une chose et la base une autre n'a pas sa place ici.
 *
 * La garde `canTakeAttendance()` n'est **pas** de la sécurité : `set_attendance()`
 * et la vue `class_attendance_sheet` sont déjà bornées au staff en base. Elle
 * évite qu'un membre atteigne un écran qui ne lui rendrait rien — et le point
 * d'entrée qui mène ici (sur la fiche de cours) est déjà invisible pour lui.
 */

interface Etat {
  phase: 'chargement' | 'prêt' | 'indisponible' | 'interdit';
  rows: AttendanceRow[];
}

export default function AttendanceScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { me, activeTenantId } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();

  const membership = me?.memberships.find((m) => m.tenant_id === activeTenantId) ?? null;
  const peutPointer = membership !== null && canTakeAttendance(membership.role);

  const [etat, setEtat] = useState<Etat>({ phase: 'chargement', rows: [] });
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [enregistre, setEnregistre] = useState(false);

  const charger = useCallback(async () => {
    if (activeTenantId === null || id === undefined) return;
    if (!peutPointer) {
      setEtat({ phase: 'interdit', rows: [] });
      return;
    }
    try {
      const rows = await fetchAttendanceSheet(supabase, { tenantId: activeTenantId, classId: id });
      setEtat({ phase: 'prêt', rows });
    } catch (error) {
      setErrorKey(errorMessageKeyOf(error));
      setEtat({ phase: 'indisponible', rows: [] });
    }
  }, [activeTenantId, id, peutPointer]);

  useEffect(() => {
    void charger();
  }, [charger]);

  /**
   * Bascule optimiste, remise en place si la base refuse — hors fenêtre, par
   * exemple. On garde l'instantané d'avant plutôt que de recharger : recharger
   * emporterait les autres coches en vol.
   */
  const basculer = useCallback((bookingId: string, present: boolean) => {
    setErrorKey(null);
    setEtat((prev) => {
      const avant = prev.rows;
      const rows = prev.rows.map((row) =>
        row.booking_id === bookingId
          ? { ...row, attended_at: present ? new Date().toISOString() : null }
          : row,
      );
      void (async () => {
        try {
          await setAttendance(supabase, { bookingId, present });
          setEnregistre(true);
        } catch (error) {
          setErrorKey(errorMessageKeyOf(error));
          setEtat((e) => ({ ...e, rows: avant }));
        }
      })();
      return { ...prev, rows };
    });
  }, []);

  const resume = summarizeAttendance(etat.rows);

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: theme.colors.surface,
        padding: theme.space(4),
        gap: theme.space(4),
      }}
    >
      <Stack.Screen options={{ headerShown: true, title: t('attendance.title') }} />

      {etat.phase === 'interdit' ? (
        <EmptyState
          title={t('attendance.forbidden_title')}
          description={t('attendance.forbidden_body')}
        />
      ) : etat.phase === 'chargement' ? (
        <View style={{ gap: theme.space(2) }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : etat.phase === 'indisponible' ? (
        <Banner tone="danger" title={t(errorKey ?? 'errors.unknown')} />
      ) : etat.rows.length === 0 ? (
        <EmptyState title={t('attendance.empty_title')} description={t('attendance.empty_body')} />
      ) : (
        <View style={{ gap: theme.space(4) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Badge
              label={t('attendance.present_count', {
                present: resume.present,
                total: resume.total,
              })}
            />
          </View>

          <View style={{ gap: theme.space(3) }}>
            {etat.rows.map((row) => (
              <Switch
                key={row.booking_id}
                // Le libellé **est** le nom : un lecteur d'écran annonce « Léa M.,
                // activé/désactivé ». « Case à cocher » ne dirait pas qui.
                label={coachDisplayName(row)}
                value={attendanceStateOf(row) === 'present'}
                onValueChange={(present) => basculer(row.booking_id, present)}
              />
            ))}
          </View>
        </View>
      )}

      {enregistre ? <Toast message={t('planning.saved')} tone="success" /> : null}
      {errorKey !== null && etat.phase === 'prêt' ? (
        <Toast message={t(errorKey)} tone="danger" />
      ) : null}
    </ScrollView>
  );
}
