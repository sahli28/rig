# ADR 0003 — Un kit React Native, un web sur variables CSS

**Date** 2026-08-30 · **Statut** accepté · **Ticket** P0-002

## Contexte

Le ticket P0-002 demandait « un kit de composants partagé mobile et web » dans
`packages/ui`. La spécification §12.2 dit l'inverse pour le web : « Sur le web, une
base de composants existante (shadcn/ui, Radix) évite de recoder l'accessibilité
des menus, dialogues et combobox. En solo, ne recodez jamais un `<Select>`
accessible. » Les deux sources se contredisaient.

Les deux applications servent par ailleurs des rôles différents : `apps/mobile` est
l'app membre (réserver, logger un score), `apps/web` est le back-office (grille de
planning, listes de membres, finances). Leurs besoins d'interface se recoupent peu.

## Décision

- Le **thème** est partagé et sans dépendance plateforme : `@rack/ui/theme` —
  tokens, `buildTheme()`, correction de contraste, `ThemeProvider`. Importable
  aussi bien par Expo que par Next.
- Le **kit de composants** est React Native : `@rack/ui/native`, réservé à
  `apps/mobile`.
- Le **web** consomme les mêmes tokens via `themeToCssRule()`, injecté en variables
  CSS au rendu serveur, et s'appuiera sur une base accessible existante (Radix,
  shadcn) pour ses composants complexes.

## Alternative écartée

**`react-native-web`**, qui aurait permis un kit unique. Écarté : il faut aliaser
`react-native` vers `react-native-web` dans Next, transpiler les paquets RN, et
composer avec les frictions SSR de l'architecture React 19 / RN 0.86. Le tout pour
partager un `ListRow` entre une liste mobile et une grille de planning — deux
composants qui ne se ressemblent pas. Coût de mise au point et de maintenance
supérieur au bénéfice, pour une personne seule.

## Conséquences

- La promesse white-label tient : `@rack/ui/theme` reste la **seule** source de
  vérité des couleurs, quel que soit le support. Changer la couleur d'une box
  repeint les deux applications.
- Le web devra écrire ses propres composants. C'est un coût réel, accepté, et
  amoindri par l'usage d'une bibliothèque accessible existante.
- Un composant ne peut pas être « remonté » du mobile vers le web par simple
  import. Ce qui doit être partagé entre les deux est de la **logique**, et vit
  dans `packages/core`.
- `packages/ui` a deux points d'entrée qu'il ne faut pas confondre : importer
  `@rack/ui/native` depuis `apps/web` casserait le build.
