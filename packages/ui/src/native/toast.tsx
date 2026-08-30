import { Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '../theme/index';

export type ToastTone = 'neutral' | 'success' | 'danger';

export interface ToastProps {
  message: string;
  tone?: ToastTone;
  /** Action de rattrapage : « Annuler ». */
  action?: ReactNode;
}

/**
 * Retour ponctuel après une action. Purement présentationnel : la file
 * d'affichage et les délais appartiennent à l'app, pas au kit.
 */
export function Toast({ message, tone = 'neutral', action }: ToastProps) {
  const theme = useTheme();

  const accent = {
    neutral: theme.colors.border,
    success: theme.colors.success,
    danger: theme.colors.danger,
  }[tone];

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space(3),
        backgroundColor: theme.colors.surface2,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: accent,
        paddingHorizontal: theme.space(4),
        paddingVertical: theme.space(3),
        minHeight: theme.minTouchTarget,
      }}
    >
      <Text
        style={{
          flex: 1,
          color: theme.colors.text,
          fontSize: theme.typography.small,
          fontFamily: theme.fontFamily,
        }}
      >
        {message}
      </Text>
      {action}
    </View>
  );
}
