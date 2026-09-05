import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
  Skeleton,
  Toast,
} from '@rack/ui/native';
import { uuidV7 } from '@rack/core';
import {
  BookingFailed,
  affordanceHint,
  affordanceLabelKey,
  bookClass,
  bookingAffordance,
  coachDisplayName,
  fetchClassDetail,
  fetchClassRoster,
  fetchUpcomingBookings,
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
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'danger';
    announcement?: string;
  } | null>(null);

  /**
   * La clé d'idempotence de la tentative en cours. Une `ref` et non un état :
   * elle ne doit **pas** déclencher de rendu, et surtout pas être regénérée par
   * un rendu. Elle est effacée quand la tentative aboutit ou échoue pour de bon.
   */
  const cle = useRef<string | null>(null);

  const charger = useCallback(async () => {
    if (id === undefined || activeTenantId === null || membership === null) return;

    setVue({ id, phase: 'chargement', cours: null, aVenir: 0, inscrits: [] });

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
      setVue({ id, phase: 'introuvable', cours: null, aVenir: 0, inscrits: [] });
    }
  }, [id, activeTenantId, membership, locale]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const affordance: BookingAffordance | null = useMemo(() => {
    if (vue.cours === null || tenant === null) return null;
    return bookingAffordance({
      klass: vue.cours,
      rules: tenant.booking_rules,
      now: new Date(),
      alreadyBooked: vue.cours.myBookingId !== null,
      upcomingCount: vue.aVenir,
      online: enLigne,
      origin: 'network',
    });
  }, [vue.cours, vue.aVenir, tenant, enLigne]);

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

  const cours = vue.cours;
  const indice = affordance === null ? null : affordanceHint(affordance);
  const inscrits = vue.inscrits;

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

              {indice === null ? null : (
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: theme.typography.small,
                    fontFamily: theme.fontFamily,
                  }}
                >
                  {indice.count === undefined
                    ? t(indice.key)
                    : t(indice.key, { count: indice.count })}
                </Text>
              )}

              {/* **Une impasse se répare par une porte de sortie, pas par une
                  promesse.** Rien ne se libérera avant P1-004, et personne ne
                  peut placer un membre à la main : le seul geste vrai est de
                  regarder les autres créneaux. */}
              {affordance.kind === 'full' ? (
                <Button
                  label={t('booking.see_other_slots')}
                  onPress={() => router.back()}
                  variant="secondary"
                  fullWidth
                />
              ) : null}
            </View>
          )}

          {/* **La feuille d'inscrits, et seulement pour un inscrit.** La vue
              `class_roster` rend une liste vide à qui n'a pas réservé ce cours —
              c'est la base juridique, pas une optimisation d'affichage — donc
              l'écran n'affiche la section que lorsqu'on a sa place. */}
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
