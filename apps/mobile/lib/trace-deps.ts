/**
 * === SONDE `D-018`, TEMPORAIRE — à retirer avec le correctif ===
 *
 * Nommer ce qui a changé entre deux rendus, plutôt que de le déduire.
 *
 * La mesure précédente a coûté deux tours parce qu'elle laissait deux
 * inférences à faire : « l'effet s'est rejoué **donc** une dépendance a
 * changé » (laquelle ?) et « la page a semblé se recharger **donc** le squelette
 * a été posé » (personne ne pouvait le confirmer après coup). Un journal qui
 * demande à un humain de compléter ce qu'il a vu à l'écran n'est pas une mesure.
 *
 * Aucun import de plateforme : ce fichier n'est que du comparatif.
 */

/**
 * Les clés dont la valeur n'est plus identique — `Object.is`, donc l'identité
 * pour les objets et l'égalité pour les primitives, ce qui est exactement ce que
 * React compare pour décider de rejouer un effet.
 */
export function depsChangees(
  precedentes: Record<string, unknown> | null,
  courantes: Record<string, unknown>,
): string[] {
  if (precedentes === null) return ['(premier rendu)'];
  return Object.keys(courantes).filter((cle) => !Object.is(precedentes[cle], courantes[cle]));
}
