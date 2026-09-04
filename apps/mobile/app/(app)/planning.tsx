import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@rig/ui/theme';
import { useI18n } from '@rig/ui/i18n';
import { Badge, Banner, Button, EmptyState, ListRow, Select, Skeleton } from '@rig/ui/native';
import { fetchDaySchedule, localDay, seatsLeft, shiftDays } from '@rig/core/supabase';
import type { DaySchedule } from '@rig/core/supabase';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { readDay, writeDay, type ScheduleOrigin } from '../../lib/schedule-cache';

/**
 * Le planning du jour, côté membre.
 *
 * **Une liste, pas une grille.** Le back-office a sept colonnes parce qu'on y
 * conçoit une semaine à la souris ; ici on consulte un jour au pouce. Le modèle
 * de vue est partagé (`@rig/core/supabase/planning.ts`), la présentation ne
 * l'est pas — et il ne faut pas essayer d'en faire une seule.
 *
 * **Le cache ne fait jamais autorité sur une place.** Hors ligne, l'écran
 * affiche le planning, dit qu'il est hors ligne et donne la date de la dernière
 * mise à jour ; aucune action de réservation n'est proposée. Afficher
 * « 3 places » depuis un cache de la veille et laisser toucher « Réserver »
 * produirait le mensonge exact que P1-003 a passé un lot entier à rendre
 * impossible côté base.
 */
export default function PlanningScreen() {
  const theme = useTheme();
  const { t, formatDate, formatTime, formatRelativeDate, locale } = useI18n();
  const { me, activeTenantId } = useSession();

  const tenant = me?.current_tenant ?? null;
  const timeZone = tenant?.timezone ?? 'Europe/Paris';
  const userId = me?.user.id ?? null;

  const today = useMemo(() => localDay(new Date().toISOString(), timeZone), [timeZone]);
  const [date, setDate] = useState(today);
  const [schedule, setSchedule] = useState<DaySchedule | null>(null);
  const [origin, setOrigin] = useState<ScheduleOrigin>('network');
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  /**
   * Réseau d'abord, cache **seulement** en cas d'échec réseau.
   *
   * Jamais l'inverse, et jamais « le cache d'abord pour aller plus vite » : une
   * place est une donnée qui change sous les doigts. Le cache est un filet, pas
   * un raccourci.
   */
  const load = useCallback(
    async (wanted: string) => {
      if (userId === null || activeTenantId === null) return;
      setLoading(true);
      try {
        const fresh = await fetchDaySchedule(supabase, {
          tenantId: activeTenantId,
          date: wanted,
          timeZone,
          locale,
        });
        setSchedule(fresh);
        setOrigin('network');
        await writeDay(userId, activeTenantId, fresh);
      } catch {
        const cached = await readDay(userId, activeTenantId, wanted);
        setSchedule(cached);
        setOrigin('cache');
      } finally {
        setLoading(false);
      }
    },
    [userId, activeTenantId, timeZone, locale],
  );

  useEffect(() => {
    void load(date);
  }, [load, date]);

  const types = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of schedule?.classes ?? []) seen.set(item.className, item.className);
    return [...seen.keys()].sort((a, b) => a.localeCompare(b));
  }, [schedule]);

  const shown = (schedule?.classes ?? []).filter(
    (item) => typeFilter === null || item.className === typeFilter,
  );

  const offline = origin === 'cache' && schedule !== null;

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: theme.colors.surface,
        padding: theme.space(4),
        gap: theme.space(3),
      }}
    >
      {/* Écran atteint depuis l'accueil : il a un retour légitime, donc il
          déclare les deux (convention D-009, `.claude/rules/ui.md`).

          `headerRight` reste **libre** : c'est là que P1-009 posera le sélecteur
          de box, sur l'en-tête que D-009 vient d'assainir. Rien n'est réservé
          ici — un emplacement vide serait du code mort — mais rien ne l'occupe
          non plus, et le ticket le dit des deux côtés. */}
      <Stack.Screen options={{ headerShown: true, title: t('planning.title') }} />

      {/* Le jour. Les deux flèches disent où elles vont : à l'oreille, « ‹ » et
          « › » ne sont pas des mots (§12.4). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space(2) }}>
        <Button
          label={t('planning.previous_day')}
          variant="ghost"
          onPress={() => setDate(shiftDays(date, -1))}
        />
        <Text
          style={{
            flex: 1,
            textAlign: 'center',
            color: theme.colors.text,
            fontSize: theme.typography.body,
            fontFamily: theme.fontFamily,
            fontWeight: '600',
          }}
        >
          {formatDate(`${date}T12:00:00Z`, { style: 'long' })}
        </Text>
        <Button
          label={t('planning.next_day')}
          variant="ghost"
          onPress={() => setDate(shiftDays(date, 1))}
        />
      </View>

      {date === today ? null : (
        <Button
          label={t('planning.back_to_today')}
          variant="ghost"
          onPress={() => setDate(today)}
        />
      )}

      {offline ? (
        <Banner
          title={t('planning.offline_title')}
          description={t('planning.offline_body', {
            date: formatRelativeDate(schedule.fetchedAt),
          })}
          tone="warning"
        />
      ) : null}

      {types.length < 2 ? null : (
        <Select
          label={t('planning.filter_type')}
          value={typeFilter}
          placeholder={t('planning.filter_all')}
          onChange={(value) => setTypeFilter(value === '' ? null : value)}
          options={[
            { value: '', label: t('planning.filter_all') },
            ...types.map((name) => ({ value: name, label: name })),
          ]}
        />
      )}

      {loading ? (
        <View style={{ gap: theme.space(2) }}>
          <Skeleton height={64} />
          <Skeleton height={64} />
          <Skeleton height={64} />
        </View>
      ) : shown.length === 0 ? (
        // Deux états vides, et **deux titres**. « Aucun cours ce jour-là » est
        // une affirmation sur le planning de la box : elle est fausse quand on
        // n'a justement rien pu lire. Trouvé en relisant l'arbre — seul le
        // corps du message disait la vérité, le titre la contredisait.
        <EmptyState
          title={schedule === null ? t('planning.unavailable_title') : t('planning.empty_title')}
          description={
            schedule === null ? t('planning.unavailable_body') : t('planning.empty_body')
          }
        />
      ) : (
        shown.map((item) => {
          const places = seatsLeft(item);
          const cancelled = item.status === 'CANCELLED';

          return (
            <ListRow
              key={item.id}
              title={item.className}
              // L'heure d'abord : c'est ce qu'on cherche dans un planning.
              subtitle={`${formatTime(item.starts_at)} – ${formatTime(item.ends_at)} · ${item.roomName}`}
              trailing={
                <Badge
                  // **Avec l'unité, toujours.** « 3 » ne dit rien à un lecteur
                  // d'écran : le voyant lit la colonne autour, pas lui.
                  label={
                    cancelled
                      ? t('planning.cancelled')
                      : places === 0
                        ? t('planning.full')
                        : t('planning.seats_left', { count: places })
                  }
                  tone={cancelled ? 'danger' : places === 0 ? 'warning' : 'success'}
                />
              }
            />
          );
        })
      )}
    </ScrollView>
  );
}
