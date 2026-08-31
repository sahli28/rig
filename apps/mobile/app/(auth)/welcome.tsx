import { useEffect } from 'react';
import { Image, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@rig/ui/theme';
import { useI18n } from '@rig/ui/i18n';
import { Banner, Button } from '@rig/ui/native';
import { useBrand } from '../../lib/brand';

/**
 * Écran de bienvenue, **aux couleurs de la box avant toute connexion**.
 *
 * Le `slug` vient du lien d'invitation. Sans lui — ouverture à froid, app
 * téléchargée sans lien — le thème RIG neutre s'applique et la marque de la box
 * arrive après `me()`. Il n'y a pas d'écran de saisie de code de box en 005a.
 */
export default function WelcomeScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { slug, token } = useLocalSearchParams<{ slug?: string; token?: string }>();
  const { brand, status, resolveSlug } = useBrand();

  useEffect(() => {
    if (slug) void resolveSlug(slug);
  }, [slug, resolveSlug]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.surface,
        padding: theme.space(4),
        gap: theme.space(5),
        justifyContent: 'center',
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {brand?.logoUrl ? (
        <Image
          source={{ uri: brand.logoUrl }}
          accessibilityLabel={brand.appName}
          resizeMode="contain"
          style={{ height: 72, width: '100%' }}
        />
      ) : null}

      <Text
        style={{
          color: theme.colors.text,
          fontSize: theme.typography.display,
          fontFamily: theme.fontFamily,
          fontWeight: '700',
        }}
      >
        {brand === null
          ? t('auth.welcome_title_neutral')
          : t('auth.welcome_title', { box: brand.appName })}
      </Text>

      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: theme.typography.body,
          fontFamily: theme.fontFamily,
        }}
      >
        {t('auth.welcome_body')}
      </Text>

      {/* Un slug inconnu ne dit pas « cette box n'existe pas » : il ne dit rien
          de la box, seulement que le lien n'a pas été reconnu. */}
      {status === 'unknown' ? (
        <Banner
          title={t('auth.welcome_link_unrecognised')}
          description={t('auth.welcome_link_unrecognised_body')}
          tone="warning"
        />
      ) : null}

      <Button
        label={t('auth.welcome_cta')}
        fullWidth
        onPress={() =>
          router.push({ pathname: '/auth', params: token === undefined ? {} : { token } })
        }
      />
    </View>
  );
}
