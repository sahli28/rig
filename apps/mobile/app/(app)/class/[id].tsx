import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useNetworkState } from 'expo-network';
import { useTheme } from '@rack/ui/theme';
import { useI18n } from '@rack/ui/i18n';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ListRow,
  Sheet,
  Skeleton,
  Toast,
} from '@rack/ui/native';
import { uuidV7 } from '@rack/core';
import {
  BookingFailed,
  affordanceHint,
  affordanceLabelKey,
  bookClass,
  canTakeAttendance,
  cancelBooking,
  cancelConsequence,
  bookingAffordance,
  coachDisplayName,
  confirmPromotion,
  fetchClassDetail,
  fetchClassRoster,
  fetchUpcomingBookings,
  joinWaitlist,
  leaveWaitlist,
  workoutTitle,
  type BookingAffordance,
  type ClassDetail,
  type RosterPeer,
} from '@rack/core/supabase';
import { supabase } from '../../../lib/supabase';
import { useSession } from '../../../lib/session';

/**
 * Le détail d'un cours, et le seul endroit du produit d'où l'on réserve.
 *
 * **Le premier écran à retour légitime** (D-009) : on y arrive depuis le
 * planning ou depuis l'accueil, et le chevron ramène d'où l'on vient. Il déclare
 * donc son en-tête et son titre traduit, comme la convention l'impose.
 *
 * **Ce que cet écran ne décide pas.** Ni s'il reste une place — c'est
 * `book_class()`, sous verrou — ni ce qu'il propose : `bookingAffordance()` le
 * calcule, à part, testée aux bornes. L'écran ne fait que rendre l'état et
 * envoyer le tap. C'est ce découpage qui rend les cinq refus vérifiables sans
 * appareil.
 *
 * **La clé d'idempotence naît au tap et vit dans l'état** (règle 4). Générée
 * dans la fonction d'envoi, elle changerait à chaque nouvel essai et ne
 * protégerait de rien — c'est exactement le cas du réseau lent qu'elle vise. Une
 * app tuée entre-temps perd sa clé : acceptable, la réservation n'a pas eu lieu
 * du point de vue de la personne, et un nouveau tap en génère une neuve.
 */

/** Ce que l'écran sait du cours demandé — et de quel cours il s'agit. */
interface VueCours {
  id: string;
  phase: 'chargement' | 'prêt' | 'introuvable';
  cours: ClassDetail | null;
  /** Réservations à venir : c'est le compteur du plafond, pas une décoration. */
  aVenir: number;
  /** Les inscrits — vides tant qu'on n'a pas soi-même sa place. */
  inscrits: RosterPeer[];
}

/**
 * Le temps restant d'une offre, en `M:SS`. Des chiffres et un deux-points, pas
 * de la prose : aucune chaîne visible à traduire ici (la phrase qui l'entoure,
 * elle, passe par i18n). `Intl` n'entre pas — l'arithmétique suffit, et il est
 * de toute façon interdit hors de sa façade.
 */
function formatReste(ms: number): string {
  const secondes = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(secondes / 60);
  const reste = secondes % 60;
  return `${String(minutes)}:${String(reste).padStart(2, '0')}`;
}

export default function ClassDetailScreen() {
  const theme = useTheme();
  const { t, locale, formatDate, formatTime } = useI18n();
  const { me, activeTenantId } = useSession();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const tenant = me?.current_tenant ?? null;
  const membership = useMemo(
    () => me?.memberships.find((m) => m.tenant_id === activeTenantId) ?? null,
    [me, activeTenantId],
  );

  const reseau = useNetworkState();
  const enLigne = reseau.isInternetReachable ?? reseau.isConnected ?? true;

  const [vue, setVue] = useState<VueCours>({
    id: id ?? '',
    phase: 'chargement',
    cours: null,
    aVenir: 0,
    inscrits: [],
  });
  const [envoi, setEnvoi] = useState(false);
  /** La feuille de confirmation, ouverte seulement hors fenêtre. */
  const [confirmation, setConfirmation] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'danger';
    announcement?: string;
  } | null>(null);

  /**
   * L'horloge du compte à rebours d'une offre de promotion. Ne tourne que
   * pendant qu'une offre est affichée (voir l'effet plus bas) : pas de tick pour
   * rien, et pas de `new Date()` recalculé à chaque rendu.
   */
  const [maintenant, setMaintenant] = useState(() => Date.now());

  /**
   * La clé d'idempotence de la tentative en cours. Une `ref` et non un état :
   * elle ne doit **pas** déclencher de rendu, et surtout pas être regénérée par
   * un rendu. Elle est effacée quand la tentative aboutit ou échoue pour de bon.
   */
  const cle = useRef<string | null>(null);

  const charger = useCallback(
    async (silencieux = false) => {
      if (id === undefined || activeTenantId === null || membership === null) return;

      // Un retour d'écran ne remet pas le squelette : l'écran est déjà rempli,
      // et le vider une demi-seconde ferait clignoter une page qu'on vient de
      // regarder. Le premier chargement, lui, n'a rien à montrer.
      if (!silencieux) {
        setVue({ id, phase: 'chargement', cours: null, aVenir: 0, inscrits: [] });
      }

      try {
        // La feuille part avec les deux autres : la vue rend une liste vide à qui
        // n'est pas inscrit, donc la demander sans le savoir ne divulgue rien et
        // évite un second aller-retour après la réservation.
        const [cours, aVenir, inscrits] = await Promise.all([
          fetchClassDetail(supabase, {
            tenantId: activeTenantId,
            classId: id,
            membershipId: membership.id,
            locale,
          }),
          fetchUpcomingBookings(supabase, {
            tenantId: activeTenantId,
            membershipId: membership.id,
            locale,
          }),
          fetchClassRoster(supabase, { tenantId: activeTenantId, classId: id }),
        ]);

        setVue({
          id,
          phase: cours === null ? 'introuvable' : 'prêt',
          cours,
          aVenir: aVenir.length,
          inscrits,
        });
      } catch {
        // Un cours qu'on n'a pas pu lire n'est pas un cours qui n'existe pas, mais
        // l'écran ne peut rien proposer dans les deux cas. Le message le dit.
        //
        // **Sauf en relecture** : effacer une fiche déjà lisible parce que le
        // rafraîchissement a échoué remplacerait une information correcte par une
        // erreur. On garde ce qui est à l'écran ; il porte les données d'il y a
        // quelques secondes, pas une invention.
        if (!silencieux) {
          setVue({ id, phase: 'introuvable', cours: null, aVenir: 0, inscrits: [] });
        }
      }
    },
    [id, activeTenantId, membership, locale],
  );

  /**
   * **Recharger au retour, pas seulement au montage.**
   *
   * L'écran de préférences est poussé par-dessus celui-ci, et `router.back()`
   * revient sur la **même instance** : un `useEffect` monté une fois ne rejoue
   * rien. Le membre coupait donc « Apparaître dans la liste des inscrits », et
   * se retrouvait toujours dans la feuille — l'opposition était appliquée en
   * base, l'écran affirmait le contraire. Trouvé à la passe du 5 septembre 2026,
   * sur un contrôle de vie privée : le pire endroit pour un affichage périmé.
   *
   * Le premier passage garde son squelette, les suivants rafraîchissent en
   * silence.
   */
  const premierPassage = useRef(true);
  useFocusEffect(
    useCallback(() => {
      void charger(!premierPassage.current);
      premierPassage.current = false;
    }, [charger]),
  );

  const affordance: BookingAffordance | null = useMemo(() => {
    if (vue.cours === null || tenant === null) return null;
    return bookingAffordance({
      klass: vue.cours,
      rules: tenant.booking_rules,
      now: new Date(),
      alreadyBooked: vue.cours.myBookingId !== null,
      myWaitlist: vue.cours.myWaitlist,
      upcomingCount: vue.aVenir,
      online: enLigne,
      origin: 'network',
    });
  }, [vue.cours, vue.aVenir, tenant, enLigne]);

  /**
   * La conséquence, calculée **avant** de proposer le geste.
   *
   * Le critère du ticket est « la conséquence est affichée avant validation,
   * jamais après ». Hors fenêtre, une feuille la dit et demande confirmation ;
   * dans la fenêtre, il n'y a rien à annoncer et donc rien à confirmer — une
   * friction sans information est du bruit.
   */
  const consequence = useMemo(() => {
    if (vue.cours === null || tenant === null) return null;
    return cancelConsequence({
      startsAt: vue.cours.starts_at,
      cancelWindowMinutes: tenant.booking_rules.cancel_window_minutes,
      now: new Date(),
    });
  }, [vue.cours, tenant]);

  const annuler = useCallback(async () => {
    // Lier **puis** garder : un narrowing porté par `vue.cours.myBookingId` ne
    // se transporte pas sur un `cours` rebindé ensuite.
    const cours = vue.cours;
    if (cours === null || cours.myBookingId === null) return;
    const reservationId = cours.myBookingId;

    setConfirmation(false);
    setEnvoi(true);

    // Mise à jour optimiste, comme à la réservation : la place se libère tout de
    // suite, et revient visiblement si le serveur refuse.
    setVue((v) =>
      v.cours === null
        ? v
        : { ...v, cours: { ...v.cours, booked_count: Math.max(0, v.cours.booked_count - 1) } },
    );

    try {
      await cancelBooking(supabase, reservationId);

      setToast({
        message: t('booking.cancelled_ok'),
        tone: 'success',
        // À l'oreille, « annulé » ne dit pas quoi — trois cours d'affilée
        // donneraient trois annonces identiques.
        announcement: t('booking.cancelled_ok_announce', {
          class: cours.className,
          time: formatTime(cours.starts_at),
        }),
      });
      await charger();
    } catch (error) {
      const cléI18n = error instanceof BookingFailed ? error.messageKey : 'errors.unknown';
      setToast({ message: t(cléI18n), tone: 'danger' });
      await charger();
    } finally {
      setEnvoi(false);
    }
  }, [vue.cours, t, formatTime, charger]);

  const reserver = useCallback(async () => {
    if (vue.cours === null || membership === null) return;

    // **Au tap, une seule fois.** Un nouvel essai réutilise la même clé : c'est
    // toute la protection de la règle 4.
    cle.current ??= uuidV7();
    const cours = vue.cours;

    setEnvoi(true);

    // Mise à jour optimiste : la place bouge tout de suite, et revient
    // visiblement si le serveur refuse.
    setVue((v) =>
      v.cours === null
        ? v
        : { ...v, cours: { ...v.cours, booked_count: v.cours.booked_count + 1 } },
    );

    try {
      await bookClass(
        supabase,
        {
          classId: cours.id,
          membershipId: membership.id,
          idempotencyKey: cle.current,
        },
        {
          // Ce qui rend le p95 mesurable au lieu d'être une impression. En
          // développement seulement : les vingt valeurs se lisent dans le
          // terminal Metro pendant la passe sur appareil.
          onDuration: (ms) => {
            if (__DEV__) console.log(`[book_class] ${String(Math.round(ms))} ms`);
          },
        },
      );

      cle.current = null;
      // Ce qui est écrit tient en trois mots — le cours est juste au-dessus. Ce
      // qui est **dit** nomme le cours et son heure : à l'oreille, « c'est
      // réservé » ne dit pas quoi. L'annonce elle-même est faite par le kit, qui
      // a dû être corrigé pour iOS (`packages/ui/src/native/toast.tsx`).
      setToast({
        message: t('booking.confirmed'),
        tone: 'success',
        announcement: t('booking.confirmed_announce', {
          class: cours.className,
          time: formatTime(cours.starts_at),
        }),
      });
      await charger();
    } catch (error) {
      // Retour en arrière **visible** : la place reprend sa valeur réelle, et le
      // rechargement tranche — c'est la base qui a raison, jamais l'optimisme.
      const cléI18n = error instanceof BookingFailed ? error.messageKey : 'errors.unknown';
      setToast({ message: t(cléI18n), tone: 'danger' });
      await charger();
    } finally {
      setEnvoi(false);
    }
  }, [vue.cours, membership, t, formatTime, charger]);

  /**
   * Rejoindre la liste d'attente d'un cours complet. Miroir de `reserver` : une
   * clé d'idempotence naît au tap et vit jusqu'à la réponse (règle 4), parce que
   * rejoindre *crée* une entrée. Pas de mise à jour optimiste — la file ne prend
   * pas de place visible ; le rechargement (et le temps réel) suffisent.
   */
  const rejoindre = useCallback(async () => {
    if (vue.cours === null || membership === null) return;
    cle.current ??= uuidV7();
    const cours = vue.cours;

    setEnvoi(true);
    try {
      await joinWaitlist(supabase, {
        classId: cours.id,
        membershipId: membership.id,
        idempotencyKey: cle.current,
      });
      cle.current = null;
      setToast({
        message: t('booking.joined_waitlist_ok'),
        tone: 'success',
        announcement: t('booking.joined_waitlist_announce', {
          class: cours.className,
          time: formatTime(cours.starts_at),
        }),
      });
      await charger();
    } catch (error) {
      const cléI18n = error instanceof BookingFailed ? error.messageKey : 'errors.unknown';
      setToast({ message: t(cléI18n), tone: 'danger' });
      await charger();
    } finally {
      setEnvoi(false);
    }
  }, [vue.cours, membership, t, formatTime, charger]);

  /**
   * Quitter la liste — en attente, ou en refusant une offre. Pas de clé
   * d'idempotence : l'identifiant de l'entrée suffit, comme pour `annuler`. En
   * refus d'offre, la base cascade le siège tenu vers le suivant.
   */
  const quitter = useCallback(async () => {
    const cours = vue.cours;
    if (cours === null || cours.myWaitlist === null) return;
    const entryId = cours.myWaitlist.entryId;

    setEnvoi(true);
    try {
      await leaveWaitlist(supabase, entryId);
      setToast({
        message: t('booking.left_waitlist_ok'),
        tone: 'success',
        announcement: t('booking.left_waitlist_announce', {
          class: cours.className,
          time: formatTime(cours.starts_at),
        }),
      });
      await charger();
    } catch (error) {
      const cléI18n = error instanceof BookingFailed ? error.messageKey : 'errors.unknown';
      setToast({ message: t(cléI18n), tone: 'danger' });
      await charger();
    } finally {
      setEnvoi(false);
    }
  }, [vue.cours, t, formatTime, charger]);

  /**
   * Confirmer une place offerte : la promotion devient réservation. Rejeu
   * idempotent côté base (l'id d'entrée fait foi). Une offre expirée remonte
   * `OFFER_EXPIRED`, traduit — la base reste juge, l'écran n'anticipe pas.
   */
  const confirmer = useCallback(async () => {
    const cours = vue.cours;
    if (cours === null || cours.myWaitlist === null) return;
    const entryId = cours.myWaitlist.entryId;

    setEnvoi(true);
    try {
      await confirmPromotion(supabase, entryId);
      setToast({
        message: t('booking.confirmed'),
        tone: 'success',
        announcement: t('booking.confirmed_announce', {
          class: cours.className,
          time: formatTime(cours.starts_at),
        }),
      });
      await charger();
    } catch (error) {
      const cléI18n = error instanceof BookingFailed ? error.messageKey : 'errors.unknown';
      setToast({ message: t(cléI18n), tone: 'danger' });
      await charger();
    } finally {
      setEnvoi(false);
    }
  }, [vue.cours, t, formatTime, charger]);

  const cours = vue.cours;
  const indice = affordance === null ? null : affordanceHint(affordance);
  const inscrits = vue.inscrits;

  // Le compte à rebours d'une offre : une horloge à la seconde, branchée
  // **seulement** quand une place est offerte. `offreExpireLe` en dépendance —
  // l'effet ne se relance pas à chaque tick, seulement quand l'offre change.
  const offreExpireLe = affordance?.kind === 'promotion_offered' ? affordance.expiresAt : null;
  useEffect(() => {
    if (offreExpireLe === null) return undefined;
    const horloge = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(horloge);
  }, [offreExpireLe]);
  const resteOffre =
    offreExpireLe === null ? null : Math.max(0, new Date(offreExpireLe).getTime() - maintenant);

  /**
   * **Se déduit, ne se demande pas.** Si on a sa place et qu'on ne figure pas
   * dans la feuille, c'est qu'on s'y est opposé : la vue applique déjà le
   * filtre. Une seconde requête pour lire la préférence dirait la même chose,
   * avec un risque de dire l'inverse.
   */
  const estMasque =
    cours?.myBookingId != null &&
    membership !== null &&
    !inscrits.some((pair) => pair.membership_id === membership.id);

  // Le staff pointe la présence (P1-008a). On **demande** le droit à `@rack/core`
  // au lieu de comparer `role === 'COACH'` : ESLint l'interdit dans une app, et
  // la décision doit vivre à un seul endroit. Invisible d'un membre.
  const peutPointer = membership !== null && canTakeAttendance(membership.role);

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: theme.colors.surface,
        padding: theme.space(4),
        gap: theme.space(4),
      }}
    >
      <Stack.Screen options={{ headerShown: true, title: t('booking.detail_title') }} />

      {vue.phase === 'chargement' ? (
        <View style={{ gap: theme.space(2) }}>
          <Skeleton height={96} />
          <Skeleton height={48} />
        </View>
      ) : vue.phase === 'introuvable' || cours === null ? (
        <EmptyState
          title={t('planning.unavailable_title')}
          description={t('planning.unavailable_body')}
          action={
            <Button
              label={t('booking.see_other_slots')}
              onPress={() => router.back()}
              variant="secondary"
            />
          }
        />
      ) : (
        <>
          {/* Le point d'entrée du staff vers la feuille de présence (P1-008a) —
              la première porte de l'app réservée à un rôle. Invisible d'un
              membre, en haut parce que c'est le geste du coach en salle. */}
          {peutPointer ? (
            <Button
              label={t('attendance.open_sheet')}
              accessibilityLabel={t('attendance.open_sheet_a11y', {
                class: cours.className,
                time: formatTime(cours.starts_at),
              })}
              onPress={() => router.push(`/attendance/${cours.id}`)}
              variant="secondary"
              fullWidth
            />
          ) : null}

          <Card>
            <View style={{ gap: theme.space(2) }}>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: theme.typography.title,
                  fontFamily: theme.fontFamily,
                  fontWeight: '700',
                }}
              >
                {cours.className}
              </Text>

              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: theme.typography.body,
                  fontFamily: theme.fontFamily,
                }}
              >
                {formatDate(cours.starts_at, { style: 'long' })}
              </Text>

              {/* L'heure, la salle et le coach sur une ligne, dans l'ordre où on
                  les cherche. Chaque partie vide disparaît : « 18:30 · Salle · »
                  avec une fin vide serait pire que pas de coach du tout. */}
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: theme.typography.body,
                  fontFamily: theme.fontFamily,
                }}
              >
                {[
                  `${formatTime(cours.starts_at)} – ${formatTime(cours.ends_at)}`,
                  cours.roomName,
                  cours.coachName,
                ]
                  .filter((part) => part !== '')
                  .join(' · ')}
              </Text>

              {/* **Avec l'unité, toujours.** « 3 » ne dit rien à un lecteur
                  d'écran : le voyant lit ce qui l'entoure, pas lui. */}
              <View style={{ flexDirection: 'row' }}>
                <Badge
                  label={
                    cours.status === 'CANCELLED'
                      ? t('planning.cancelled')
                      : cours.booked_count >= cours.capacity
                        ? t('planning.full')
                        : t('planning.seats_left', {
                            count: cours.capacity - cours.booked_count,
                          })
                  }
                  tone={
                    cours.status === 'CANCELLED'
                      ? 'danger'
                      : cours.booked_count >= cours.capacity
                        ? 'warning'
                        : 'success'
                  }
                />
              </View>
            </View>
          </Card>

          {cours.status === 'CANCELLED' && cours.cancellation_reason !== null ? (
            <Banner
              title={t('booking.cancelled')}
              description={t('planning.cancelled_because', { reason: cours.cancellation_reason })}
              tone="danger"
            />
          ) : null}

          {affordance === null ? null : affordance.kind === 'bookable' ? (
            <Button
              label={t('booking.book')}
              // **Le libellé accessible nomme le cours et son heure.** Trois cours
              // d'affilée donnent trois annonces différentes ; « Réserver » seul
              // en donnerait trois identiques (`.claude/rules/ui.md`).
              accessibilityLabel={t('booking.book_a11y', {
                class: cours.className,
                time: formatTime(cours.starts_at),
              })}
              onPress={() => void reserver()}
              loading={envoi}
              disabled={envoi}
              fullWidth
            />
          ) : (
            <View style={{ gap: theme.space(2) }}>
              {/* Un refus n'est pas un bouton grisé et muet : l'état porte son
                  libellé, et la phrase dessous dit pourquoi — avec le nombre qui
                  vient des réglages de la box, jamais d'une constante. */}
              <Button
                label={t(affordanceLabelKey(affordance))}
                onPress={() => {}}
                disabled
                fullWidth
              />

              {/* **Avoir sa place n'est pas une impasse.** C'était le seul état
                  « déjà réservé » sans geste : on voyait qu'on était inscrit, et
                  on ne pouvait rien en faire depuis l'écran qui le disait. */}
              {/* Le cours commencé n'a pas de bouton : `cancel_booking()`
                  refuse (`CLASS_ALREADY_STARTED`), et proposer un geste dont la
                  seule issue est un refus est pire qu'un état sans geste. Le
                  refus reste traité à l'arrivée — un écran ouvert traverse
                  l'heure de début sans qu'on le relise. */}
              {affordance.kind === 'already_booked' &&
              cours.myBookingId !== null &&
              consequence?.kind !== 'started' ? (
                <Button
                  label={t('booking.cancel')}
                  accessibilityLabel={t('booking.cancel_a11y', {
                    class: cours.className,
                    time: formatTime(cours.starts_at),
                  })}
                  // Dans la fenêtre, rien à annoncer : on annule. Hors fenêtre,
                  // la feuille dit la conséquence **avant** de valider.
                  onPress={() => {
                    if (consequence?.kind === 'late') setConfirmation(true);
                    else void annuler();
                  }}
                  loading={envoi}
                  disabled={envoi}
                  variant="secondary"
                  fullWidth
                />
              ) : null}

              {indice === null ? null : (
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: theme.typography.small,
                    fontFamily: theme.fontFamily,
                  }}
                >
                  {/* `count` pilote le pluriel ; `values` porte le reste
                      (`{position}`/`{total}` de « 2ᵉ sur 5 »). */}
                  {t(indice.key, {
                    ...(indice.count === undefined ? {} : { count: indice.count }),
                    ...(indice.values ?? {}),
                  })}
                </Text>
              )}

              {/* **Complet n'est plus une impasse** (P1-006) : on rejoint la
                  liste. La clé d'idempotence naît au tap, comme à la réservation
                  — un double tap sur réseau lent ne crée pas deux entrées. */}
              {affordance.kind === 'full' ? (
                <Button
                  label={t('booking.join_waitlist')}
                  accessibilityLabel={t('booking.join_waitlist_a11y', {
                    class: cours.className,
                    time: formatTime(cours.starts_at),
                  })}
                  onPress={() => void rejoindre()}
                  loading={envoi}
                  disabled={envoi}
                  fullWidth
                />
              ) : null}

              {/* **Déjà sur la liste** : le seul geste est de la quitter. Le rang
                  et la longueur sont dans la phrase ci-dessus. */}
              {affordance.kind === 'on_waitlist' ? (
                <Button
                  label={t('booking.leave_waitlist')}
                  accessibilityLabel={t('booking.leave_waitlist_a11y', {
                    class: cours.className,
                    time: formatTime(cours.starts_at),
                  })}
                  onPress={() => void quitter()}
                  loading={envoi}
                  disabled={envoi}
                  variant="secondary"
                  fullWidth
                />
              ) : null}

              {/* **Une place est offerte** : le compte à rebours, puis confirmer
                  (geste premier) ou refuser (secondaire, qui cascade le siège au
                  suivant). Le rebours n'est pas annoncé à la seconde — il
                  défilerait sans fin dans le flux d'un lecteur d'écran ; la
                  phrase dit l'urgence, le libellé du bouton nomme l'action. */}
              {affordance.kind === 'promotion_offered' ? (
                <>
                  {resteOffre === null ? null : (
                    <Text
                      style={{
                        color: theme.colors.text,
                        fontSize: theme.typography.title,
                        fontFamily: theme.fontFamily,
                        fontWeight: '600',
                      }}
                    >
                      {t('booking.confirm_spot_remaining', {
                        countdown: formatReste(resteOffre),
                      })}
                    </Text>
                  )}
                  <Button
                    label={t('booking.confirm_spot')}
                    accessibilityLabel={t('booking.confirm_spot_a11y', {
                      class: cours.className,
                      time: formatTime(cours.starts_at),
                    })}
                    onPress={() => void confirmer()}
                    loading={envoi}
                    disabled={envoi}
                    fullWidth
                  />
                  <Button
                    label={t('booking.leave_waitlist')}
                    accessibilityLabel={t('booking.leave_waitlist_a11y', {
                      class: cours.className,
                      time: formatTime(cours.starts_at),
                    })}
                    onPress={() => void quitter()}
                    disabled={envoi}
                    variant="secondary"
                    fullWidth
                  />
                </>
              ) : null}
            </View>
          )}

          {/* **La feuille d'inscrits, et seulement pour un inscrit.** La vue
              `class_roster` rend une liste vide à qui n'a pas réservé ce cours —
              c'est la base juridique, pas une optimisation d'affichage — donc
              l'écran n'affiche la section que lorsqu'on a sa place. */}
          {/* **La séance du coach** (P1-015).
              Elle n'arrive ici que **publiée** — la policy retient les
              brouillons, donc cet écran n'a rien à filtrer et ne peut pas
              oublier de le faire.
              Le texte s'affiche **tel qu'il a été tapé** : les sauts de ligne
              sont la structure que le coach a choisie, et rien ne les
              réinterprète. C'est tout le contraire de ce que ferait un rendu
              Markdown, et c'est délibéré. */}
          {cours.workoutBody === null ? null : (
            <View style={{ gap: theme.space(2) }}>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: theme.typography.title,
                  fontFamily: theme.fontFamily,
                  fontWeight: '600',
                }}
              >
                {workoutTitle(
                  {
                    id: '',
                    classId: cours.id,
                    title: cours.workoutTitle,
                    body: cours.workoutBody,
                    publishedAt: null,
                  },
                  cours.className,
                )}
              </Text>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: theme.typography.body,
                  fontFamily: theme.fontFamily,
                }}
              >
                {cours.workoutBody}
              </Text>
            </View>
          )}

          {cours.myBookingId === null ? null : (
            <View style={{ gap: theme.space(2) }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space(2),
                }}
              >
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: theme.typography.title,
                    fontFamily: theme.fontFamily,
                    fontWeight: '600',
                  }}
                >
                  {t('roster.title')}
                </Text>
                {/* Le nombre **avec son unité** : « 3 » ne dit rien à un lecteur
                    d'écran, qui ne lit pas le titre d'à côté. */}
                {inscrits.length === 0 ? null : (
                  <Badge label={t('roster.count', { count: inscrits.length })} />
                )}
              </View>

              {inscrits.length === 0 ? (
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: theme.typography.body,
                    fontFamily: theme.fontFamily,
                  }}
                >
                  {t('roster.empty')}
                </Text>
              ) : (
                inscrits.map((pair) => (
                  <ListRow
                    key={pair.membership_id}
                    // « Sarah D. » — la même composition que pour un coach, et
                    // la même règle : prénom et initiale, jamais plus.
                    title={coachDisplayName(pair)}
                    leading={<Avatar name={coachDisplayName(pair)} size="sm" />}
                  />
                ))
              )}

              {/* **L'information fait partie de la base juridique**, pas de la
                  politesse : un intérêt légitime exempte de la case à cocher,
                  pas de dire ce qu'on expose et comment s'y opposer. */}
              <Banner
                title={estMasque ? t('roster.hidden_notice') : t('roster.info')}
                tone="info"
                action={
                  <Button
                    label={t('roster.info_action')}
                    variant="ghost"
                    onPress={() => router.push('/preferences')}
                  />
                }
              />
            </View>
          )}

          {/* **La conséquence avant la validation, jamais après.**

              Ce qu'elle ne dit pas est aussi important que ce qu'elle dit : la
              spec §12.3 propose « ton crédit sera consommé », et aucune table de
              crédits n'existe avant P2-007. Annoncer une conséquence qui
              n'arrivera pas ferait annuler en croyant payer, ou renoncer en
              croyant perdre. La phrase dit donc la vérité du pilote — la place
              est libérée, l'annulation est enregistrée comme tardive, et la box
              applique sa règle hors de l'app.

              P2-007 remplacera cette phrase en même temps qu'il remplacera le
              corps de `restore_booking_entitlement()`. */}
          <Sheet
            visible={confirmation}
            onClose={() => setConfirmation(false)}
            title={t('booking.cancel_confirm_title')}
          >
            <View style={{ gap: theme.space(3) }}>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: theme.typography.body,
                  fontFamily: theme.fontFamily,
                }}
              >
                {t('booking.cancel_confirm_late', {
                  minutes: consequence?.kind === 'late' ? consequence.minutesBefore : 0,
                })}
              </Text>

              {/* L'action destructrice n'est pas la première : « garder ma
                  place » est le geste qu'on veut rendre facile, et il est écrit
                  en clair plutôt que d'être une croix dans un coin. */}
              <Button
                label={t('booking.cancel_keep')}
                onPress={() => setConfirmation(false)}
                variant="secondary"
                fullWidth
              />
              <Button
                label={t('booking.cancel_confirm_cta')}
                onPress={() => void annuler()}
                loading={envoi}
                disabled={envoi}
                fullWidth
              />
            </View>
          </Sheet>

          {toast === null ? null : (
            <Toast
              message={toast.message}
              tone={toast.tone}
              {...(toast.announcement === undefined ? {} : { announcement: toast.announcement })}
            />
          )}
        </>
      )}
    </ScrollView>
  );
}
