/**
 * La forme du lien d'invitation, à **un seul endroit**.
 *
 * Elle vivait dans une seule tête : le web la fabriquait à la main
 * (`/invitation/<jeton>`), et `apps/mobile` n'avait aucune route pour la
 * recevoir. Le 3 septembre 2026, ouvrir le lien du produit sur l'iPhone donnait
 * « Unmatched Route » ; `useAuthRedirect` renvoyait alors sur `/welcome`
 * **sans les paramètres**, et le jeton disparaissait avant d'avoir servi.
 * Personne n'était rattaché à sa box, sans le moindre message d'erreur.
 *
 * Deux règles en découlent :
 *
 * 1. **celui qui fabrique le lien et celui qui le reçoit partagent ce module.**
 *    Un chemin recopié à la main dérive au premier changement, et c'est
 *    invisible tant que personne n'ouvre le lien sur les deux plateformes ;
 * 2. **un jeton lu d'une URL ne voyage plus dans l'URL.** Il passe en contexte
 *    (`BrandProvider`), parce qu'une redirection n'emporte pas les paramètres —
 *    ce que le `?semaine=` de P1-002 avait déjà montré une fois.
 *
 * Ce que ce module ne fait **pas** : analyser une URL entrante. Un parseur y a
 * vécu une heure, sans appelant — expo-router résout lui-même l'URL vers la
 * route et rend le segment par `useLocalSearchParams`. La règle 7 de
 * `CLAUDE.md` s'applique à ce qu'on écrit en corrigeant comme au reste.
 */

/**
 * Le segment de chemin.
 *
 * **Il ne peut pas être importé des deux côtés**, et c'est la limite à
 * connaître : côté mobile, le chemin est porté par un **nom de fichier**
 * (`app/(auth)/invitation/[token].tsx`), qu'aucune constante ne peut peupler.
 * C'est précisément par là que la divergence est passée. D'où le test de parité
 * de `invitation-link.test.ts`, qui relit l'arborescence de routes plutôt que
 * de faire confiance à la convention.
 */
export const INVITATION_PATH_SEGMENT = 'invitation';

/** Le chemin d'un lien d'invitation, tel que le web l'affiche et le QR l'encode. */
export function invitationPath(token: string): string {
  return `/${INVITATION_PATH_SEGMENT}/${encodeURIComponent(token)}`;
}
