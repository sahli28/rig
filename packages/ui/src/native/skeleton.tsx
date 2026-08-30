import { useEffect, useRef } from 'react';
import { Animated, Easing, type DimensionValue } from 'react-native';
import { useTheme } from '../theme/index';
import { useI18n } from '../i18n/index';
import { useReducedMotion } from './use-reduced-motion';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  /** Rayon personnalisé — par défaut celui du thème. */
  radius?: number;
}

/** Bloc de chargement. Pulsation désactivée si la personne a réduit les animations. */
export function Skeleton({ width = '100%', height = 16, radius }: SkeletonProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(0.6);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.8,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();

    return () => animation.stop();
  }, [pulse, reducedMotion]);

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      style={{
        width,
        height,
        borderRadius: radius ?? theme.radius.sm,
        backgroundColor: theme.colors.border,
        opacity: pulse,
      }}
    />
  );
}
