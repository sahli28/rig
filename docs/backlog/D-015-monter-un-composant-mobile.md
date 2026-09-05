# `D-015` — Monter un composant mobile dans un test

**Phase** `dette` · **Estimation** `1,5` j·h · **Origine** P1-011, 5 septembre 2026 · **À arbitrer**

## Le problème, énoncé une fois

`apps/mobile` a maintenant une suite de tests — mais elle ne sait tester que ce
qui n'importe pas React Native. **Rien ne monte un composant.**

Ce n'est pas une préférence d'architecture, c'est une contrainte d'outillage
constatée : Vitest ne sait pas parser les sources **Flow** de React Native
(`CLAUDE.md`, conventions). D'où la borne posée en P1-011 — « la logique se
teste, le rendu se regarde » — qui a suffi pour le défaut du jour, en extrayant
les transitions dans un module pur.

Elle ne suffira pas toujours. Ce qu'elle laisse dehors :

- **un rendu conditionnel** : « le bouton n'apparaît pas hors ligne », « la
  feuille d'inscrits ne s'affiche que si l'on est inscrit ». Aujourd'hui vérifié
  à l'œil, au harnais, une fois ;
- **un libellé accessible** : il se lit dans l'arbre du harnais, à la main, et
  seulement pour l'écran qu'on regarde ce jour-là ;
- **un geste** : balayage, appui long, glissé. C'est le trou qui a coûté un
  défaut livré.

## Les deux options, et pourquoi la moins chère ne suffit pas

| Option | Ce qu'elle permet | Coût | Risque |
| --- | --- | --- | --- |
| **A** — `@testing-library/react` + jsdom, avec `react-native` aliasé vers `react-native-web` (déjà une dépendance) | monter, lire le DOM rendu, cliquer, vérifier les libellés accessibles | ~0,75 j·h | faible |
| **B** — `@testing-library/react-native` + `react-test-renderer` | tout ce que fait A, **plus les gestes** : RNTL appelle la prop directement, donc `fireEvent(el, 'momentumScrollEnd', …)` fonctionne sans plateforme | ~1,5 j·h | **réel** — voir ci-dessous |

**A n'aurait pas attrapé le défaut de P1-011.** Vérifié dans les sources plutôt
que supposé : `react-native-web` ne câble que `onScroll` au défilement du DOM
(`react-native-web/dist/exports/ScrollView/ScrollViewBase.js`) ; `onMomentumScrollEnd`
existe sur le composant et **n'est jamais émis** sur le web. Un test qui monte
sous RNW ne peut donc pas balayer — dans aucune version du composant.

**Le risque de B**, à ne pas découvrir en cours de route :

1. **Flow.** Il faut une transformation qui dépouille les sources de React
   Native, ce que Vitest ne fait pas seul. C'est le nœud, et c'est ce que
   `CLAUDE.md` a déjà constaté ;
2. **`react-test-renderer` est déprécié sous React 19.** Il fonctionne encore ;
   il n'est pas un socle sur lequel on parie deux ans ;
3. **le moteur reste faux.** RNTL tourne sous Node, pas sous Hermes — même angle
   mort que `D-010`, dont ce ticket est le cousin. Il attrape des défauts de
   **logique de composant**, jamais des défauts de moteur.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| Une suite Vitest dans `apps/mobile` | `apps/mobile/vitest.config.ts` | ✅ existe depuis P1-011 — bornée aux `.ts` |
| `react-native-web` | `apps/mobile/package.json` | ✅ existe, pour le bundle web |
| Un composant qui vaille d'être monté | `components/week-strip.tsx`, `app/(app)/class/[id].tsx` | ✅ deux, et le second a des états conditionnels que personne ne teste |

## Le déclencheur, plutôt qu'une date

Ce ticket ne se lance pas « quand on aura le temps ». Il se lance au premier des
trois signaux :

1. **un second défaut de rendu ou de geste échappe à tout et se trouve sur
   appareil.** Le premier est P1-011 ; un deuxième ferait deux, et deux est une
   série ;
2. **un écran devient trop conditionnel pour se relire** — le détail d'un cours
   en est proche, avec ses huit états d'affordance ;
3. **la passe manuelle dépasse dix minutes** — c'est déjà le déclencheur de
   l'option B de `D-010`, et les deux tickets se paieraient alors ensemble.

## Critères d'acceptation

- [ ] Un composant monte dans un test, sans appareil et sans harnais
- [ ] Un **geste** se déclenche et le test échoue si le composant l'ignore.
      Contrôle négatif obligatoire : remettre le défaut de P1-011 doit rendre le
      test rouge
- [ ] Ce que le montage **ne prouve pas** est écrit dans le fichier de
      configuration, à côté de ce qu'il prouve — le moteur reste Node
- [ ] Le temps d'exécution de `pnpm test` reste sous la dizaine de secondes

## Notes

**Ce ticket existe parce qu'une réponse a été donnée trop vite.** « Ce défaut
était testable sans appareil » : vrai, mais pas de la façon qu'on croyait — le
montage sous le moteur le moins cher n'aurait rien vu. La différence entre les
deux options ne se devine pas, elle se lit dans le code de `react-native-web`.
C'est le genre de vérification qui coûte dix minutes avant, et une demi-journée
après.
