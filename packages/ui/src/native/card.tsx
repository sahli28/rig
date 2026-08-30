import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '../theme/index';

export interface CardProps {
  children: ReactNode;
  /** Rend la carte actionnable. Sans lui, la carte est un simple conteneur. */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, onPress, accessibilityLabel, style }: CardProps) {
  const theme = useTheme();

  const base: ViewStyle = {
    backgroundColor: theme.colors.surface2,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space(4),
  };

  if (onPress === undefined) {
    return <View style={[base, style]}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      {...(accessibilityLabel === undefined ? {} : { accessibilityLabel })}
      style={({ pressed }) => [
        base,
        // Une carte actionnable est une cible tactile : sa hauteur ne peut pas
        // dépendre uniquement de son contenu.
        { minHeight: theme.minTouchTarget, opacity: pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
