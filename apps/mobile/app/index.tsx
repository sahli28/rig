import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { useTheme } from '@rig/ui/theme';
import { Button, Card } from '@rig/ui/native';

export default function HomeScreen() {
  const theme = useTheme();

  // Écran d'accueil provisoire : il n'a pas encore de contenu produit.
  // Les chaînes visibles passeront par i18n au ticket P0-003.
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

      <Card>
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.body,
            fontFamily: theme.fontFamily,
          }}
        >
          Socle en place. Le planning et la réservation arrivent en P1.
        </Text>
      </Card>

      <Link href="/design-system" asChild>
        <Button label="Voir le système de design" onPress={() => {}} fullWidth />
      </Link>
    </View>
  );
}
