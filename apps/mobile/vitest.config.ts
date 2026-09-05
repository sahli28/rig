import { defineConfig } from 'vitest/config';

/**
 * La première suite de tests de `apps/mobile`.
 *
 * **Volontairement bornée aux `.ts`.** Monter un composant React Native sous
 * Vitest demanderait de transformer les sources **Flow** de `react-native`
 * (`CLAUDE.md`, conventions) ou de tout aliaser vers `react-native-web` — et
 * cet alias n'apporterait pas le geste qui nous intéresse : le SDK web n'émet
 * jamais `onMomentumScrollEnd`, seul `onScroll` y est câblé.
 *
 * Ce que cette borne coûte et ce qu'elle achète est chiffré dans
 * `docs/backlog/P1-011-selecteur-de-date-planning.md`, section « Ce que
 * `apps/mobile` gagne ». Ici, la règle tient en une phrase : **la logique se
 * teste, le rendu se regarde.**
 */
export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.expo/**', '**/dist/**'],
  },
});
