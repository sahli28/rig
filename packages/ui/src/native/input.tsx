import { useId } from 'react';
import { Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { useTheme } from '../theme/index';

export interface InputProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** Message d'erreur. Sa présence marque le champ comme invalide. */
  error?: string;
  /** Aide affichée sous le champ quand il n'y a pas d'erreur. */
  hint?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  editable?: boolean;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  secureTextEntry = false,
  keyboardType,
  editable = true,
}: InputProps) {
  const theme = useTheme();
  const id = useId();
  const invalid = error !== undefined;

  return (
    <View style={{ gap: theme.space(2) }}>
      <Text
        nativeID={`${id}-label`}
        style={{
          color: theme.colors.text,
          fontSize: theme.typography.small,
          fontFamily: theme.fontFamily,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        secureTextEntry={secureTextEntry}
        accessibilityLabelledBy={`${id}-label`}
        accessibilityLabel={label}
        accessibilityState={{ disabled: !editable }}
        placeholderTextColor={theme.colors.textMuted}
        {...(placeholder === undefined ? {} : { placeholder })}
        {...(keyboardType === undefined ? {} : { keyboardType })}
        style={{
          minHeight: theme.minTouchTarget,
          paddingHorizontal: theme.space(3),
          paddingVertical: theme.space(3),
          borderRadius: theme.radius.md,
          borderWidth: 1,
          // L'erreur est portée par la bordure ET par le texte en dessous :
          // jamais par la seule couleur.
          borderColor: invalid ? theme.colors.danger : theme.colors.border,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
          fontSize: theme.typography.body,
          fontFamily: theme.fontFamily,
          opacity: editable ? 1 : 0.5,
        }}
      />

      {invalid ? (
        <Text
          accessibilityRole="alert"
          style={{
            color: theme.colors.danger,
            fontSize: theme.typography.caption,
            fontFamily: theme.fontFamily,
          }}
        >
          {error}
        </Text>
      ) : hint === undefined ? null : (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.caption,
            fontFamily: theme.fontFamily,
          }}
        >
          {hint}
        </Text>
      )}
    </View>
  );
}
