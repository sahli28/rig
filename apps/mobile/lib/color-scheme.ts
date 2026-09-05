import type { ColorScheme } from '@rack/ui/theme';

/**
 * Ce qu'on fait quand le système ne répond pas sur le mode clair/sombre.
 *
 * **Aucun import de `react-native` ici, volontairement.** C'est ce qui rend ce
 * fichier testable sous Vitest — la règle du dépôt : la logique ne vit jamais
 * dans un module qui importe React Native, dont Vitest ne sait pas parser les
 * sources Flow. Le hook qui l'utilise est dans `app/_layout.tsx`, à trois
 * lignes, et n'a rien à décider.
 *
 * ---
 *
 * **`useColorScheme()` peut rendre `null`, et le traiter comme « clair » fait
 * clignoter toute l'application en mode sombre.**
 *
 * **Et le typage de React Native ne le dit pas** — c'est ce qui rend le défaut
 * invisible. `useColorScheme(): ColorSchemeName` est déclarée non-nullable dans
 * `Appearance.d.ts`, alors que l'implémentation retourne `getColorScheme()`,
 * elle-même typée `ColorSchemeName | null | undefined` dans le même fichier.
 * `useColorScheme() === 'dark' ? 'dark' : 'light'` avait donc l'air exhaustif
 * pour `tsc`, et ne l'était pas à l'exécution.
 *
 * `Appearance.getColorScheme()` rend `null` dans deux cas
 * (`react-native/Libraries/Utilities/Appearance.js`) : quand le module natif est
 * absent, et quand le dernier événement `appearanceChanged` a porté un
 * `colorScheme` nul. iOS en émet pendant les transitions d'écran et quand le
 * système prend une capture de l'app.
 *
 * **Troisième valeur, et deuxième erreur de la même ligne : `'unspecified'`.**
 * Elle veut dire « suis le système », donc *sombre* quand le système est sombre.
 * L'ancienne écriture l'envoyait aussi sur `'light'`.
 *
 * Le thème entier basculait donc en clair le temps d'une image, puis revenait :
 * un flash blanc sur un en-tête sombre.
 *
 * **Et ça ne se voit qu'en sombre**, par construction : en mode clair la valeur
 * de repli est déjà celle qu'on affiche, donc le même défaut ne produit rien.
 * C'est exactement le symptôme rapporté — le bouton retour qui clignote au
 * passage sur le planning, en sombre seulement.
 *
 * La réponse n'est pas de deviner : **`null` ne veut pas dire « clair », il veut
 * dire « je ne sais pas »**, et à cette question-là la bonne réponse est ce
 * qu'on affichait déjà.
 */
/**
 * Tout ce que `useColorScheme()` peut réellement rendre.
 *
 * Écrit ici plutôt qu'importé de `react-native` : ce module doit rester sans
 * dépendance de plateforme pour être testable, et le type de React Native est
 * de toute façon **plus étroit que la réalité** — il ignore le `null`.
 */
export type SchemeSignal = 'light' | 'dark' | 'unspecified' | null | undefined;

export function nextScheme(previous: ColorScheme, signal: SchemeSignal): ColorScheme {
  if (signal === 'dark') return 'dark';
  if (signal === 'light') return 'light';
  // `'unspecified'`, `null`, `undefined` : on garde ce qu'on avait. Une absence
  // de réponse n'est pas une réponse, et « suis le système » n'est pas « clair ».
  return previous;
}

/**
 * Le mode à afficher avant d'avoir vu la moindre valeur.
 *
 * `'light'` est le défaut de la plateforme, et ce cas-là ne clignote pas : il
 * n'y a pas encore d'écran affiché à contredire.
 */
export const INITIAL_SCHEME: ColorScheme = 'light';
