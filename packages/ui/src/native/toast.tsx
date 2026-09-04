import { useEffect } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '../theme/index';

export type ToastTone = 'neutral' | 'success' | 'danger';

export interface ToastProps {
  message: string;
  tone?: ToastTone;
  /** Action de rattrapage : « Annuler ». */
  action?: ReactNode;
  /**
   * Ce qui est **dit**, quand ce n'est pas ce qui est écrit. « C'est réservé »
   * suffit à l'œil, qui voit le cours juste au-dessus ; à l'oreille il manque
   * de quoi savoir *quoi* a été réservé. Vaut `message` par défaut.
   */
  announcement?: string;
}

/**
 * Retour ponctuel après une action. Purement présentationnel : la file
 * d'affichage et les délais appartiennent à l'app, pas au kit.
 *
 * **Sauf l'annonce, et c'est une correction.** Ce composant portait
 * `accessibilityRole="alert"` et `accessibilityLiveRegion="polite"` — or
 * `accessibilityLiveRegion` **n'existe que sous Android** dans React Native. Sur
 * iPhone, l'appareil de toutes nos passes, un `Toast` s'affichait donc **sans
 * être annoncé** : la confirmation d'une réservation, exactement le changement
 * d'état que §12.4 impose d'annoncer, restait muette pour un lecteur d'écran.
 *
 * Règle des sœurs, côté interface : un chemin gardé (Android), son jumeau oublié
 * (iOS). Le correctif vit ici et non dans l'écran, parce que l'écart vaut pour
 * **tous** les `Toast` du produit — celui de P1-003b n'était que le premier à en
 * avoir besoin.
 */
export function Toast({ message, tone = 'neutral', action, announcement }: ToastProps) {
  const theme = useTheme();

  const dit = announcement ?? message;
  useEffect(() => {
    // Au changement de texte, et pas seulement au montage : deux refus d'affilée
    // ne remontent pas le composant, et le second doit s'entendre aussi.
    AccessibilityInfo.announceForAccessibility(dit);
  }, [dit]);

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
