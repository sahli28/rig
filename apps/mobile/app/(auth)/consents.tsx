import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTheme } from '@rack/ui/theme';
import { useI18n } from '@rack/ui/i18n';
import { Banner, Button, Switch } from '@rack/ui/native';
import { errorMessageKeyOf, type TranslationKey } from '@rack/core';
import { fetchPolicyVersion, recordConsents, type ConsentChoice } from '@rack/core/supabase';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';

/**
 * Quatre cases **distinctes**, aucune pré-cochée, aucun refus déguisé.
 *
 * Les deux premières sont nécessaires au service et le disent. Les deux autres
 * sont libres : refuser les notifications n'interrompt rien et ne redemande
 * rien. C'est la différence entre un consentement et une case à cocher.
 */
export default function ConsentsScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { me, activeTenantId, reload } = useSession();

  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [push, setPush] = useState(false);
  const [leaderboard, setLeaderboard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);

  // Les consentements de box exigent une box : sans appartenance encore
  // acceptée, ils n'auraient pas de responsable de traitement.
  const hasBox = activeTenantId !== null;

  async function save() {
    if (!terms || !privacy) {
      setErrorKey('consents.required_missing');
      return;
    }
    if (me === null) return;

    setBusy(true);
    setErrorKey(null);

    const choices: ConsentChoice[] = [
      { purpose: 'TERMS', granted: true },
      { purpose: 'PRIVACY', granted: true },
    ];
    if (hasBox) {
      // Un refus s'écrit aussi : sans la ligne, rien ne distingue « a refusé »
      // de « n'a pas encore vu l'écran », et l'app redemanderait sans fin.
      choices.push({ purpose: 'PUSH', granted: push });
      choices.push({ purpose: 'LEADERBOARD', granted: leaderboard });
    }

    try {
      const policyVersion = await fetchPolicyVersion(supabase);
      await recordConsents(supabase, {
        userId: me.user.id,
        tenantId: activeTenantId,
        policyVersion,
        choices,
      });
      await reload();
    } catch (error) {
      setErrorKey(errorMessageKeyOf(error));
    } finally {
      setBusy(false);
    }
  }

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
          fontSize: theme.typography.title,
          fontFamily: theme.fontFamily,
          fontWeight: '700',
        }}
      >
        {t('consents.title')}
      </Text>

      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: theme.typography.body,
          fontFamily: theme.fontFamily,
        }}
      >
        {t('consents.intro')}
      </Text>

      {errorKey === null ? null : <Banner title={t(errorKey)} tone="danger" />}

      <View style={{ gap: theme.space(4) }}>
        <Switch
          label={t('consents.terms')}
          description={t('consents.terms_description')}
          value={terms}
          onValueChange={setTerms}
          disabled={busy}
        />
        <Switch
          label={t('consents.privacy')}
          description={t('consents.privacy_description')}
          value={privacy}
          onValueChange={setPrivacy}
          disabled={busy}
        />
        {hasBox ? (
          <>
            <Switch
              label={t('consents.push')}
              description={t('consents.push_description')}
              value={push}
              onValueChange={setPush}
              disabled={busy}
            />
            <Switch
              label={t('consents.leaderboard')}
              description={t('consents.leaderboard_description')}
              value={leaderboard}
              onValueChange={setLeaderboard}
              disabled={busy}
            />
          </>
        ) : null}
      </View>

      <Button label={t('consents.save')} onPress={() => void save()} loading={busy} fullWidth />
    </ScrollView>
  );
}
