import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { ThemeProvider, useTheme } from '@rig/ui/theme';
import { I18nProvider } from '@rig/ui/i18n';
import { localeFromTag } from '@rig/core';

/**
 * Fuseau de la box. Provisoirement figé : il viendra du tenant résolu à
 * l'authentification (ticket P0-005). Toutes les heures affichées s'y réfèrent,
 * jamais au fuseau de l'appareil.
 */
const BOX_TIME_ZONE = 'Europe/Paris';

/**
 * Langue de l'appareil, lue via `Intl` plutôt que via `expo-localization` :
 * une dépendance de moins pour une information que la plateforme expose déjà.
 */
function deviceLocale() {
  return localeFromTag(Intl.DateTimeFormat().resolvedOptions().locale);
}

/** Les options de navigation ont besoin du thème : elles vivent sous le fournisseur. */
function ThemedStack() {
  const theme = useTheme();

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

export default function RootLayout() {
  // Le thème suit le réglage système tant qu'aucune box n'a été résolue.
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <ThemeProvider scheme={scheme}>
      <I18nProvider initialLocale={deviceLocale()} timeZone={BOX_TIME_ZONE}>
        <ThemedStack />
      </I18nProvider>
    </ThemeProvider>
  );
}
