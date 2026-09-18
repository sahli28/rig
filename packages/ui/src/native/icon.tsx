import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../theme/index';

/**
 * Le jeu d'icônes du produit : **Feather**, et lui seul.
 *
 * Le web emploie `lucide-react`, qui en descend : même grille 24, même trait de
 * 2, mêmes noms. Cette union est **la liste fermée** de ce que les deux surfaces
 * partagent — y ajouter un nom, c'est vérifier qu'il existe des deux côtés.
 * Bibliothèque libre (MIT) : aucun pictogramme propriétaire n'entre ici.
 */
export type IconName =
  | 'home'
  | 'calendar'
  | 'bookmark'
  | 'user'
  | 'bell'
  | 'chevron-left'
  | 'chevron-right'
  | 'x'
  | 'check'
  | 'check-circle'
  | 'alert-circle'
  | 'arrow-right'
  | 'map-pin'
  | 'users'
  | 'clock'
  | 'more-horizontal'
  | 'wifi-off';

export interface IconProps {
  name: IconName;
  /** 20 par défaut ; 16 dans une pastille. */
  size?: number;
  /** `colors.text` par défaut. Toujours un token. */
  color?: string;
}

/**
 * **Décorative par construction** : l'icône est masquée aux lecteurs d'écran,
 * et c'est son parent — `IconButton`, `Badge`, `Button` — qui porte le libellé.
 * Une icône seule n'a jamais de sens à l'oreille (§12.4).
 */
export function Icon({ name, size = 20, color }: IconProps) {
  const theme = useTheme();
  return (
    <Feather
      name={name}
      size={size}
      color={color ?? theme.colors.text}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
