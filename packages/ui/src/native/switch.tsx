import { Switch as RNSwitch, Text, View } from 'react-native';
import { useTheme } from '../theme/index';

export interface SwitchProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Précision sous le libellé : « Rappel la veille à 18 h ». */
  description?: string;
  disabled?: boolean;
}

/** Interrupteur de réglage : catégories de notification, options de confidentialité. */
export function Switch({
  label,
  value,
  onValueChange,
  description,
  disabled = false,
}: SwitchProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space(3),
        minHeight: theme.minTouchTarget,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={{ flex: 1, gap: theme.space(1) }}>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: theme.typography.body,
            fontFamily: theme.fontFamily,
          }}
        >
          {label}
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
      </View>

      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled }}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
        thumbColor={theme.colors.surface}
      />
    </View>
  );
}
