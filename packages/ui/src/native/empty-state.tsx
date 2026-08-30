import { Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '../theme/index';

export interface EmptyStateProps {
  title: string;
  /** Ce que la personne peut faire. Un état vide muet est un état vide raté. */
  description: string;
  /** Bouton d'action : « Voir le planning », « Logger mon premier score ». */
  action?: ReactNode;
  /** Illustration ou icône, fournie par l'appelant. */
  illustration?: ReactNode;
}

export function EmptyState({ title, description, action, illustration }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space(3),
        paddingHorizontal: theme.space(6),
        paddingVertical: theme.space(10),
      }}
    >
      {illustration}
      <Text
        style={{
          color: theme.colors.text,
          fontSize: theme.typography.title,
          fontFamily: theme.fontFamily,
          fontWeight: '700',
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: theme.typography.body,
          fontFamily: theme.fontFamily,
          textAlign: 'center',
        }}
      >
        {description}
      </Text>
      {action}
    </View>
  );
}
