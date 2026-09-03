# P0-002 — Design tokens et thème du tenant

**Phase** P0 · **Estimation** 4 j·h · **Dépend de** P0-001 · **Spec** §12.2, §11.2

## Objectif

Rendre le white-label possible dès le premier écran. C'est une décision
irréversible : une couleur en dur écrite maintenant coûtera des semaines plus tard.

## Périmètre

- Objet thème : `app_name`, `logo_url`, `primary`, `on_primary`, `surface`,
  `surface_2`, `text`, `text_muted`, `success`, `warning`, `danger`, `radius`, `font`.
- `ThemeProvider` + `useTheme()` partagés mobile et web, thème clair et sombre.
- Kit de composants minimal dans `packages/ui` : Button, IconButton, Card, ListRow,
  Avatar, Badge, Tabs, SegmentedControl, Sheet, Toast, Banner, Input, Select,
  Switch, EmptyState, Skeleton.
- Validation de contraste : une fonction qui, à partir d'une couleur primaire
  choisie par une box, vérifie le ratio ≥ 4,5:1 et propose une correction.
- Écran de démonstration listant tous les composants dans les deux thèmes.

## Hors périmètre

Écrans produit, chargement du thème depuis la base (arrive en P0-005).

## Critères d'acceptation

- [x] Aucune couleur littérale hors du fichier de thème (vérifiable par grep)
      — grep sur `apps/**` et `packages/**` : seules occurrences dans
      `theme/tokens.ts`, `theme/build-theme.ts` et l'écran de démonstration
      (presets de marque). Plus l'exception `app.json` héritée de P0-001.
- [x] Changer la couleur primaire dans un seul objet change toute l'app
      — `buildTheme(brand, scheme)` dérive tout de `TenantBrand` ; testé, et
      manipulable en direct sur l'écran de démonstration.
- [x] Les 16 composants s'affichent correctement en clair et en sombre
      — passe sur appareil du **3 septembre 2026** — iPhone 12 Pro Max, Expo Go,
      Expo SDK 57, base locale servie sur le réseau, sur le rapport de la
      développeuse. Le point le plus probant n'est pas le rendu mais sa
      **source** : l'écran affiche « CF Rueil », donc `themes.app_name` lu en
      base avec le jeton du membre. Le white-label atteint le mobile, ce qui
      était toute la promesse de P0-002.
- [x] Une couleur primaire à contraste insuffisant est détectée et corrigée automatiquement
      — `ensureContrast` ; 12 tests, dont un échantillon hostile (jaune fluo,
      blanc, noir, pastel, fuchsia, gris moyen) sur les deux schémas.
- [x] Toutes les cibles tactiles font au moins 44 pt / 48 dp
      — `minTouchTarget` = 48 sur tous les composants interactifs, vérifié par
      audit. Deux écarts trouvés et corrigés pendant le ticket : `SegmentedControl`
      (40 pt) et `Card` actionnable (hauteur laissée au contenu).
- [x] Le texte dynamique à 200 % ne casse aucun composant
      — passe sur appareil du **3 septembre 2026** — iPhone 12 Pro Max, Expo Go,
      Expo SDK 57, base locale servie sur le réseau, sur le rapport de la
      développeuse. Le kit était écrit pour tenir — aucune hauteur fixe, aucun
      `numberOfLines`, aucune police non scalable — et l'appareil l'a confirmé.

## Notes

Un composant qui ne peut pas être thémé est un composant mal conçu : le refaire
plutôt que de contourner.

### Écart avec le ticket, assumé

Le ticket demandait un kit « partagé mobile et web ». La spec §12.2 dit l'inverse
pour le web (« ne recodez jamais un `<Select>` accessible » — s'appuyer sur Radix
ou shadcn). J'ai suivi la spec : le **thème** est partagé et sans dépendance
plateforme, le **kit de composants** est React Native. Le web consomme les mêmes
tokens via les variables CSS de `themeToCssRule`, ce qui préserve la promesse
white-label sans imposer `react-native-web` à Next.

### Dette laissée par ce ticket

- Toutes les chaînes visibles sont en dur (galerie, écrans d'accueil, page web).
  L'i18n arrive au ticket suivant, P0-003 : c'est l'ordre du backlog qui l'impose.
- Le `Switch` s'appuie sur le contrôle natif de la plateforme, dont la hauteur
  propre (~31 pt sur iOS) est inférieure au plancher. La ligne entière fait 48 pt.
  Convention de plateforme, laissée telle quelle.
- Le rendu visuel et le comportement à 200 % de taille de texte restent à
  observer sur appareil ou émulateur.
