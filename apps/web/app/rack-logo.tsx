import { DEFAULT_BRAND } from '@rack/ui/theme';
import styles from './rack-logo.module.css';

/**
 * La marque Rack, **en attendant le fichier vectoriel** de la commanditaire.
 *
 * Le logo fourni le 18 septembre 2026 est un PNG sur fond clair : posé tel quel
 * sur un volet sombre il ferait un pavé, et détouré ses lettres « ACK » sombres
 * disparaîtraient. D'où ce placeholder en texte, qui en reprend la construction
 * — un « R » dans un pavé de couleur, « ACK » en capitales grasses et penchées —
 * avec des tokens, donc lisible dans les deux schémas. **À remplacer par le SVG
 * dès qu'il existe** (deux variantes : complet, et « R » seul).
 *
 * `compact` : le « R » seul, pour le volet replié et les petits emplacements.
 */
export function RackLogo({ compact = false }: { compact?: boolean }) {
  return (
    // Le nom est dit une fois, par `aria-label` : lu lettre à lettre, « R » puis
    // « ACK » ne ferait pas un mot.
    <span className={styles.logo} role="img" aria-label={DEFAULT_BRAND.appName}>
      <span className={styles.mark} aria-hidden="true">
        R
      </span>
      {compact ? null : (
        <span className={styles.word} aria-hidden="true">
          ACK
        </span>
      )}
    </span>
  );
}
