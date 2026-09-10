import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@rack/ui/theme';
import { useI18n } from '@rack/ui/i18n';
import { Banner, SegmentedControl, Skeleton, Switch, Toast } from '@rack/ui/native';
import { errorMessageKeyOf, type TranslationKey } from '@rack/core';
import {
  fetchMyPreferences,
  fetchPolicyVersion,
  recordConsents,
  setNotificationPreference,
  setRosterVisibility,
  type ConsentPurpose,
  type NotificationCategory,
} from '@rack/core/supabase';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';

/**
 * Mes préférences — **et d'abord la réparation d'un trou**.
 *
 * `.claude/rules/privacy.md` dit qu'un consentement « se retire aussi simplement
 * qu'il se donne ». Ce n'était pas vrai : l'écran de consentements
 * (`(auth)/consents.tsx`) n'est atteignable que par l'aiguillage de démarrage,
 * quand `me()` réclame `ACCEPT_CONSENTS`. Une fois inscrit, `PUSH` et
 * `LEADERBOARD` étaient posés **pour toujours**. Le trou existait avant
 * P1-003c ; c'est P1-003c qui l'a rendu bloquant, en ajoutant une exposition
 * visible par défaut — une opposition qu'on ne peut pas exercer n'existe pas.
 *
 * **Chaque bascule s'écrit immédiatement**, sans bouton « Enregistrer ». Un
 * écran de préférences avec un bouton crée un état intermédiaire où l'interface
 * dit une chose et la base en dit une autre ; pour un retrait de consentement,
 * cet écart est exactement ce qu'il ne faut pas.
 *
 * Deux natures différentes cohabitent ici, et l'écran ne les mélange pas :
 * la **visibilité** est une opposition (intérêt légitime, écrite sur
 * l'appartenance), les deux autres sont des **consentements** (append-only,
 * horodatés, avec leur version de politique).
 */

/** Les catégories que le membre peut couper lui-même (P1-007). MARKETING = P2. */
const CATEGORIES_MEMBRE = ['CLASS_REMINDER', 'WAITLIST_PROMOTION', 'CLASS_CANCELLATION'] as const;

const LIBELLE_CATEGORIE: Record<(typeof CATEGORIES_MEMBRE)[number], TranslationKey> = {
  CLASS_REMINDER: 'preferences.notif_reminder',
  WAITLIST_PROMOTION: 'preferences.notif_promotion',
  CLASS_CANCELLATION: 'preferences.notif_cancellation',
};

interface Etat {
  phase: 'chargement' | 'prêt' | 'indisponible';
  visible: boolean;
  push: boolean;
  leaderboard: boolean;
  categories: Record<NotificationCategory, boolean>;
}

export default function PreferencesScreen() {
  const theme = useTheme();
  const { t, locale, setLocale } = useI18n();
  const { me, activeTenantId, reload } = useSession();

  const userId = me?.user.id ?? null;
  const [etat, setEtat] = useState<Etat>({
    phase: 'chargement',
    visible: true,
    push: false,
    leaderboard: false,
    categories: {
      CLASS_REMINDER: true,
      WAITLIST_PROMOTION: true,
      CLASS_CANCELLATION: true,
      MARKETING: true,
    },
  });
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [enregistre, setEnregistre] = useState(false);

  // L'appartenance active porte l'id qu'un réglage de catégorie vise.
  const membershipId = me?.memberships.find((m) => m.tenant_id === activeTenantId)?.id ?? null;

  const charger = useCallback(async () => {
    if (activeTenantId === null || userId === null) return;
    try {
      const prefs = await fetchMyPreferences(supabase, { tenantId: activeTenantId, userId });
      setEtat({
        phase: 'prêt',
        // La colonne dit « masqué », l'écran dit « apparaître » : la double
        // négation se résout ici, une seule fois, pas dans la tête du lecteur.
        visible: !prefs.hiddenFromRoster,
        push: prefs.push ?? false,
        leaderboard: prefs.leaderboard ?? false,
        categories: prefs.categories,
      });
    } catch (error) {
      setErrorKey(errorMessageKeyOf(error));
      setEtat((e) => ({ ...e, phase: 'indisponible' }));
    }
  }, [activeTenantId, userId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  /** Bascule optimiste, remise en place si la base refuse. */
  const appliquer = useCallback(
    async (patch: Partial<Etat>, ecrire: () => Promise<void>) => {
      const avant = etat;
      setEtat({ ...etat, ...patch });
      setErrorKey(null);
      try {
        await ecrire();
        setEnregistre(true);
      } catch (error) {
        setEtat(avant);
        setErrorKey(errorMessageKeyOf(error));
      }
    },
    [etat],
  );

  const basculerVisibilite = useCallback(
    (visible: boolean) => {
      if (activeTenantId === null) return;
      void appliquer({ visible }, () =>
        setRosterVisibility(supabase, { tenantId: activeTenantId, hidden: !visible }),
      );
    },
    [activeTenantId, appliquer],
  );

  const basculerConsentement = useCallback(
    (purpose: ConsentPurpose, granted: boolean) => {
      if (activeTenantId === null || userId === null) return;
      const patch = purpose === 'PUSH' ? { push: granted } : { leaderboard: granted };
      void appliquer(patch, async () => {
        const policyVersion = await fetchPolicyVersion(supabase);
        await recordConsents(supabase, {
          userId,
          tenantId: activeTenantId,
          policyVersion,
          choices: [{ purpose, granted }],
        });
        // `me()` porte les actions requises : un retrait peut en rouvrir une.
        await reload();
      });
    },
    [activeTenantId, userId, appliquer, reload],
  );

  const basculerCategorie = useCallback(
    (category: NotificationCategory, enabled: boolean) => {
      if (activeTenantId === null || membershipId === null) return;
      void appliquer({ categories: { ...etat.categories, [category]: enabled } }, () =>
        setNotificationPreference(supabase, {
          tenantId: activeTenantId,
          membershipId,
          category,
          enabled,
        }),
      );
    },
    [activeTenantId, membershipId, appliquer, etat.categories],
  );

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: theme.colors.surface,
        padding: theme.space(4),
        gap: theme.space(4),
      }}
    >
      <Stack.Screen options={{ headerShown: true, title: t('preferences.title') }} />

      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: theme.typography.body,
          fontFamily: theme.fontFamily,
        }}
      >
        {t('preferences.intro')}
      </Text>

      {errorKey === null ? null : <Banner title={t(errorKey)} tone="danger" />}

      {/* **La langue, arrivée de l'accueil** (`D-019`).
          Elle y était depuis `P0-003` pour prouver que l'interface bascule sans
          redémarrage, avec un commentaire qui promettait ce déménagement. Elle
          est **au-dessus du chargement** et non dedans : changer de langue ne
          dépend d'aucune lecture réseau, et le rester utilisable quand les
          préférences ne se chargent pas est exactement ce qu'on veut d'un
          réglage d'affichage. */}
      <View style={{ gap: theme.space(2) }}>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: theme.typography.title,
            fontFamily: theme.fontFamily,
            fontWeight: '600',
          }}
        >
          {t('preferences.language_heading')}
        </Text>
        <SegmentedControl
          accessibilityLabel={t('language.label')}
          value={locale}
          onChange={(value) => setLocale(value === 'fr' ? 'fr' : 'en')}
          options={[
            { value: 'fr', label: t('language.fr') },
            { value: 'en', label: t('language.en') },
          ]}
        />
      </View>

      {etat.phase === 'chargement' ? (
        <View style={{ gap: theme.space(2) }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : (
        <View style={{ gap: theme.space(4) }}>
          <Switch
            label={t('preferences.roster_label')}
            description={t('preferences.roster_hint')}
            value={etat.visible}
            onValueChange={basculerVisibilite}
          />

          <Text
            style={{
              color: theme.colors.text,
              fontSize: theme.typography.title,
              fontFamily: theme.fontFamily,
              fontWeight: '600',
            }}
          >
            {t('preferences.consents_heading')}
          </Text>

          <Switch
            label={t('consents.push')}
            description={t('consents.push_description')}
            value={etat.push}
            onValueChange={(v) => basculerConsentement('PUSH', v)}
          />

          <Switch
            label={t('consents.leaderboard')}
            description={t('consents.leaderboard_description')}
            value={etat.leaderboard}
            onValueChange={(v) => basculerConsentement('LEADERBOARD', v)}
          />

          {/* Les catégories de push (P1-007) — opt-out, indépendantes. Grisées
              quand le push est coupé : couper une catégorie n'a de sens que si
              on en reçoit. */}
          <Text
            style={{
              color: theme.colors.text,
              fontSize: theme.typography.title,
              fontFamily: theme.fontFamily,
              fontWeight: '600',
            }}
          >
            {t('preferences.notifications_heading')}
          </Text>

          {CATEGORIES_MEMBRE.map((category) => (
            <Switch
              key={category}
              label={t(LIBELLE_CATEGORIE[category])}
              value={etat.categories[category]}
              disabled={!etat.push}
              onValueChange={(v) => basculerCategorie(category, v)}
            />
          ))}
        </View>
      )}

      {enregistre ? <Toast message={t('planning.saved')} tone="success" /> : null}
    </ScrollView>
  );
}
