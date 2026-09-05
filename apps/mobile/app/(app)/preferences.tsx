import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@rack/ui/theme';
import { useI18n } from '@rack/ui/i18n';
import { Banner, Skeleton, Switch, Toast } from '@rack/ui/native';
import { errorMessageKeyOf, type TranslationKey } from '@rack/core';
import {
  fetchMyPreferences,
  fetchPolicyVersion,
  recordConsents,
  setRosterVisibility,
  type ConsentPurpose,
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

interface Etat {
  phase: 'chargement' | 'prêt' | 'indisponible';
  visible: boolean;
  push: boolean;
  leaderboard: boolean;
}

export default function PreferencesScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { me, activeTenantId, reload } = useSession();

  const userId = me?.user.id ?? null;
  const [etat, setEtat] = useState<Etat>({
    phase: 'chargement',
    visible: true,
    push: false,
    leaderboard: false,
  });
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [enregistre, setEnregistre] = useState(false);

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
        </View>
      )}

      {enregistre ? <Toast message={t('planning.saved')} tone="success" /> : null}
    </ScrollView>
  );
}
