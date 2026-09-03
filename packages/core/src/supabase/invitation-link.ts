/**
 * La forme du lien d'invitation, à **un seul endroit**.
 *
 * Elle vivait dans deux têtes séparées : le web la fabriquait
 * (`/invitation/<jeton>`), et le mobile ne la lisait nulle part. Résultat, le
 * 3 septembre 2026 : ouvrir le lien du produit sur l'iPhone donnait
 * « Unmatched Route », `useAuthRedirect` renvoyait sur `/welcome` **sans les
 * paramètres**, et le jeton disparaissait avant d'avoir servi. Personne n'était
 * rattaché à sa box, sans le moindre message d'erreur.
 *
 * Deux règles en découlent, et ce module les porte toutes les deux :
 *
 * 1. **celui qui fabrique le lien et celui qui le lit partagent le même code.**
 *    Un préfixe recopié à la main dérive au premier changement ;
 * 2. **un jeton lu d'une URL ne voyage plus dans l'URL.** Il passe en contexte,
 *    parce qu'une redirection n'emporte pas les paramètres — c'est exactement
 *    ce qui s'est produit ici, et ce que le `?semaine=` de P1-002 avait déjà
 *    montré.
 */

/** Le segment de chemin. Changé ici, il change des deux côtés. */
export const INVITATION_PATH_SEGMENT = 'invitation';

/** Le chemin d'un lien d'invitation, tel que le web l'affiche et le QR l'encode. */
export function invitationPath(token: string): string {
  return `/${INVITATION_PATH_SEGMENT}/${encodeURIComponent(token)}`;
}

/**
 * Un jeton acceptable ? Volontairement permissif sur la longueur — le seed en
 * pose de lisibles (`inv-rueil-0001`), `create_invitation()` en génère de longs
 * — mais strict sur le jeu de caractères, pour qu'un segment d'URL quelconque
 * ne passe pas pour un jeton.
 */
const TOKEN = /^[A-Za-z0-9._~-]{1,128}$/;

/**
 * Le jeton porté par une URL d'invitation, ou `null`.
 *
 * Accepte les quatre formes que le produit peut présenter à l'app :
 *
 * - `https://…/invitation/<jeton>` — le lien du back-office et le QR mural ;
 * - `rig://invitation/<jeton>` — le schéma de l'app ;
 * - `exp://192.168.1.133:8081/--/invitation/<jeton>` — Expo Go, qui insère
 *   `/--/` entre l'hôte du bundler et la route ;
 * - `…?token=<jeton>` — la forme historique, encore acceptée par `/welcome`.
 *
 * Rend `null` plutôt que de lever : une URL qui n'est pas une invitation est un
 * cas nominal (ouverture à froid), pas une erreur.
 */
export function invitationTokenFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // Analyse sans `new URL()` : `rig://invitation/abc` y perd son premier
  // segment, que l'API traite comme un nom d'hôte. Un découpage textuel est
  // plus long à lire mais rend la même chose pour les quatre formes.
  const withoutScheme = url.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
  const [pathPart = '', queryPart = ''] = withoutScheme.split('?', 2);

  const segments = pathPart.split('/').filter((segment) => segment.length > 0 && segment !== '--');

  const index = segments.lastIndexOf(INVITATION_PATH_SEGMENT);
  if (index !== -1) {
    const candidate = segments[index + 1];
    if (candidate !== undefined) {
      const decoded = safeDecode(candidate);
      if (decoded !== null && TOKEN.test(decoded)) return decoded;
    }
  }

  for (const pair of queryPart.split('&')) {
    const [key, value] = pair.split('=', 2);
    if (key !== 'token' || value === undefined) continue;
    const decoded = safeDecode(value);
    if (decoded !== null && TOKEN.test(decoded)) return decoded;
  }

  return null;
}

/** `decodeURIComponent` lève sur un `%` orphelin, ce qu'une URL bricolée porte souvent. */
function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
