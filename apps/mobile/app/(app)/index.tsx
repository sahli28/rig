import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { useNetworkState } from 'expo-network';
import { ScrollView, Text, View } from 'react-native';
import { useTheme } from '@rack/ui/theme';
import { useI18n } from '@rack/ui/i18n';
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ListRow,
  SegmentedControl,
  Skeleton,
} from '@rack/ui/native';
import {
  appliqueChangementAuCours,
  fetchDaySchedule,
  localDay,
  pastilleEtat,
  seatsLeft,
} from '@rack/core/supabase';
import type { DayClass, LigneCoursChangee } from '@rack/core/supabase';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { useCoursEnDirect } from '../../lib/use-realtime-classes';

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
function ProchainCours() {
  const theme = useTheme();
  const { t, locale, formatTime } = useI18n();
  const { me, activeTenantId } = useSession();
  const router = useRouter();

  const timeZone = me?.current_tenant?.timezone ?? 'Europe/Paris';
  const [cours, setCours] = useState<DayClass | null>(null);
  const [phase, setPhase] = useState<'chargement' | 'prêt'>('chargement');

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
  const charger = useCallback(async () => {
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
      setCours(
        jour.classes.find(
          (item) => item.status === 'SCHEDULED' && Date.parse(item.starts_at) > maintenant,
        ) ?? null,
      );
    } catch {
      // L'accueil ne s'excuse pas d'un réseau absent : le planning, lui, sait
      // le dire et propose son cache. La carte disparaît, la porte reste.
      if (jeton === lecture.current) setCours(null);
    } finally {
      if (jeton === lecture.current) setPhase('prêt');
    }
  }, [activeTenantId, timeZone, locale]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // La lecture courante, tenue **hors** de l'identité du rappel de repli
  // (`D-018`) : sinon l'effet d'abonnement se rejouerait à chaque rendu, donc un
  // canal neuf à chaque fois.
  const lectureRef = useRef(charger);
  lectureRef.current = charger;

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
    relire: useCallback(() => void lectureRef.current(), []),
  });

  if (phase === 'chargement') return <Skeleton height={96} />;
  if (cours === null) return null;

  const places = seatsLeft(cours);
  const pastille = pastilleEtat(etatDirect);

  return (
    <Card
      onPress={() => router.push(`/class/${cours.id}`)}
      // Un seul élément à l'oreille, qui dit tout ce que la carte montre : le
      // lecteur d'écran ne lit pas les trois lignes autour du bouton.
      accessibilityLabel={`${t('booking.next_class_title')} : ${cours.className}, ${formatTime(
        cours.starts_at,
      )}`}
    >
      <View style={{ gap: theme.space(1) }}>
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.small,
            fontFamily: theme.fontFamily,
          }}
        >
          {t('booking.next_class_title')}
        </Text>
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
            color: theme.colors.text,
            fontSize: theme.typography.body,
            fontFamily: theme.fontFamily,
          }}
        >
          {[`${formatTime(cours.starts_at)} – ${formatTime(cours.ends_at)}`, cours.roomName]
            .filter((part) => part !== '')
            .join(' · ')}
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.space(2) }}>
          <Badge
            label={places === 0 ? t('planning.full') : t('planning.seats_left', { count: places })}
            tone={places === 0 ? 'warning' : 'success'}
          />
          {/* L'état du canal, pas l'âge de la donnée (P1-005a). */}
          <Badge
            label={t(pastille.label)}
            accessibilityLabel={t(pastille.a11y)}
            tone={pastille.tone}
          />
        </View>
      </View>
    </Card>
  );
}
export default function HomeScreen() {
  const theme = useTheme();
  const { t, locale, setLocale } = useI18n();
  const { me, activeTenantId, setActiveTenant, errorKey, signOut } = useSession();

  const memberships = me?.memberships ?? [];

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: theme.colors.surface,
        padding: theme.space(4),
        gap: theme.space(4),
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: theme.colors.text,
          fontSize: theme.typography.display,
          fontFamily: theme.fontFamily,
          fontWeight: '700',
        }}
      >
        {theme.appName}
      </Text>

      {errorKey === null ? null : <Banner title={t(errorKey)} tone="danger" />}

      {memberships.length === 0 ? (
        <EmptyState title={t('home.no_box_title')} description={t('home.no_box_description')} />
      ) : activeTenantId === null ? (
        // Plusieurs boxes et aucune préférence : `me()` refuse de trancher, et
        // ce n'est pas au client de deviner non plus. On demande.
        <View style={{ gap: theme.space(3) }}>
          <Text
            style={{
              color: theme.colors.text,
              fontSize: theme.typography.body,
              fontFamily: theme.fontFamily,
              fontWeight: '500',
            }}
          >
            {t('home.choose_box')}
          </Text>
          {memberships.map((membership) => (
            <ListRow
              key={membership.id}
              title={membership.tenant_name}
              subtitle={membership.tenant_slug}
              onPress={() => void setActiveTenant(membership.tenant_id)}
            />
          ))}
        </View>
      ) : (
        <ProchainCours />
      )}

      {me === null ? null : (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.small,
            fontFamily: theme.fontFamily,
          }}
        >
          {t('home.signed_in_as', { email: me.user.email })}
        </Text>
      )}

      {/* Le sélecteur de langue est ici pour prouver le critère de P0-003 :
          l'interface bascule sans redémarrage. Il rejoindra les réglages. */}
      <SegmentedControl
        accessibilityLabel={t('language.label')}
        value={locale}
        onChange={(value) => setLocale(value === 'fr' ? 'fr' : 'en')}
        options={[
          { value: 'fr', label: t('language.fr') },
          { value: 'en', label: t('language.en') },
        ]}
      />

      {/* L'action principale de l'accueil. Elle n'apparaît qu'une fois une box
          résolue : sans box, il n'y a pas de planning à montrer, et une porte
          qui se ferme est pire que pas de porte. */}
      {activeTenantId === null ? null : (
        <>
          <Link href="/planning" asChild>
            <Button label={t('home.planning_cta')} onPress={() => {}} fullWidth />
          </Link>
          <Link href="/bookings" asChild>
            <Button
              label={t('booking.mine_cta')}
              onPress={() => {}}
              variant="secondary"
              fullWidth
            />
          </Link>
          <Link href="/preferences" asChild>
            <Button label={t('preferences.cta')} onPress={() => {}} variant="ghost" fullWidth />
          </Link>
        </>
      )}

      <Link href="/design-system" asChild>
        <Button label={t('home.design_system_cta')} onPress={() => {}} fullWidth />
      </Link>

      <Button label={t('home.sign_out')} variant="ghost" onPress={() => void signOut()} fullWidth />
    </ScrollView>
  );
}
