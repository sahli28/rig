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

- [ ] Aucune couleur littérale hors du fichier de thème (vérifiable par grep)
- [ ] Changer la couleur primaire dans un seul objet change toute l'app
- [ ] Les 16 composants s'affichent correctement en clair et en sombre
- [ ] Une couleur primaire à contraste insuffisant est détectée et corrigée automatiquement
- [ ] Toutes les cibles tactiles font au moins 44 pt / 48 dp
- [ ] Le texte dynamique à 200 % ne casse aucun composant

## Notes

Un composant qui ne peut pas être thémé est un composant mal conçu : le refaire
plutôt que de contourner.
