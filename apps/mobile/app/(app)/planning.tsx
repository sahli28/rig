import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useNetworkState } from 'expo-network';
import { useTheme } from '@rig/ui/theme';
import { useI18n } from '@rig/ui/i18n';
import { Badge, Banner, Button, EmptyState, ListRow, Select, Skeleton } from '@rig/ui/native';
import { fetchDaySchedule, localDay, seatsLeft, shiftDays } from '@rig/core/supabase';
import type { DayClass, DaySchedule } from '@rig/core/supabase';
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
 *
 * **Un seul état, et il nomme son jour.** La première version tenait `schedule`,
 * `origin` et `loading` en trois `useState` séparés qu'aucune règle ne
 * synchronisait : changer de jour laissait les données du précédent en place le
 * temps du chargement. Sur un jour jamais visité, hors ligne, ça donnait un
 * bandeau « Planning enregistré aujourd'hui à 15:44 » au-dessus de trois
 * squelettes vides — le bandeau parlait d'un jour, la liste d'un autre. C'est le
 * même défaut que le titre « Aucun cours ce jour-là » corrigé plus bas, pris par
 * l'autre bout.
 */

/**
 * Ce que l'écran sait du jour demandé — **et de quel jour il s'agit**.
 *
 * Les trois phases sont exclusives, ce qui interdit un rendu contradictoire :
 * on ne peut plus afficher un bandeau de cache et des squelettes en même temps,
 * parce qu'ils ne vivent pas dans la même phase.
 */
interface VueJour {
  /** Le jour décrit. Un état dont le jour n'est plus celui demandé est périmé. */
  jour: string;
  phase: 'chargement' | 'prêt' | 'indisponible';
  schedule: DaySchedule | null;
  origine: ScheduleOrigin;
}
export default function PlanningScreen() {
  const theme = useTheme();
  const { t, formatDate, formatTime, formatRelativeDate, locale } = useI18n();
  const { me, activeTenantId } = useSession();

  const tenant = me?.current_tenant ?? null;
  const timeZone = tenant?.timezone ?? 'Europe/Paris';
  const userId = me?.user.id ?? null;

  const today = useMemo(() => localDay(new Date().toISOString(), timeZone), [timeZone]);
  const [date, setDate] = useState(today);
  const [etat, setEtat] = useState<VueJour>({
    jour: today,
    phase: 'chargement',
    schedule: null,
    origine: 'network',
  });
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [coachFilter, setCoachFilter] = useState<string | null>(null);

  /**
   * **L'app sait qu'elle est hors ligne, elle ne le déduit plus d'un échec.**
   *
   * Sans cette connaissance, un jour jamais visité en mode avion partait quand
   * même en requête et attendait que le système abandonne — un délai qui n'est
   * pas le même deux fois. Le symptôme n'était pas l'attente, c'était son
   * **indétermination** : même geste, résultat différent.
   *
   * `?? true` en dernier recours, et c'est délibéré : au premier rendu,
   * `isInternetReachable` vaut `undefined`. Dans le doute on **essaie** — le
   * délai d'expiration de `fetchDaySchedule` borne le pire cas de toute façon.
   * Refuser de partir sur une incertitude coûterait un écran vide à quelqu'un
   * qui a du réseau.
   *
   * `expo-network` est **incluse dans Expo Go** (SDK 57, vérifié sur la doc
   * avant de s'appuyer dessus, comme `expo-crypto` et `expo-localization`) :
   * aucun development build, donc aucun compte Apple payant.
   */
  const reseau = useNetworkState();
  const enLigne = reseau.isInternetReachable ?? reseau.isConnected ?? true;

  /**
   * Réseau d'abord, cache **seulement** en cas d'échec réseau.
   *
   * Jamais l'inverse, et jamais « le cache d'abord pour aller plus vite » : une
   * place est une donnée qui change sous les doigts. Le cache est un filet, pas
   * un raccourci.
   */
  useEffect(() => {
    if (userId === null || activeTenantId === null) return;

    const jour = date;
    let annulé = false;
    // Synchrone, et **avant tout** : c'est ce qui empêche le bandeau du jour
    // précédent de survivre au-dessus de la liste du suivant.
    setEtat({ jour, phase: 'chargement', schedule: null, origine: 'network' });

    /** Le cache, et le verdict qui va avec. Jamais de squelette après ça. */
    const replier = async (): Promise<void> => {
      const cache = await readDay(userId, activeTenantId, jour);
      if (annulé) return;
      setEtat({
        jour,
        phase: cache === null ? 'indisponible' : 'prêt',
        schedule: cache,
        origine: 'cache',
      });
    };

    void (async () => {
      // Hors ligne, on ne part pas : inutile d'attendre l'échec d'une requête
      // dont on sait qu'elle échouera, et dont le délai d'échec varie.
      if (!enLigne) {
        await replier();
        return;
      }
      try {
        const frais = await fetchDaySchedule(supabase, {
          tenantId: activeTenantId,
          date: jour,
          timeZone,
          locale,
        });
        if (annulé) return;
        setEtat({ jour, phase: 'prêt', schedule: frais, origine: 'network' });
        await writeDay(userId, activeTenantId, frais);
      } catch {
        // Réseau tombé en route, ou délai d'expiration atteint. Les deux mènent
        // au même endroit : ce qu'on a sur l'appareil, ou rien, mais dit.
        if (!annulé) await replier();
      }
    })();

    // Changer de jour pendant qu'une lecture court **annule** son effet : sans
    // ça, deux requêtes en vol pourraient se résoudre dans le désordre et
    // afficher le mauvais jour.
    return () => {
      annulé = true;
    };
  }, [userId, activeTenantId, timeZone, locale, date, enLigne]);

  /**
   * L'invariant, rendu explicite : **on n'affiche jamais l'état d'un autre
   * jour**. Il tient déjà par construction — l'effet remet l'état à zéro de
   * façon synchrone — et cette ligne le dit à qui lit le rendu.
   */
  const vue: VueJour =
    etat.jour === date
      ? etat
      : { jour: date, phase: 'chargement', schedule: null, origine: 'network' };

  /**
   * Les filtres se dérivent de ce qui est **affiché**, pas des référentiels de
   * la box. Proposer « Haltérophilie » un jour où il n'y en a pas mènerait à une
   * liste vide par construction — un filtre qui ne peut rien trouver n'est pas
   * un filtre, c'est un piège.
   */
  const valeursDe = useCallback(
    (champ: (item: DayClass) => string) =>
      [...new Set((vue.schedule?.classes ?? []).map(champ).filter((v) => v !== ''))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [vue.schedule],
  );

  const types = useMemo(() => valeursDe((item) => item.className), [valeursDe]);
  const coaches = useMemo(() => valeursDe((item) => item.coachName), [valeursDe]);

  const shown = (vue.schedule?.classes ?? []).filter(
    (item) =>
      (typeFilter === null || item.className === typeFilter) &&
      (coachFilter === null || item.coachName === coachFilter),
  );

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

      {/* Le bandeau parle du **jour affiché**, et de lui seul : `vue.schedule`
          est l'entrée de cache de ce jour-là, pas la dernière écriture du cache
          tous jours confondus. C'était le second défaut de la passe du
          4 septembre — le bandeau raisonnait sur l'app, la liste sur le jour. */}
      {vue.phase === 'prêt' && vue.origine === 'cache' && vue.schedule !== null ? (
        <Banner
          title={t('planning.offline_title')}
          description={t('planning.offline_body', {
            date: formatRelativeDate(vue.schedule.fetchedAt),
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

      {coaches.length < 2 ? null : (
        <Select
          label={t('planning.filter_coach')}
          value={coachFilter}
          placeholder={t('planning.filter_all_coaches')}
          onChange={(value) => setCoachFilter(value === '' ? null : value)}
          options={[
            { value: '', label: t('planning.filter_all_coaches') },
            ...coaches.map((name) => ({ value: name, label: name })),
          ]}
        />
      )}

      {vue.phase === 'chargement' ? (
        // **Pas de squelette quand l'app sait qu'elle n'a pas de réseau** : un
        // squelette est une promesse d'arrivée, et là rien n'arrivera du réseau.
        // Il ne reste qu'une lecture locale du cache, de l'ordre de quelques
        // dizaines de millisecondes — trop court pour mériter une animation.
        enLigne ? (
          <View style={{ gap: theme.space(2) }}>
            <Skeleton height={64} />
            <Skeleton height={64} />
            <Skeleton height={64} />
          </View>
        ) : null
      ) : vue.phase === 'indisponible' ? (
        // **Trois états vides, trois messages.** « Aucun cours ce jour-là » est
        // une affirmation sur le planning de la box : elle est fausse quand on
        // n'a rien pu lire. Et « le planning n'a pas pu être chargé » suppose
        // qu'on a essayé — faux en mode avion, où l'on n'a même pas tenté.
        <EmptyState
          title={enLigne ? t('planning.unavailable_title') : t('planning.offline_title')}
          description={
            enLigne ? t('planning.unavailable_body') : t('planning.offline_never_loaded')
          }
        />
      ) : shown.length === 0 ? (
        <EmptyState title={t('planning.empty_title')} description={t('planning.empty_body')} />
      ) : (
        shown.map((item) => {
          const places = seatsLeft(item);
          const cancelled = item.status === 'CANCELLED';

          return (
            <ListRow
              key={item.id}
              title={item.className}
              // L'heure d'abord : c'est ce qu'on cherche dans un planning.
              // Le coach n'est ajouté que s'il existe : « 18:30 – 19:30 · Salle · »
              // avec une fin vide serait pire que pas de coach du tout.
              subtitle={[
                `${formatTime(item.starts_at)} – ${formatTime(item.ends_at)}`,
                item.roomName,
                item.coachName,
              ]
                .filter((part) => part !== '')
                .join(' · ')}
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
