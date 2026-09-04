import { useEffect } from 'react';
import { Image, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@rig/ui/theme';
import { useI18n } from '@rig/ui/i18n';
import { Banner, Button } from '@rig/ui/native';
import { useBrand } from '../../lib/brand';

/**
 * Écran de bienvenue, **aux couleurs de la box avant toute connexion**.
 *
 * Deux façons d'arriver ici avec une box à afficher, et il en manquait une :
 *
 * - un **jeton** d'invitation, ce que porte un vrai lien. Résolu par
 *   `invitation_preview()`, capté par `/invitation/<jeton>` et rangé dans le
 *   contexte de marque. C'était la branche absente : `apps/mobile` ne résolvait
 *   que depuis un slug, qu'aucun lien ne porte, donc un membre invité voyait
 *   toujours la marque de la plateforme ;
 * - un **slug**, forme historique conservée pour les liens déjà distribués.
 *
 * Sans l'un ni l'autre — ouverture à froid, app téléchargée sans lien — le thème
 * RIG neutre s'applique et la marque de la box arrive après `me()`.
 */
export default function WelcomeScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { slug, token } = useLocalSearchParams<{ slug?: string; token?: string }>();
  const { brand, status, invitationToken, resolveSlug, resolveToken } = useBrand();

  useEffect(() => {
    // Le contexte d'abord : `/invitation/<jeton>` y a déjà déposé le jeton et
    // lancé la résolution. Le paramètre d'URL ne sert qu'aux liens de la forme
    // `?token=`, qui n'ont pas traversé cette route.
    if (invitationToken === null && token) void resolveToken(token);
    else if (invitationToken === null && slug) void resolveSlug(slug);
  }, [invitationToken, token, slug, resolveSlug, resolveToken]);

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

      {/* Aucun paramètre : le jeton voyage par le contexte, que la navigation
          ne peut pas vider. Le passer aussi dans l'URL rouvrirait deux sources
          de vérité, dont une qui se perd à la première redirection. */}
      <Button label={t('auth.welcome_cta')} fullWidth onPress={() => router.push('/auth')} />
    </View>
  );
}
