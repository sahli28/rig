import { Text, View } from 'react-native';
import { softTone, useTheme } from '../theme/index';
import { Icon, type IconName } from './icon';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /** Décorative : le libellé porte le sens, l'icône l'accélère à l'œil. */
  icon?: IconName;
  /**
   * Ce que le lecteur d'écran annonce, quand le libellé visible est plus court
   * que ce qu'il faut comprendre.
   *
   * « En direct » suffit à l'œil, qui voit le compteur juste à côté ; à
   * l'oreille, la pastille arrive seule dans le flux et ne dit pas de quoi elle
   * parle. `.claude/rules/ui.md` : un élément s'annonce par **ce qu'il fait**.
   */
  accessibilityLabel?: string;
}

/**
 * Pastille d'état. Le texte porte toujours l'information : « Complet » s'écrit,
 * il ne se devine pas à la couleur (règle d'accessibilité du projet).
 */
export function Badge({ label, tone = 'neutral', icon, accessibilityLabel }: BadgeProps) {
  const theme = useTheme();

  const foreground = {
    neutral: theme.colors.textMuted,
    primary: theme.colors.primary,
    success: theme.colors.success,
    warning: theme.colors.warning,
    danger: theme.colors.danger,
  }[tone];

  // Fond teinté plutôt que liseré (P2-021) : la pastille se lit comme un état,
  // pas comme un bouton. `softTone` garantit AA sur son propre fond.
  const doux = softTone(theme, foreground);

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space(1),
        paddingHorizontal: theme.space(3),
        paddingVertical: theme.space(1),
        borderRadius: theme.radius.full,
        backgroundColor: doux.background,
      }}
    >
      {icon === undefined ? null : <Icon name={icon} size={14} color={doux.foreground} />}
      <Text
        style={{
          color: doux.foreground,
          fontSize: theme.typography.caption,
          fontFamily: theme.fontFamily,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
