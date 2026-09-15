/**
 * La politique de confidentialité : sa version, et où la lire (D-023).
 *
 * Trois choses doivent dire la même date — le texte publié sur le web, la
 * constante SQL `current_policy_version()` qui conditionne l'accès dans
 * `me()`, et la version enregistrée avec chaque consentement. La date vit ici,
 * la page web l'affiche, et `privacy-policy.test.ts` la confronte à la
 * dernière définition SQL : changer l'une sans l'autre est un rouge, pas une
 * dérive silencieuse.
 */

/**
 * La date du texte publié — le jour où la commanditaire l'a validé.
 *
 * Même format que `current_policy_version()` : c'est la valeur que `me()`
 * compare et que `consents.policy_version` enregistre. Le jour où le texte
 * change (relecture juriste comprise, si elle modifie le fond), cette date
 * change, la migration suit, et tous les consentements antérieurs redeviennent
 * à recueillir — c'est le comportement voulu, voir la note de séquence de
 * `docs/backlog/D-023-le-consentement-pointe-vers-un-texte.md`.
 */
export const POLICY_VERSION = '2026-09-15';

/**
 * Le segment de chemin de la page publique.
 *
 * Même limite que `INVITATION_PATH_SEGMENT` : côté web le chemin est porté par
 * un **nom de dossier** (`apps/web/app/politique-de-confidentialite/`),
 * qu'aucune constante ne peut peupler. D'où le test de parité qui relit
 * l'arborescence au lieu de faire confiance à la convention.
 */
export const PRIVACY_POLICY_PATH_SEGMENT = 'politique-de-confidentialite';

/**
 * L'origine web publique déployée.
 *
 * C'est l'adresse que le mobile ouvre (il n'a pas de chemin relatif possible :
 * `Linking.openURL` veut une URL absolue). Elle change avec le déploiement —
 * le jour où `rack-app.fr` sert le web, c'est cette ligne qui bouge, et le
 * build mobile suivant l'emporte. Une seule occurrence dans le dépôt.
 */
export const PUBLIC_WEB_ORIGIN = 'https://rack-web-eight.vercel.app';

/** L'URL absolue de la politique, celle que l'écran de consentement ouvre. */
export function privacyPolicyUrl(): string {
  return `${PUBLIC_WEB_ORIGIN}/${PRIVACY_POLICY_PATH_SEGMENT}`;
}
