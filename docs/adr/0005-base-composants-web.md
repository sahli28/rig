# ADR 0005 — Radix Primitives et CSS Modules pour le web

**Date** 2026-09-01 · **Statut** accepté · **Ticket** P1-001a

## Contexte

L'ADR 0003 renvoyait le choix à plus tard : le web « s'appuiera sur une base
accessible existante (Radix, shadcn) pour ses composants complexes ». Il n'a
jamais été fait, et `apps/web` n'a aucune bibliothèque d'interface.

P1-001a construit le premier écran web réel — la porte du back-office. La
décision se prend maintenant, ou se subit au milieu d'un ticket, sous la pression
d'un `<Select>` accessible à livrer.

La contrainte qui tranche est celle de l'ADR 0003 : **`@rig/ui/theme` est la
seule source de vérité des couleurs**, injectée en variables CSS par
`themeToCssRule()`. C'est ce qui fait tenir la promesse white-label — changer la
couleur d'une box dans un seul objet repeint toute l'app, correction de contraste
comprise.

## Décision

**Radix Primitives** pour le comportement, **CSS Modules** pour la mise en forme.

Radix ne porte aucun style : il porte l'accessibilité — piégeage du focus,
échappement, navigation au clavier, `aria-*`, gestion du portail. C'est
exactement ce que la spec §12.2 dit de ne jamais recoder en solo, et rien de plus.

Les styles vivent dans des fichiers `.module.css` à côté de leur composant, et
**toute** valeur de couleur, de rayon, de typographie ou de cible tactile vient
d'une variable `--rig-*`. Aucune valeur littérale, aucune seconde convention.

Les paquets Radix s'installent **un par un, à l'usage**, chacun justifié dans son
commit. La coquille en a demandé un seul, `@radix-ui/react-dropdown-menu`.

## Alternative écartée

**shadcn/ui.** Tentant — des composants déjà stylés, sur Radix, en code copié
donc modifiable. Écarté pour une seule raison, mais décisive : il apporte
**Tailwind**, et donc un second système de thème en parallèle de
`@rig/ui/theme`. Deux endroits où une couleur peut être définie, c'est la
promesse white-label qui se casse — et elle se casserait silencieusement, un
`bg-slate-100` à la fois.

Le rattrapage existe : alimenter les variables de shadcn depuis
`themeToCssRule()`. Mais on paierait alors Tailwind, sa configuration, sa purge
et sa convention, pour un back-office dont les écrans se ressemblent peu et se
comptent sur les doigts. Le compromis ne penche pas de ce côté à une personne.

Si la décision se rouvre un jour, c'est ce raccordement qui la conditionne :
**les variables de shadcn alimentées par `themeToCssRule()`, jamais redéfinies.**

## Conséquences

- Chaque composant complexe demande un paquet Radix et son fichier CSS. Plus
  verbeux que shadcn, plus lisible qu'un composant maison.
- Pas de classes utilitaires : la mise en forme se lit dans un fichier CSS
  nommé, pas dans l'attribut `class` du JSX.
- `.claude/rules/ui.md` porte la convention ; `pnpm lint` et la relecture
  attrapent les valeurs littérales, faute d'outil qui le fasse pour nous.
- Le kit React Native de `packages/ui` reste réservé au mobile (ADR 0003) : rien
  ne change de ce côté.
