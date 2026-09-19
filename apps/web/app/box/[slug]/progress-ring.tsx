import { progressRing } from '@rack/ui/theme';
import styles from './dashboard.module.css';

/**
 * L'anneau de progression de la mise en route (P2-004). Le SVG **web** ; la
 * géométrie vient de `@rack/ui/theme` (`progressRing`), partagée et testée.
 *
 * Décoratif au sens de l'AT : le pourcentage et « n / total » sont écrits à côté
 * en toutes lettres (le composant appelant), donc l'anneau est `aria-hidden`.
 * Le remplissage n'anime pas sous `prefers-reduced-motion` (voir la feuille).
 */
export function ProgressRing({ pct }: { pct: number }) {
  const g = progressRing(pct, { size: 104, strokeWidth: 12 });
  return (
    <svg
      className={styles.ringSvg}
      viewBox={`0 0 ${g.size} ${g.size}`}
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx={g.center}
        cy={g.center}
        r={g.radius}
        fill="none"
        stroke="var(--rack-color-surface-3)"
        strokeWidth={g.strokeWidth}
      />
      <circle
        className={styles.ringArc}
        cx={g.center}
        cy={g.center}
        r={g.radius}
        fill="none"
        stroke="var(--rack-color-primary)"
        strokeWidth={g.strokeWidth}
        strokeLinecap="round"
        strokeDasharray={g.circumference}
        strokeDashoffset={g.dashOffset}
        transform={`rotate(-90 ${g.center} ${g.center})`}
      />
    </svg>
  );
}
