# D-007 — Le rapport de contraste de la page de démo suit le schéma réel

**Phase** dette · **Estimation** 0,25 j·h · **Origine** relecture visuelle, P0-002

## Pourquoi

`apps/web/app/design-system/page.tsx` calcule
`buildTheme(DEFAULT_BRAND, 'light').contrast` — **le schéma clair est figé**.
Sur un navigateur en thème sombre, la page rend en sombre mais affiche le rapport
du thème clair : « couleur demandée #E4572E (3.68:1) — corrigée en #d3451b ».

Les ratios annoncés ne correspondent donc pas aux couleurs à l'écran. Sur une
page dont le seul objet est de démontrer la correction de contraste, c'est
gênant : elle ment sur ce qu'elle démontre.

## Périmètre

Résoudre le schéma effectif côté client (`matchMedia('(prefers-color-scheme: dark)')`)
et calculer le rapport sur celui-ci. Ou afficher les deux, ce qui a l'intérêt de
montrer que la correction diffère selon le fond.

## Critères d'acceptation

- [ ] Les ratios affichés correspondent aux couleurs effectivement rendues
- [ ] Le basculement du thème système met le rapport à jour
