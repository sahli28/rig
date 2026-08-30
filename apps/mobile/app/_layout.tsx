import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { ThemeProvider, useTheme } from '@rig/ui/theme';

/**
 * Les options de navigation ont besoin du thème : elles vivent donc sous le
 * fournisseur, pas à côté.
 */
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
  // La marque du tenant arrivera avec l'authentification (ticket P0-005).
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <ThemeProvider scheme={scheme}>
      <ThemedStack />
    </ThemeProvider>
  );
}
