import { useState } from 'react';
import { Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@rig/ui/theme';
import { useI18n } from '@rig/ui/i18n';
import { Banner, Button, Input } from '@rig/ui/native';
import { errorMessageKeyOf, type TranslationKey } from '@rig/core';
import { updateProfile } from '@rig/core/supabase';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';

/**
 * Prénom obligatoire, nom facultatif.
 *
 * Le prénom sert à la feuille de présence de la box ; le nom complet n'est vu
 * de personne d'autre (`.claude/rules/privacy.md` : les pairs ne voient qu'un
 * prénom et une initiale). Demander plus qu'il n'en faut serait une collecte
 * sans finalité.
 */
export default function ProfileSetupScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const { me, reload } = useSession();

  const [firstName, setFirstName] = useState(me?.user.first_name ?? '');
  const [lastName, setLastName] = useState(me?.user.last_name ?? '');
  const [busy, setBusy] = useState(false);
  const [fieldErrorKey, setFieldErrorKey] = useState<TranslationKey | null>(null);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);

  async function save() {
    const trimmed = firstName.trim();
    if (trimmed.length === 0) {
      setFieldErrorKey('profile.first_name_required');
      return;
    }
    if (me === null) return;

    setBusy(true);
    setFieldErrorKey(null);
    setErrorKey(null);

    try {
      await updateProfile(supabase, me.user.id, {
        first_name: trimmed,
        last_name: lastName.trim().length === 0 ? null : lastName.trim(),
        locale,
      });
      await reload();
    } catch (error) {
      setErrorKey(errorMessageKeyOf(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.surface,
        padding: theme.space(4),
        gap: theme.space(4),
        justifyContent: 'center',
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <Text
        style={{
          color: theme.colors.text,
          fontSize: theme.typography.title,
          fontFamily: theme.fontFamily,
          fontWeight: '700',
        }}
      >
        {t('profile.title')}
      </Text>

      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: theme.typography.body,
          fontFamily: theme.fontFamily,
        }}
      >
        {t('profile.intro')}
      </Text>

      {errorKey === null ? null : <Banner title={t(errorKey)} tone="danger" />}

      <Input
        label={t('profile.first_name')}
        value={firstName}
        onChangeText={setFirstName}
        editable={!busy}
        {...(fieldErrorKey === null ? {} : { error: t(fieldErrorKey) })}
      />

      <Input
        label={t('profile.last_name')}
        value={lastName}
        onChangeText={setLastName}
        hint={t('profile.last_name_hint')}
        editable={!busy}
      />

      <Button label={t('profile.save')} onPress={() => void save()} loading={busy} fullWidth />
    </View>
  );
}
