import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/index';
import { Sheet } from './sheet';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label: string;
  value: string | null;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  /** Texte affiché tant que rien n'est choisi. */
  placeholder: string;
  /** Titre de la feuille de choix. Repris du libellé si absent. */
  sheetTitle?: string;
  disabled?: boolean;
}

/**
 * React Native n'a pas de `<select>` natif : on ouvre une feuille de choix.
 * Le déclencheur porte le libellé et la valeur courante pour les lecteurs d'écran.
 */
export function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
  sheetTitle,
  disabled = false,
}: SelectProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <View style={{ gap: theme.space(2) }}>
      <Text
        style={{
          color: theme.colors.text,
          fontSize: theme.typography.small,
          fontFamily: theme.fontFamily,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>

      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="combobox"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label ?? placeholder }}
        accessibilityState={{ disabled, expanded: open }}
        style={{
          minHeight: theme.minTouchTarget,
          justifyContent: 'center',
          paddingHorizontal: theme.space(3),
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Text
          style={{
            color: selected === null ? theme.colors.textMuted : theme.colors.text,
            fontSize: theme.typography.body,
            fontFamily: theme.fontFamily,
          }}
        >
          {selected?.label ?? placeholder}
        </Text>
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title={sheetTitle ?? label}>
        <View accessibilityRole="radiogroup" accessibilityLabel={label}>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                style={{
                  minHeight: theme.minTouchTarget,
                  justifyContent: 'center',
                  paddingHorizontal: theme.space(2),
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                }}
              >
                <Text
                  style={{
                    color: isSelected ? theme.colors.primary : theme.colors.text,
                    fontSize: theme.typography.body,
                    fontFamily: theme.fontFamily,
                    fontWeight: isSelected ? '700' : '400',
                  }}
                >
                  {/* La coche double la couleur : le choix reste lisible en
                      vision monochrome. */}
                  {isSelected ? '✓ ' : ''}
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}
