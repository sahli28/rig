import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { useTheme } from '@rig/ui/theme';
import { useI18n } from '@rig/ui/i18n';
import { Button, Card, SegmentedControl } from '@rig/ui/native';

export default function HomeScreen() {
  const theme = useTheme();
  const { t, locale, setLocale } = useI18n();

  // Écran d'accueil provisoire : le planning et la réservation arrivent en P1.
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
          {t('home.placeholder')}
        </Text>
      </Card>

      {/* Le sélecteur de langue est ici pour prouver le critère du ticket :
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

      <Link href="/design-system" asChild>
        <Button label={t('home.design_system_cta')} onPress={() => {}} fullWidth />
      </Link>
    </View>
  );
}
