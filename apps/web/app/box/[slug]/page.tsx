import { Notice } from './notice';

/**
 * Tableau de bord. Vide jusqu'à P1-001 : la coquille était le préalable, et un
 * écran de remplissage qui le dit vaut mieux qu'une page blanche.
 */
export default function DashboardPage() {
  return <Notice kind="coming_soon" />;
}
