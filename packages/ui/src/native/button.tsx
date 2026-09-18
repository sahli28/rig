import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/index';
import { Icon, type IconName } from './icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  /** Décorative, à gauche du libellé. */
  icon?: IconName;
  /** Repris du label si absent. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;

  const background = {
    primary: theme.colors.primary,
    secondary: theme.colors.surface2,
    ghost: 'transparent',
    danger: theme.colors.danger,
  }[variant];

  const foreground = {
    primary: theme.colors.onPrimary,
    secondary: theme.colors.text,
    ghost: theme.colors.primary,
    danger: theme.colors.onDanger,
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        {
          minHeight: theme.minTouchTarget + theme.space(1),
          paddingHorizontal: theme.space(5),
          paddingVertical: theme.space(3),
          borderRadius: theme.radius.md,
          backgroundColor: background,
          borderWidth: variant === 'ghost' ? 0 : 1,
          borderColor: variant === 'secondary' ? theme.colors.border : background,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          // L'état pressé et l'état inactif ne reposent pas sur la seule couleur :
          // l'opacité reste perceptible en vision monochrome.
          opacity: inactive ? 0.5 : pressed ? 0.75 : 1,
          // Retour **immédiat** au tap (zéro tap mort) : l'échelle se voit même
          // quand la couleur du bouton est proche du fond.
          transform: [{ scale: pressed && !inactive ? 0.97 : 1 }],
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space(2) }}>
        {loading ? (
          <ActivityIndicator size="small" color={foreground} />
        ) : icon === undefined ? null : (
          <Icon name={icon} color={foreground} />
        )}
        <Text
          style={{
            color: foreground,
            fontSize: theme.typography.body,
            fontFamily: theme.fontFamily,
            fontWeight: '700',
            textAlign: 'center',
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
