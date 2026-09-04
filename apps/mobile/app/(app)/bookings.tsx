import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '@rack/ui/theme';
import { useI18n } from '@rack/ui/i18n';
import { Button, EmptyState, ListRow, Skeleton } from '@rack/ui/native';
import { fetchUpcomingBookings, type UpcomingBooking } from '@rack/core/supabase';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';

/**
 * Mes réservations — les cours à venir, à l'heure locale de la box.
 *
 * **Volontairement en lecture seule.** Se désinscrire est P1-004, pointer est
 * P1-008 ; les deux tickets nomment cet écran comme leur point d'entrée. Ce qu'il
 * faut dire à la box pilote, et qui est écrit dans P1-003b : après ce lot, un
 * membre qui a réservé **ne peut pas se désinscrire depuis l'app**.
 *
 * Pas de cache ici, contrairement au planning : une réservation qu'on ne peut
 * pas relire est un cas rare — on vient de la faire — et un cache de plus est un
 * endroit de plus où deux vérités peuvent diverger.
 */

interface Vue {
  phase: 'chargement' | 'prêt' | 'indisponible';
  reservations: UpcomingBooking[];
}

export default function BookingsScreen() {
  const theme = useTheme();
  const { t, locale, formatDate, formatTime } = useI18n();
  const { me, activeTenantId } = useSession();
  const router = useRouter();

  const membership = me?.memberships.find((m) => m.tenant_id === activeTenantId) ?? null;
  const membershipId = membership?.id ?? null;

  const [vue, setVue] = useState<Vue>({ phase: 'chargement', reservations: [] });

  const charger = useCallback(async () => {
    if (activeTenantId === null || membershipId === null) return;
    setVue({ phase: 'chargement', reservations: [] });
    try {
      const reservations = await fetchUpcomingBookings(supabase, {
        tenantId: activeTenantId,
        membershipId,
        locale,
      });
      setVue({ phase: 'prêt', reservations });
    } catch {
      setVue({ phase: 'indisponible', reservations: [] });
    }
  }, [activeTenantId, membershipId, locale]);

  useEffect(() => {
    void charger();
  }, [charger]);

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: theme.colors.surface,
        padding: theme.space(4),
        gap: theme.space(3),
      }}
    >
      <Stack.Screen options={{ headerShown: true, title: t('booking.mine_title') }} />

      {vue.phase === 'chargement' ? (
        <View style={{ gap: theme.space(2) }}>
          <Skeleton height={64} />
          <Skeleton height={64} />
        </View>
      ) : vue.phase === 'indisponible' ? (
        <EmptyState
          title={t('planning.unavailable_title')}
          description={t('planning.unavailable_body')}
        />
      ) : vue.reservations.length === 0 ? (
        // Un état vide muet est un état vide raté : celui-ci dit quoi faire et
        // ouvre la porte.
        <EmptyState
          title={t('booking.mine_empty_title')}
          description={t('booking.mine_empty_body')}
          action={
            <Button label={t('home.planning_cta')} onPress={() => router.push('/planning')} />
          }
        />
      ) : (
        vue.reservations.map((reservation) => (
          <ListRow
            key={reservation.bookingId}
            title={reservation.className}
            // La date **et** l'heure : cet écran se lit sur plusieurs jours,
            // contrairement au planning qui en affiche un seul.
            subtitle={[
              formatDate(reservation.starts_at, { style: 'long' }),
              `${formatTime(reservation.starts_at)} – ${formatTime(reservation.ends_at)}`,
              reservation.roomName,
              reservation.coachName,
            ]
              .filter((part) => part !== '')
              .join(' · ')}
            onPress={() => router.push(`/class/${reservation.classId}`)}
          />
        ))
      )}
    </ScrollView>
  );
}
