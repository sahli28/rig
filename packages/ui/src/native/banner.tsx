import { Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '../theme/index';

export type BannerTone = 'info' | 'success' | 'warning' | 'danger';

export interface BannerProps {
  title: string;
  description?: string;
  tone?: BannerTone;
  /** Action inline : « Mettre à jour ma carte », « Voir les formules ». */
  action?: ReactNode;
}

/** Message persistant en tête d'écran : paiement en échec, mode hors ligne. */
export function Banner({ title, description, tone = 'info', action }: BannerProps) {
  const theme = useTheme();

  const accent = {
    info: theme.colors.primary,
    success: theme.colors.success,
    warning: theme.colors.warning,
    danger: theme.colors.danger,
  }[tone];

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={description === undefined ? title : `${title}. ${description}`}
      style={{
        backgroundColor: theme.colors.surface2,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderLeftWidth: 4,
        borderLeftColor: accent,
        padding: theme.space(4),
        gap: theme.space(2),
      }}
    >
      <Text
        style={{
          color: theme.colors.text,
          fontSize: theme.typography.body,
          fontFamily: theme.fontFamily,
          fontWeight: '600',
        }}
      >
        {title}
      </Text>
      {description === undefined ? null : (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.small,
            fontFamily: theme.fontFamily,
          }}
        >
          {description}
        </Text>
      )}
      {action}
    </View>
  );
}
