import { Text, View } from 'react-native';
import { useTheme } from '../theme/index';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
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
export function Badge({ label, tone = 'neutral', accessibilityLabel }: BadgeProps) {
  const theme = useTheme();

  const foreground = {
    neutral: theme.colors.textMuted,
    primary: theme.colors.primary,
    success: theme.colors.success,
    warning: theme.colors.warning,
    danger: theme.colors.danger,
  }[tone];

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: theme.space(2),
        paddingVertical: theme.space(1),
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: foreground,
        backgroundColor: theme.colors.surface,
      }}
    >
      <Text
        style={{
          color: foreground,
          fontSize: theme.typography.caption,
          fontFamily: theme.fontFamily,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
