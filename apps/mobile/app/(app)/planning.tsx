import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useNetworkState } from 'expo-network';
import { useTheme } from '@rack/ui/theme';
import { useI18n } from '@rack/ui/i18n';
import { Badge, Banner, Button, EmptyState, ListRow, Select, Skeleton } from '@rack/ui/native';
import {
  fetchBookedDays,
  fetchDaySchedule,
  localDay,
  seatsLeft,
  shiftDays,
} from '@rack/core/supabase';
import type { BookedDays, DayClass, DaySchedule } from '@rack/core/supabase';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import {
  readBookedDays,
  readDay,
  writeBookedDays,
  writeDay,
  type ScheduleOrigin,
} from '../../lib/schedule-cache';
import { MonthCalendar } from '../../components/month-calendar';
import { dernierJourDu, moisDe, premierJourDu } from '../../components/month-grid-state';
import { comptesDuMois, moisACharger, reservesDuJour } from '../../lib/booked-classes';

/**
 * Le planning du jour, côté membre.
 *
 * **Une liste, pas une grille.** Le back-office a sept colonnes parce qu'on y
 * conçoit une semaine à la souris ; ici on consulte un jour au pouce. Le modèle
 * de vue est partagé (`@rack/core/supabase/planning.ts`), la présentation ne
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
  const router = useRouter();

  const tenant = me?.current_tenant ?? null;
  const timeZone = tenant?.timezone ?? 'Europe/Paris';
  const userId = me?.user.id ?? null;

  const today = useMemo(() => localDay(new Date().toISOString(), timeZone), [timeZone]);
  const [date, setDate] = useState(today);

  /**
   * Le mois affiché, et les pastilles qui vont avec (P1-014).
   *
   * **Le mois est posé, jamais déduit puis corrigé.** `allerAu()` écrit les
   * deux d'un coup ; les flèches de mois n'écrivent que le mois. C'est la leçon
   * du bandeau qu'il remplace, appliquée par le seul moyen qui la garantisse :
   * ne pas avoir deux valeurs à tenir d'accord après coup.
   */
  const [mois, setMois] = useState(() => moisDe(today));
  const [reserves, setReserves] = useState<Record<string, BookedDays>>({});

  const membership = me?.memberships.find((m) => m.tenant_id === activeTenantId) ?? null;
  const membershipId = membership?.id ?? null;
  const moisDAdhesion = useMemo(
    () => (membership === null ? null : moisDe(localDay(membership.joined_at, timeZone))),
    [membership, timeZone],
  );

  /** Aller à un jour, et amener le mois avec lui. */
  const allerAu = useCallback((jour: string) => {
    setDate(jour);
    setMois(moisDe(jour));
  }, []);
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
  /**
   * **Le jeton qui remplace le drapeau d'annulation de l'effet.**
   *
   * La lecture n'est plus déclenchée que par un changement de jour : le retour
   * sur l'écran la relance aussi (P1-012, volet `D-016`). Un `let annulé` local
   * à l'effet ne couvrait que le premier cas. Le jeton couvre les deux — seule
   * la lecture la plus récente a le droit d'écrire, quelle que soit celle qui
   * revient en dernier.
   */
  const lecture = useRef(0);

  const chargerJour = useCallback(
    async (silencieux = false) => {
      if (userId === null || activeTenantId === null) return;

      const jour = date;
      const jeton = ++lecture.current;
      const périmé = () => jeton !== lecture.current;

      // **Le squelette, sauf au retour d'écran.** Synchrone et avant tout, c'est
      // ce qui empêche le bandeau du jour précédent de survivre au-dessus de la
      // liste du suivant. Mais une relecture silencieuse ne doit rien vider :
      // faire clignoter trois squelettes à chaque retour serait un remède pire
      // que le mal qu'on soigne.
      if (!silencieux) {
        setEtat({ jour, phase: 'chargement', schedule: null, origine: 'network' });
      }

      /** Le cache, et le verdict qui va avec. Jamais de squelette après ça. */
      const replier = async (): Promise<void> => {
        const cache = await readDay(userId, activeTenantId, jour);
        if (périmé()) return;
        setEtat({
          jour,
          phase: cache === null ? 'indisponible' : 'prêt',
          schedule: cache,
          origine: 'cache',
        });
      };

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
        if (périmé()) return;
        setEtat({ jour, phase: 'prêt', schedule: frais, origine: 'network' });
        await writeDay(userId, activeTenantId, frais);
      } catch {
        // Réseau tombé en route, ou délai d'expiration atteint. Les deux mènent
        // au même endroit : ce qu'on a sur l'appareil, ou rien, mais dit.
        if (!périmé()) await replier();
      }
    },
    [userId, activeTenantId, timeZone, locale, date, enLigne],
  );

  useEffect(() => {
    void chargerJour();
  }, [chargerJour]);

  /**
   * Ce qui est réservé, **par mois** (P1-014 pour les pastilles, P1-012 pour les
   * badges).
   *
   * **Indexé par mois et non « le mois courant »**, parce que le mois feuilleté
   * et le jour affiché sont deux choses séparées : on peut regarder octobre en
   * gardant le 5 septembre ouvert en dessous. Un seul mois en mémoire ferait
   * disparaître les badges d'une liste qui, elle, n'a pas bougé.
   *
   * **Une requête par mois, rien de préchargé**, et une seule dans le cas
   * courant — `moisACharger()` ne demande le second que s'ils diffèrent
   * vraiment.
   *
   * Réseau d'abord, cache en repli — le même ordre que le planning, pour la même
   * raison. Ici l'enjeu est moindre : un marqueur périmé n'est pas une place
   * périmée, et personne ne réserve depuis une pastille.
   */
  const chargerReserves = useCallback(async () => {
    if (userId === null || activeTenantId === null || membershipId === null) return;

    const demandés = moisACharger(mois, date);
    const résultats = await Promise.all(
      demandés.map(async (m): Promise<[string, BookedDays]> => {
        if (enLigne) {
          try {
            const jours = await fetchBookedDays(supabase, {
              tenantId: activeTenantId,
              membershipId,
              timeZone,
              from: premierJourDu(m),
              to: dernierJourDu(m),
            });
            await writeBookedDays(userId, activeTenantId, m, jours);
            return [m, jours];
          } catch {
            /* on retombe sur le cache, comme le planning */
          }
        }
        return [m, await readBookedDays(userId, activeTenantId, m)];
      }),
    );

    // Fusion plutôt que remplacement : un mois qu'on a quitté reste bon, et le
    // recharger à chaque aller-retour serait une requête pour rien.
    setReserves((actuelles) => ({ ...actuelles, ...Object.fromEntries(résultats) }));
  }, [userId, activeTenantId, membershipId, timeZone, mois, date, enLigne]);

  useEffect(() => {
    void chargerReserves();
  }, [chargerReserves]);

  /**
   * **Au retour sur l'écran, tout ce qui dépend d'une réservation se relit** —
   * les marqueurs *et* la liste du jour.
   *
   * Ce commentaire disait le contraire jusqu'à P1-012, et il avait raison de le
   * dire : le 5 septembre, rien de ce que la liste affichait ne dépendait d'une
   * réservation, donc sa relecture restait à `D-016`. Le badge « Réservé » rend
   * cette phrase fausse — et pas d'un cheveu : livrer le badge sans la relecture
   * donnerait un badge **faux au moment précis où on le regarde**, en revenant
   * sur la liste juste après avoir réservé. P1-012 absorbe donc le volet
   * `planning.tsx` de `D-016`, qui se réduit à `index.tsx` et `bookings.tsx`.
   *
   * Le nombre de places compte autant que le badge : réserver le change, et une
   * liste qui montrerait « Réservé » à côté d'un compteur inchangé se
   * contredirait elle-même.
   *
   * **Le premier passage est sauté.** Le montage a déjà déclenché les deux
   * lectures par leurs effets ; les relancer ici les ferait partir en double au
   * démarrage. Ce que ce `useFocusEffect` couvre, ce sont les **retours**.
   */
  const premierPassage = useRef(true);

  /**
   * **Les lectures les plus récentes, tenues hors de l'identité de la callback**
   * (D-018).
   *
   * `useFocusEffect` ne rejoue pas seulement l'effet quand l'écran reprend le
   * focus : il le rejoue **chaque fois que sa callback change d'identité**. La
   * version précédente dépendait de `chargerJour` et `chargerReserves`, qui sont
   * recréées à chaque changement de jour — donc changer de jour déclenchait la
   * lecture du jour **puis**, aussitôt, une seconde lecture silencieuse du même
   * jour. Mesuré le 6 septembre 2026 :
   *
   *     effet chargerJour — a changé : date
   *     chargerJour(2026-09-07) — SQUELETTE POSÉ
   *     FOCUS #2 — callback recréée par : chargerJour, chargerReserves
   *     chargerJour(2026-09-07) — RELECTURE SILENCIEUSE
   *
   * Deux requêtes et deux `setEtat` portant un `schedule` neuf coup sur coup :
   * la liste est remplacée deux fois de suite, ce qui se voit **même sans
   * squelette**.
   *
   * Un `ref` mis à jour à chaque rendu donne à l'effet la version courante des
   * deux lectures **sans** que son identité en dépende. L'effet ne se déclenche
   * alors plus que sur ce qu'il prétend écouter : le focus.
   */
  const lectures = useRef({ chargerJour, chargerReserves });
  lectures.current = { chargerJour, chargerReserves };

  useFocusEffect(
    useCallback(() => {
      if (premierPassage.current) {
        premierPassage.current = false;
        return;
      }
      // Silencieuse : au retour, on rafraîchit sans vider l'écran.
      void lectures.current.chargerJour(true);
      void lectures.current.chargerReserves();
      // **Dépendances vides, et c'est le correctif.** Voir `lectures` ci-dessus.
    }, []),
  );

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

  /**
   * Les cours réservés du **jour affiché** — pas du mois feuilleté (P1-012).
   * La distinction n'est pas théorique : on peut regarder octobre en gardant le
   * 5 septembre ouvert en dessous, et c'est la liste qui porte les badges.
   */
  const reservesDuJourAffiche = useMemo(() => reservesDuJour(reserves, date), [reserves, date]);

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
          onPress={() => allerAu(shiftDays(date, -1))}
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
          onPress={() => allerAu(shiftDays(date, 1))}
        />
      </View>

      {/* **La grille du mois, sous la date et au-dessus de tout le reste**
          (P1-014). Elle ne remplace pas les flèches : elles restent le seul
          chemin annoncé au clavier et au contrôle vocal.

          `onChange` va au jour **et** au mois ; `onMoisChange` ne déplace que le
          mois — c'est ce qui permet de feuilleter octobre sans quitter le jour
          qu'on regarde. */}
      <MonthCalendar
        value={date}
        onChange={allerAu}
        mois={mois}
        onMoisChange={setMois}
        today={today}
        joursReserves={comptesDuMois(reserves[mois])}
        moisDAdhesion={moisDAdhesion}
      />

      {date === today ? null : (
        <Button
          label={t('planning.back_to_today')}
          variant="ghost"
          onPress={() => allerAu(today)}
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
          const reserve = reservesDuJourAffiche.has(item.id);

          return (
            <ListRow
              key={item.id}
              // **Le détail n'est atteignable qu'en ligne.** Hors ligne, la
              // journée vient du cache : ses places datent, et l'écran de détail
              // ne saurait rien en faire d'autre que le redire. Une ligne inerte
              // est plus honnête qu'une navigation vers un écran qui s'excuse.
              {...(vue.origine === 'cache' || !enLigne
                ? {}
                : { onPress: () => router.push(`/class/${item.id}`) })}
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
                <View style={{ alignItems: 'flex-end', gap: theme.space(1) }}>
                  {/* **Le badge « Réservé » est un texte** (`.claude/rules/ui.md`) :
                      un liseré coloré ne dirait rien à un lecteur d'écran, et
                      rien du tout à qui ne distingue pas les couleurs.

                      **Il ne remplace pas le compteur, il s'ajoute.** Les deux
                      répondent à des questions différentes — « suis-je
                      inscrite ? » et « reste-t-il de la place ? » — et la
                      seconde reste utile une fois inscrite : c'est elle qui dit
                      si le cours se remplit. Les afficher ensemble est aussi ce
                      qui rend visible le critère du ticket : réserver change
                      **les deux**, et une liste qui n'en changerait qu'un se
                      contredirait. */}
                  {reserve ? <Badge label={t('booking.booked')} tone="primary" /> : null}
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
                </View>
              }
            />
          );
        })
      )}
    </ScrollView>
  );
}
