/**
 * Helper pur, volontairement séparé de `avatar.tsx` : importer un composant
 * React Native dans un test le fait échouer (Vitest ne parse pas les sources
 * Flow de RN). La logique testable vit donc hors des composants.
 */

/** « Léa Martin » → « LM ». Deux lettres au maximum. */
export function initialsOf(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase())
    .join('');
}
