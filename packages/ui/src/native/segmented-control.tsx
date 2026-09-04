import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/index';

export interface SegmentedOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: readonly SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel?: string;
}

/** Choix exclusif court : Rx / Scaled / Beginner, ou Jour / Semaine. */
export function SegmentedControl({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      {...(accessibilityLabel === undefined ? {} : { accessibilityLabel })}
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.surface2,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.space(1),
        gap: theme.space(1),
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            // **Le libellé est porté par le segment, pas seulement par son
            // texte.** Sans lui, l'arbre d'accessibilité rend un `radio` sans
            // nom, dont le mot n'existe que dans un nœud enfant : le groupe
            // s'annonce « Langue » et les choix ne s'annoncent pas du tout.
            // Trouvé en lisant l'arbre de l'accueil, deux semaines après
            // l'écriture du composant, et invisible à l'écran.
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              // Chaque segment est une cible à part entière : il porte le
              // plancher en entier, sans le partager avec le rembourrage
              // du conteneur.
              minHeight: theme.minTouchTarget,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radius.sm,
              backgroundColor: selected ? theme.colors.primary : 'transparent',
            }}
          >
            <Text
              style={{
                color: selected ? theme.colors.onPrimary : theme.colors.textMuted,
                fontSize: theme.typography.small,
                fontFamily: theme.fontFamily,
                fontWeight: selected ? '700' : '500',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
