import ui from '../../ui.module.css';
import { LoadingLabel } from './loading-label';

/**
 * **Zéro tap mort** (P2-022, §12.1 principe 3).
 *
 * Chaque page du back-office lit la base côté serveur avant de rendre. Sans ce
 * fichier, un clic dans la navigation ne montrait rien tant que la lecture
 * n'était pas revenue : l'écran précédent restait figé, et on recliquait. Next
 * affiche ce squelette **immédiatement**, dans la coquille — l'entrée de
 * navigation s'allume aussitôt, le contenu arrive ensuite.
 *
 * Si la lecture est lente de fond (démarrage à froid de Supabase), c'est de la
 * performance — `D-032` —, pas de l'interface. Le retour visuel, lui, est dû
 * quoi qu'il arrive.
 */
export default function BoxLoading() {
  return (
    <div role="status" style={{ display: 'grid', gap: 24 }}>
      <LoadingLabel />
      <div className={ui.skeleton} style={{ height: 40, width: '40%' }} aria-hidden="true" />
      <div className={ui.skeleton} style={{ height: 180 }} aria-hidden="true" />
      <div className={ui.skeleton} style={{ height: 320 }} aria-hidden="true" />
    </div>
  );
}
