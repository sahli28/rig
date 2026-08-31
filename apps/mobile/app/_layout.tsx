import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { ThemeProvider, brandFromTheme, useTheme } from '@rig/ui/theme';
import { I18nProvider } from '@rig/ui/i18n';
import { localeFromTag } from '@rig/core';
import { BrandProvider, useBrand } from '../lib/brand';
import { SessionProvider, useSession } from '../lib/session';

/**
 * Fuseau tant qu'aucune box n'est active : celui de l'appareil. Dès que `me()`
 * rend une box, c'est le sien qui s'applique — les règles métier (fenêtre
 * d'annulation) se calculent en heure locale de la box, jamais du téléphone.
 */
function deviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
}

/**
 * Langue de l'appareil, lue via `Intl` plutôt que via `expo-localization` :
 * une dépendance de moins pour une information que la plateforme expose déjà.
 */
function deviceLocale() {
  return localeFromTag(Intl.DateTimeFormat().resolvedOptions().locale);
}

/**
 * Aiguillage. Une seule fonction décide où l'on doit être, pour que la règle
 * soit lisible d'un coup d'œil plutôt que dispersée en gardes dans les écrans.
 */
function useAuthRedirect() {
  const { status, me } = useSession();
  const segments = useSegments();
  const router = useRouter();

  const inAuthGroup = segments[0] === '(auth)';

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'signed_out') {
      if (!inAuthGroup) router.replace('/welcome');
      return;
    }

    // Les actions restantes sont calculées par `me()`, pas devinées ici : le
    // client n'a pas à connaître la version courante des CGU.
    if (me?.required_actions.includes('COMPLETE_PROFILE')) {
      router.replace('/profile-setup');
      return;
    }
    if (me?.required_actions.includes('ACCEPT_CONSENTS')) {
      router.replace('/consents');
      return;
    }
    if (inAuthGroup) router.replace('/');
  }, [status, me, inAuthGroup, router]);
}

/** Les options de navigation ont besoin du thème : elles vivent sous le fournisseur. */
function ThemedStack() {
  const theme = useTheme();
  const { status } = useSession();
  useAuthRedirect();

  if (status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surface,
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontFamily: theme.fontFamily },
        contentStyle: { backgroundColor: theme.colors.surface },
      }}
    />
  );
}

/**
 * Arbitre la marque et le fuseau. Trois sources, dans cet ordre : la box
 * active de la session, la box du lien d'invitation, puis rien — c'est-à-dire
 * le thème RIG neutre. Jamais la dernière box vue : afficher les couleurs d'une
 * box qu'on ne rejoindra peut-être pas serait un mensonge visuel.
 */
function Branded() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { me } = useSession();
  const { brand: invitationBrand } = useBrand();

  const current = me?.current_tenant ?? null;
  const brand = current ? brandFromTheme(current.theme) : invitationBrand;
  const timeZone = current?.timezone ?? deviceTimeZone();

  return (
    <ThemeProvider scheme={scheme} {...(brand === null ? {} : { brand })}>
      <I18nProvider initialLocale={deviceLocale()} timeZone={timeZone}>
        <ThemedStack />
      </I18nProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <BrandProvider>
      <SessionProvider>
        <Branded />
      </SessionProvider>
    </BrandProvider>
  );
}
