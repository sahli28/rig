import type { ImageSourcePropType } from 'react-native';
import welcome from '../assets/backdrops/welcome.jpg';
import hero from '../assets/backdrops/hero.jpg';
import empty from '../assets/backdrops/empty.jpg';

/**
 * Les fonds photographiques de la direction P2-021.
 *
 * **Optionnels par construction** : chaque entrée peut valoir `null`, et
 * `ImageBackdrop` sait s'en passer (fond `scrim` plein). C'est ce qui garde le
 * white-label intact — une box qui ne se reconnaît pas dans ces photos pourra
 * les remplacer ou les couper sans qu'un écran en dépende.
 *
 * Aujourd'hui ce sont les fonds de la plateforme, les mêmes pour toutes les
 * boxes : `themes` n'a pas de colonne d'image, et **aucun ticket ne la porte
 * encore**. Le jour où elle existe, c'est ici qu'elle se branche, et nulle part
 * ailleurs — les écrans ne font jamais de `require()` d'image.
 *
 * Où ils ont le droit d'aller : bienvenue, connexion, carte héro, états vides.
 * **Jamais** derrière le planning, un formulaire ou une liste dense.
 */
export interface ThemeImages {
  welcome: ImageSourcePropType | null;
  hero: ImageSourcePropType | null;
  empty: ImageSourcePropType | null;
}

const PLATFORM_IMAGES: ThemeImages = { welcome, hero, empty };

export function useThemeImages(): ThemeImages {
  return PLATFORM_IMAGES;
}
