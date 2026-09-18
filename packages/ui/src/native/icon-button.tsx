import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '../theme/index';

export interface IconButtonProps {
  /** L'icône elle-même — `<Icon name=… />` du kit. */
  children: ReactNode;
  onPress: () => void;
  /** Obligatoire : un bouton sans texte est muet pour un lecteur d'écran. */
  accessibilityLabel: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  children,
  onPress,
  accessibilityLabel,
  disabled = false,
  style,
}: IconButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        {
          width: theme.minTouchTarget,
          height: theme.minTouchTarget,
          borderRadius: theme.radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? theme.colors.surface3 : theme.colors.surface2,
          borderWidth: 1,
          borderColor: theme.colors.border,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
