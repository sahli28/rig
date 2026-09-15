import type { Metadata } from 'next';
import { PolicyScreen } from './policy-screen';

/**
 * La page publique de la politique de confidentialité (D-023).
 *
 * C'est le texte que l'écran de consentement fait « lire » : le lien de
 * `consents.tsx` (mobile) ouvre cette adresse, et la version affichée ici est
 * celle que `current_policy_version()` retourne et que `consents` enregistre —
 * `privacy-policy.test.ts` interdit qu'elles divergent. Publique et sans
 * session, comme `/invitation/[token]` : un texte qu'on doit pouvoir retrouver
 * ne demande pas de se connecter.
 *
 * L'i18n SSR des pages publiques reste `D-003` : comme ses voisines, la page
 * choisit la langue côté client (préférence enregistrée, sinon celle du
 * navigateur).
 */
export const metadata: Metadata = {
  title: 'Politique de confidentialité — Rack',
  description: 'Comment les données des membres sont traitées dans Rack, et vos droits.',
};

export default function PrivacyPolicyPage() {
  return <PolicyScreen />;
}
