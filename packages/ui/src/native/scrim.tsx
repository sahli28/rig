import { useMemo } from 'react';
import {
  Image,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { ReactNode } from 'react';
import { scrimBands, useTheme } from '../theme/index';

export interface ScrimProps {
  /** Alpha en haut du voile. */
  from?: number;
  /** Alpha en bas, là où le texte se pose. Sous 0,85 le contraste AA n'est plus garanti. */
  to?: number;
}

/**
 * Le voile d'une image : des bandes d'alpha croissant, du haut vers le bas.
 * Pas de module natif — voir `theme/scrim.ts` pour le pourquoi.
 */
export function Scrim({ from = 0.2, to = 0.95 }: ScrimProps) {
  const theme = useTheme();
  const bandes = useMemo(
    () => scrimBands(theme.colors.scrim, from, to),
    [theme.colors.scrim, from, to],
  );

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
    >
      {bandes.map((bande, index) => (
        <View key={index} style={{ flex: 1, backgroundColor: bande.color }} />
      ))}
    </View>
  );
}

export interface ImageBackdropProps extends ScrimProps {
  /** `null` : pas d'image — la box n'en veut pas, ou le thème n'en fournit pas. */
  source: ImageSourcePropType | null;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Une image **toujours** voilée : il n'existe pas de chemin qui pose du texte
 * sur une photo nue. Sans image, le fond est `scrim` plein — le texte `onImage`
 * reste lisible, et l'écran ne dépend pas d'un fichier pour fonctionner.
 */
export function ImageBackdrop({ source, children, style, from, to }: ImageBackdropProps) {
  const theme = useTheme();
  const base: ViewStyle = { backgroundColor: theme.colors.scrim, overflow: 'hidden' };

  if (source === null) return <View style={[base, style]}>{children}</View>;

  return (
    <View style={[base, style]}>
      {/* Pas `ImageBackground` : sous react-native-web, une image `require()`
          impose sa taille intrinsèque (864 × 1536) et déborde du conteneur — vu
          dans le harnais, l'écran de bienvenue montrait un quart de la photo.
          Des dimensions explicites à 100 % valent sur les deux plateformes. */}
      <Image
        source={source}
        resizeMode="cover"
        // Décorative : ce que l'image montre n'est jamais une information.
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      />
      <Scrim {...(from === undefined ? {} : { from })} {...(to === undefined ? {} : { to })} />
      {children}
    </View>
  );
}
