import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Vrai quand la personne a demandé à réduire les animations au niveau du système.
 * Toute animation du kit doit s'y soumettre — un chrono doit rester lisible
 * sans mouvement.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduced(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduced;
}
