import { useState } from 'react';
import { Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { z } from 'zod';
import { useTheme } from '@rig/ui/theme';
import { useI18n } from '@rig/ui/i18n';
import { Banner, Button, Input } from '@rig/ui/native';
import { errorMessageKeyOf, type TranslationKey } from '@rig/core';
import { acceptInvitation } from '@rig/core/supabase';
import { supabase } from '../../lib/supabase';
import { useBrand } from '../../lib/brand';
import { useSession } from '../../lib/session';

const EmailSchema = z.string().trim().email();
const CODE = /^\d{6}$/;

/**
 * Connexion par **code à six chiffres**, pas par lien.
 *
 * Le lien impose du deep linking, dont la configuration diffère entre Expo Go
 * et un build de développement. Et six chiffres se tapent plus vite à l'accueil
 * d'une box qu'un aller-retour entre l'app mail et l'app. Le lien reste sur le
 * web, où il ne coûte rien.
 */
export default function AuthScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  // Du contexte, pas de l'URL : un paramètre ne survit pas à une redirection,
  // et c'est exactement comme ça que le jeton se perdait.
  const { invitationToken, clearInvitation } = useBrand();
  const { reload } = useSession();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldErrorKey, setFieldErrorKey] = useState<TranslationKey | null>(null);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [noticeKey, setNoticeKey] = useState<TranslationKey | null>(null);

  /** Un 429 se distingue : « réessaie » n'est pas la même chose que « ça a raté ». */
  function keyForAuthError(error: unknown): TranslationKey {
    const status = (error as { status?: number }).status;
    if (status === 429) return 'auth.too_many_requests';
    return errorMessageKeyOf(error);
  }

  async function sendCode() {
    const parsed = EmailSchema.safeParse(email);
    if (!parsed.success) {
      setFieldErrorKey('auth.email_invalid');
      return;
    }

    setBusy(true);
    setFieldErrorKey(null);
    setErrorKey(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: { shouldCreateUser: true },
    });

    setBusy(false);
    if (error) {
      setErrorKey(keyForAuthError(error));
      return;
    }

    setEmail(parsed.data);
    setNoticeKey('auth.code_sent');
    setStep('code');
  }

  async function verifyCode() {
    if (!CODE.test(code)) {
      setFieldErrorKey('auth.code_invalid');
      return;
    }

    setBusy(true);
    setFieldErrorKey(null);
    setErrorKey(null);

    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) {
      setBusy(false);
      // Code faux, code expiré, code déjà consommé : l'écran ne les distingue
      // pas, et la conduite à tenir est la même — en redemander un.
      setFieldErrorKey(error.status === 429 ? 'auth.too_many_requests' : 'auth.code_rejected');
      return;
    }

    // L'invitation s'accepte **après** la connexion : la fonction SQL compare
    // l'adresse de l'invitation nominative à l'e-mail vérifié du JWT.
    //
    // L'ordre compte : l'acceptation d'abord, `reload()` ensuite. Le
    // rafraîchissement déclenché par `onAuthStateChange` court en parallèle et
    // lit un `me()` d'avant l'appartenance ; c'est ce `reload()`-ci, lancé après
    // le rattachement, qui rend la box visible.
    if (invitationToken !== null) {
      try {
        await acceptInvitation(supabase, invitationToken);
        // Consommé : un jeton nominatif est à usage unique, le rejouer ne
        // rendrait qu'`INVITATION_ALREADY_USED`.
        clearInvitation();
      } catch (invitationError) {
        setErrorKey(errorMessageKeyOf(invitationError));
      }
    }

    await reload();
    setBusy(false);
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
        {step === 'email' ? t('auth.email_title') : t('auth.code_title')}
      </Text>

      {errorKey === null ? null : <Banner title={t(errorKey)} tone="danger" />}

      {step === 'email' ? (
        <>
          <Input
            label={t('auth.email_label')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.email_placeholder')}
            hint={t('auth.email_hint')}
            keyboardType="email-address"
            editable={!busy}
            {...(fieldErrorKey === null ? {} : { error: t(fieldErrorKey) })}
          />
          <Button
            label={t('auth.send_code')}
            onPress={() => void sendCode()}
            loading={busy}
            fullWidth
          />
        </>
      ) : (
        <>
          <Input
            label={t('auth.code_label')}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            hint={noticeKey === null ? t('auth.code_hint', { email }) : t(noticeKey)}
            editable={!busy}
            {...(fieldErrorKey === null ? {} : { error: t(fieldErrorKey) })}
          />
          <Button
            label={t('auth.verify')}
            onPress={() => void verifyCode()}
            loading={busy}
            fullWidth
          />
          <Button
            label={t('auth.resend')}
            variant="ghost"
            onPress={() => void sendCode()}
            disabled={busy}
            fullWidth
          />
          <Button
            label={t('auth.change_email')}
            variant="ghost"
            onPress={() => {
              setStep('email');
              setCode('');
              setFieldErrorKey(null);
              setNoticeKey(null);
            }}
            disabled={busy}
            fullWidth
          />
        </>
      )}
    </View>
  );
}
