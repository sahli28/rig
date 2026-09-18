import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useNetworkState } from 'expo-network';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { softTone, useTheme } from '@rack/ui/theme';
import { useI18n } from '@rack/ui/i18n';
import {
  Badge,
  Banner,
  Button,
  Card,
  Icon,
  ImageBackdrop,
  ListRow,
  Skeleton,
} from '@rack/ui/native';
import {
  accessUntil,
  appliqueChangementAuCours,
  fetchDaySchedule,
  fetchMemberSubscriptions,
  fetchPaymentLink,
  localDay,
  pastilleEtat,
  seatsLeft,
} from '@rack/core/supabase';
import type { DayClass, LigneCoursChangee } from '@rack/core/supabase';
import { supabase } from '../../../lib/supabase';
import { useSession } from '../../../lib/session';
import { InvitationsEnAttente } from '../../../components/pending-invitations';
import { useCoursEnDirect } from '../../../lib/use-realtime-classes';
import { useRelireAuRetour } from '../../../lib/use-relire-au-retour';
import { useThemeImages } from '../../../lib/theme-images';
import { TabScreen } from '../../../components/tab-screen';

/**
 * Atterrissage, aux couleurs de la box.
 *
 * **D'ici partent les deux taps.** La carte du prochain cours mène au détail,
 * le détail réserve : c'est le critère de P1-003b, et c'est aussi pourquoi cet
 * écran ne porte pas de bouton « Réserver ». Un raccourci qui réserverait
 * directement depuis l'accueil réserverait *sans montrer quoi* — et il faudrait
 * quand même un écran pour dire l'heure, la salle et le coach.
 */

/**
 * Le prochain cours de la journée, s'il en reste un.
 *
 * Aujourd'hui seulement, et c'est délibéré : « ton prochain cours » sur une
 * carte d'accueil veut dire « tout à l'heure ». Un cours de mercredi affiché un
 * lundi soir n'est pas un raccourci, c'est le planning en moins lisible.
 */
/** Hauteur de la carte héro — partagée avec son squelette. */
const HAUTEUR_HERO = 228;

function ProchainCours() {
  const theme = useTheme();
  const images = useThemeImages();
  const { t, locale, formatTime } = useI18n();
  const { me, activeTenantId } = useSession();
  const router = useRouter();

  const timeZone = me?.current_tenant?.timezone ?? 'Europe/Paris';
  const [cours, setCours] = useState<DayClass | null>(null);
  const [phase, setPhase] = useState<'chargement' | 'prêt'>('chargement');
  /**
   * « Lu, et il n'y a plus rien aujourd'hui » — à ne pas confondre avec « pas pu
   * lire ». Le premier est une affirmation sur le planning et mérite un état vide
   * parlant (§12.1, principe 7) ; le second ne dit rien, donc n'affiche rien.
   */
  const [rienAujourdhui, setRienAujourdhui] = useState(false);

  // Même raison que dans `planning.tsx` : au premier rendu `isInternetReachable`
  // vaut `undefined`, et dans le doute on essaie.
  const reseau = useNetworkState();
  const enLigne = reseau.isInternetReachable ?? reseau.isConnected ?? true;

  /** Seule la lecture la plus récente a le droit d'écrire. */
  const lecture = useRef(0);

  /**
   * **Extraite de son effet pour que le repli puisse la rappeler** (P1-005a).
   *
   * Le jeton d'annulation remplace le `let annulé` local : la lecture n'est plus
   * déclenchée par le seul montage, donc deux peuvent se croiser — la même
   * raison qui l'a fait entrer dans `planning.tsx`.
   */
  const charger = useCallback(
    async (silencieux = false) => {
      if (activeTenantId === null) return;
      const jeton = ++lecture.current;

      try {
        const jour = await fetchDaySchedule(supabase, {
          tenantId: activeTenantId,
          date: localDay(new Date().toISOString(), timeZone),
          timeZone,
          locale,
        });
        if (jeton !== lecture.current) return;
        const maintenant = Date.now();
        const prochain =
          jour.classes.find(
            (item) => item.status === 'SCHEDULED' && Date.parse(item.starts_at) > maintenant,
          ) ?? null;
        setCours(prochain);
        setRienAujourdhui(prochain === null);
      } catch {
        if (jeton !== lecture.current) return;
        // L'accueil ne s'excuse pas d'un réseau absent : le planning, lui, sait
        // le dire et propose son cache. La carte disparaît, la porte reste.
        //
        // **Sauf au retour** (`D-016`) : une relecture silencieuse qui échoue
        // laisse la carte en place. Elle vient d'une lecture réussie, et un
        // réseau tombé ne la rend pas fausse — l'effacer remplacerait une
        // information correcte par rien du tout.
        if (!silencieux) {
          setCours(null);
          setRienAujourdhui(false);
        }
      } finally {
        if (jeton === lecture.current) setPhase('prêt');
      }
    },
    [activeTenantId, timeZone, locale],
  );

  useEffect(() => {
    void charger();
  }, [charger]);

  // La lecture courante, tenue **hors** de l'identité du rappel de repli
  // (`D-018`) : sinon l'effet d'abonnement se rejouerait à chaque rendu, donc un
  // canal neuf à chaque fois.
  const lectureRef = useRef(charger);
  lectureRef.current = charger;

  /**
   * **L'accueil est la racine de la pile : il ne remonte jamais** (`D-016`).
   * Monté une fois pour toute la session, son effet de montage ne rejoue rien —
   * le cours mis en avant datait donc du lancement de l'app.
   *
   * `P1-005a` a retiré la moitié « places restantes » de ce défaut : un canal
   * corrige le compteur pendant qu'on regarde l'écran. **Il n'a pas retiré le
   * reste**, et c'est ce que cette ligne couvre : aucun événement sur `classes`
   * ne dit « cette personne a réservé », ni « ce cours n'est plus le prochain ».
   */
  useRelireAuRetour(useCallback(() => void charger(true), [charger]));

  /**
   * **Le même canal que le planning, sur un seul cours.**
   *
   * L'accueil est la racine de la pile, donc **monté une fois pour toute la
   * session** : sans lui, sa carte afficherait le compteur du lancement de
   * l'app jusqu'à la fermeture. C'est le défaut le plus ancien de `D-016`, et
   * le temps réel en retire la moitié « places restantes » — le badge
   * « Réservé » et le choix du prochain cours, eux, restent à relire au retour.
   */
  const etatDirect = useCoursEnDirect({
    tenantId: activeTenantId,
    enLigne,
    surChangement: useCallback((ligne: LigneCoursChangee) => {
      setCours((precedent) =>
        precedent === null ? precedent : appliqueChangementAuCours(precedent, ligne),
      );
    }, []),
    // Silencieuse, comme sur le planning : le repli rafraîchit, il ne fait
    // disparaître la carte ni ne la remplace par un écran vide.
    relire: useCallback(() => void lectureRef.current(true), []),
  });

  // Même hauteur que la carte : le squelette tient la place, rien ne saute.
  if (phase === 'chargement') return <Skeleton height={HAUTEUR_HERO} radius={theme.radius.lg} />;
  if (cours === null) {
    if (!rienAujourdhui) return null;
    return (
      <ImageBackdrop
        source={images.hero}
        from={0.55}
        to={0.92}
        style={{
          minHeight: HAUTEUR_HERO,
          borderRadius: theme.radius.lg,
          padding: theme.space(5),
          justifyContent: 'flex-end',
          gap: theme.space(1),
        }}
      >
        <Text
          style={{
            color: theme.colors.onImage,
            fontSize: theme.typography.title,
            fontFamily: theme.fontFamily,
            fontWeight: '800',
            letterSpacing: -0.4,
          }}
        >
          {t('home.no_class_today_title')}
        </Text>
        {/* Pas de bouton ici : l'action existe déjà, pleine, en bas de l'écran —
            une seule action primaire (§12.1, principe 2). */}
        <Text
          style={{
            color: theme.colors.onImageMuted,
            fontSize: theme.typography.body,
            fontFamily: theme.fontFamily,
          }}
        >
          {t('home.no_class_today_body')}
        </Text>
      </ImageBackdrop>
    );
  }

  const places = seatsLeft(cours);
  const pastille = pastilleEtat(etatDirect);

  return (
    <Pressable
      onPress={() => router.push(`/class/${cours.id}`)}
      accessibilityRole="button"
      // Un seul élément à l'oreille, qui dit tout ce que la carte montre : le
      // lecteur d'écran ne lit pas les lignes une à une.
      accessibilityLabel={`${t('booking.next_class_title')} : ${cours.className}, ${formatTime(
        cours.starts_at,
      )}`}
      style={({ pressed }) => ({
        opacity: pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      {/* **La seule image de l'accueil** : une carte, pas un fond d'écran. Le
          voile part déjà haut (0,55) parce que le texte occupe toute la carte,
          pas seulement son pied. */}
      <ImageBackdrop
        source={images.hero}
        from={0.55}
        to={0.92}
        style={{
          minHeight: HAUTEUR_HERO,
          borderRadius: theme.radius.lg,
          padding: theme.space(5),
          justifyContent: 'space-between',
          gap: theme.space(4),
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.space(2),
          }}
        >
          <Text
            style={{
              color: theme.colors.onImage,
              fontSize: theme.typography.caption,
              fontFamily: theme.fontFamily,
              fontWeight: '700',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}
          >
            {t('booking.next_class_title')}
          </Text>
          {/* L'état du canal, pas l'âge de la donnée (P1-005a). */}
          <Badge
            label={t(pastille.label)}
            accessibilityLabel={t(pastille.a11y)}
            tone={pastille.tone}
          />
        </View>

        <View style={{ gap: theme.space(1) }}>
          {/* L'heure en `display` : c'est elle qu'on cherche, à bout de bras,
              entre deux séries (§12.1, principe 5). */}
          <Text
            style={{
              color: theme.colors.onImage,
              fontSize: theme.typography.display,
              fontFamily: theme.fontFamily,
              fontWeight: '800',
              letterSpacing: -1,
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatTime(cours.starts_at)}
          </Text>
          <Text
            style={{
              color: theme.colors.onImage,
              fontSize: theme.typography.title,
              fontFamily: theme.fontFamily,
              fontWeight: '700',
            }}
          >
            {cours.className}
          </Text>
          {cours.roomName === '' ? null : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space(1) }}>
              <Icon name="map-pin" size={14} color={theme.colors.onImageMuted} />
              <Text
                style={{
                  flex: 1,
                  color: theme.colors.onImageMuted,
                  fontSize: theme.typography.small,
                  fontFamily: theme.fontFamily,
                }}
              >
                {cours.roomName}
              </Text>
            </View>
          )}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: theme.space(2),
            }}
          >
            <Badge
              icon="users"
              label={
                places === 0 ? t('planning.full') : t('planning.seats_left', { count: places })
              }
              tone={places === 0 ? 'warning' : 'success'}
            />
            {/* L'affordance du tap 1 : la carte mène au cours, elle ne réserve pas. */}
            <View
              style={{
                width: theme.minTouchTarget - theme.space(1),
                height: theme.minTouchTarget - theme.space(1),
                borderRadius: theme.radius.full,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="arrow-right" color={theme.colors.onPrimary} />
            </View>
          </View>
        </View>
      </ImageBackdrop>
    </Pressable>
  );
}
/**
 * L'état d'accès du membre (P2-018) — la moitié affichage de RM2.8.
 *
 * « Accès actif jusqu'au … », ou un état clair « Pas d'accès actif — contacte
 * ta box ». **Pas de CTA de vente** : il n'y a pas de vente in-app, le
 * règlement se fait hors app (P2-019) et l'attribution est un geste du staff.
 *
 * Un échec de lecture ne rend **rien** : « pas d'accès » est une affirmation,
 * pas un repli — l'afficher sur un timeout dirait au membre que sa box l'a
 * coupé, alors que c'est le réseau qui a toussé. Même règle que la carte du
 * prochain cours au retour (`charger`, plus haut).
 */
function AccesBox() {
  const theme = useTheme();
  const { t, formatDate } = useI18n();
  const { me, activeTenantId } = useSession();

  const membershipId =
    me?.memberships.find((item) => item.tenant_id === activeTenantId)?.id ?? null;
  const timeZone = me?.current_tenant?.timezone ?? 'Europe/Paris';

  const [etat, setEtat] = useState<'chargement' | 'illisible' | { until: string | null }>(
    'chargement',
  );
  // Le lien de paiement de la box (P2-019). `null` = pas de lien posé, ou pas
  // encore lu : dans les deux cas, aucun bouton — pas de bouton mort.
  const [lien, setLien] = useState<string | null>(null);
  const lecture = useRef(0);

  const charger = useCallback(async () => {
    if (activeTenantId === null || membershipId === null) return;
    const jeton = ++lecture.current;
    // Les deux lectures sont indépendantes : un lien illisible ne prive pas de
    // l'état d'accès, et inversement.
    const [abonnements, lienPose] = await Promise.allSettled([
      fetchMemberSubscriptions(supabase, activeTenantId),
      fetchPaymentLink(supabase, activeTenantId),
    ]);
    if (jeton !== lecture.current) return;

    if (lienPose.status === 'fulfilled') setLien(lienPose.value);

    if (abonnements.status === 'fulfilled') {
      // La RLS rend « ce que je peux lire » : pour un staff, toute la box. On ne
      // parle ici que de **son** accès.
      const miennes = abonnements.value.filter((ligne) => ligne.membership_id === membershipId);
      setEtat({ until: accessUntil(miennes, localDay(new Date().toISOString(), timeZone)) });
    } else {
      // Ne jamais dégrader un état affiché vers « illisible » : une relecture au
      // retour qui échoue garde ce qu'une lecture réussie a établi.
      setEtat((precedent) => (precedent === 'chargement' ? 'illisible' : precedent));
    }
  }, [activeTenantId, membershipId, timeZone]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // L'attribution arrive pendant que l'app est ouverte : au retour sur
  // l'accueil, on relit (D-016) — silencieusement, comme le prochain cours.
  useRelireAuRetour(useCallback(() => void charger(), [charger]));

  if (etat === 'chargement' || etat === 'illisible') return null;

  /**
   * Le bouton « Régler mon abonnement » (P2-019) : seulement si la box a posé
   * un lien, avec accès actif (renouveler) ou sans (premier règlement). En
   * `secondary` — l'accueil garde une seule action primaire, le planning. La
   * mention dit une fois où l'argent se passe : hors app, chez la box.
   */
  const reglement =
    lien === null ? null : (
      <>
        <Button
          label={t('home.pay_cta')}
          variant="secondary"
          onPress={() => void Linking.openURL(lien)}
          fullWidth
        />
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.small,
            fontFamily: theme.fontFamily,
          }}
        >
          {t('home.pay_note')}
        </Text>
      </>
    );

  if (etat.until === null) {
    return (
      <View style={{ gap: theme.space(2) }}>
        <Banner title={t('home.access_none')} tone="warning" />
        {reglement}
      </View>
    );
  }

  const doux = softTone(theme, theme.colors.success);

  return (
    <View style={{ gap: theme.space(2) }}>
      <Card>
        <View
          accessible
          accessibilityRole="text"
          // La phrase entière, d'un seul tenant : « Accès actif » puis « jusqu'au … »
          // lus séparément perdraient leur lien.
          accessibilityLabel={t('home.access_until', { date: formatDate(etat.until) })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space(3) }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: theme.radius.md,
              backgroundColor: doux.background,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="check-circle" color={doux.foreground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.colors.text,
                fontSize: theme.typography.body,
                fontFamily: theme.fontFamily,
                fontWeight: '600',
              }}
            >
              {t('home.access_active')}
            </Text>
            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: theme.typography.small,
                fontFamily: theme.fontFamily,
              }}
            >
              {t('home.access_until_short', { date: formatDate(etat.until) })}
            </Text>
          </View>
        </View>
      </Card>
      {reglement}
    </View>
  );
}

/**
 * L'en-tête de l'accueil : la box d'abord, la personne ensuite.
 *
 * Le logo est celui de la box quand elle en a un ; sinon ses initiales sur sa
 * primaire — « c'est bien mon club » (§12.5) doit tenir sans fichier.
 */
function EnTete() {
  const theme = useTheme();
  const { t } = useI18n();
  const { me } = useSession();
  const prenom = me?.user.first_name ?? null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space(3) }}>
      {theme.logoUrl === null ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 44,
            height: 44,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: theme.colors.onPrimary,
              fontSize: theme.typography.body,
              fontFamily: theme.fontFamily,
              fontWeight: '800',
            }}
          >
            {theme.appName.slice(0, 2).toUpperCase()}
          </Text>
        </View>
      ) : (
        <Image
          source={{ uri: theme.logoUrl }}
          accessible={false}
          resizeMode="contain"
          style={{ width: 44, height: 44, borderRadius: theme.radius.md }}
        />
      )}
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.small,
            fontFamily: theme.fontFamily,
          }}
        >
          {theme.appName}
        </Text>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={{
            color: theme.colors.text,
            fontSize: theme.typography.title,
            fontFamily: theme.fontFamily,
            fontWeight: '800',
            letterSpacing: -0.4,
          }}
        >
          {prenom === null || prenom === ''
            ? t('home.greeting_neutral')
            : t('home.greeting', { name: prenom })}
        </Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { me, activeTenantId, setActiveTenant, errorKey, signOut } = useSession();

  const memberships = me?.memberships ?? [];

  return (
    <TabScreen>
      <EnTete />

      {errorKey === null ? null : <Banner title={t(errorKey)} tone="danger" />}

      {memberships.length === 0 ? (
        // Le chaînon manquant du parcours des 80 (P1-024) : une invitation
        // importée attend peut-être cette adresse. Le composant liste et fait
        // rejoindre ; sans invitation, il rend l'état vide d'avant.
        <InvitationsEnAttente />
      ) : activeTenantId === null ? (
        // Plusieurs boxes et aucune préférence : `me()` refuse de trancher, et
        // ce n'est pas au client de deviner non plus. On demande.
        <View style={{ gap: theme.space(3) }}>
          <Text
            style={{
              color: theme.colors.text,
              fontSize: theme.typography.body,
              fontFamily: theme.fontFamily,
              fontWeight: '600',
            }}
          >
            {t('home.choose_box')}
          </Text>
          {memberships.map((membership) => (
            <Card key={membership.id} style={{ padding: 0, overflow: 'hidden' }}>
              <ListRow
                title={membership.tenant_name}
                subtitle={membership.tenant_slug}
                trailing={<Icon name="chevron-right" color={theme.colors.textMuted} />}
                onPress={() => void setActiveTenant(membership.tenant_id)}
              />
            </Card>
          ))}
        </View>
      ) : (
        <>
          <ProchainCours />
          <AccesBox />
        </>
      )}

      {/* **Qui est connecté : une aide de passe, pas une information de membre**
          (`D-019`). Sous `__DEV__` : c'est une sonde, et la règle 9 vaut pour
          les affordances comme pour les traces. */}
      {__DEV__ && me !== null ? (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.small,
            fontFamily: theme.fontFamily,
          }}
        >
          {t('home.signed_in_as', { email: me.user.email })}
        </Text>
      ) : null}

      {/* Le reste descend en bas de l'écran : l'action primaire vit dans les
          40 % inférieurs (§12.1, principe 4). */}
      <View style={{ flex: 1 }} />

      {/* **L'unique action pleine de l'accueil.** Les portes « Mes réservations »
          et « Mes préférences » sont devenues des onglets (P2-021) : elles
          n'ont plus à concurrencer celle-ci. Elle n'apparaît qu'une fois une box
          résolue : sans box, il n'y a pas de planning à montrer. */}
      {activeTenantId === null ? null : (
        <Button
          label={t('home.planning_cta')}
          icon="calendar"
          onPress={() => router.navigate('/planning')}
          fullWidth
        />
      )}

      {/* **La galerie de composants n'est pas une porte de membre** (`D-019`).
          `ghost` **même en développement** : une seule action primaire est une
          règle d'écran, pas une règle de build. */}
      {__DEV__ ? (
        <Button
          label={t('home.design_system_cta')}
          onPress={() => router.push('/design-system')}
          variant="ghost"
          fullWidth
        />
      ) : null}

      <Button label={t('home.sign_out')} variant="ghost" onPress={() => void signOut()} fullWidth />
    </TabScreen>
  );
}
