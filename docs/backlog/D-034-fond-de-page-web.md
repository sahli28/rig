# `D-034` — Un fond visuel pour les pages web, branché sur le thème

**Phase** `dette` · **Estimation** `0,25` j·h · **Dépend de** *l'asset, fourni par la commanditaire* · **Spec** §12 · **Origine** note du 14 septembre 2026 — **s'ouvre quand l'asset arrive**, non programmé (hors ①)

## Objectif

Les pages web portent un visuel de fond fourni séparément, servi par le
système de thème — pas une image codée en dur.

## La contrainte posée d'avance (pour ne pas la découvrir à l'asset)

- **Aucune image générée par nous** : l'asset vient de la commanditaire,
  c'est écrit dans la demande.
- **Le slot passe par le thème**, comme toute décision visuelle (règle 7 de
  CLAUDE.md, white-label) : une variable `--rack-*` posée par
  `themeToCssRule()` / `<ThemeStyle/>`, pas un `background: url(…)` dans un
  module CSS — sinon la promesse white-label se casse, un fond à la fois.
- Contraste : le texte au-dessus du fond reste ≥ 4,5:1 (WCAG 2.2 AA) — à
  vérifier avec le vrai asset, clair **et** sombre.

## Critères d'acceptation

- [ ] Le fond s'affiche sur les pages publiques/de connexion sans toucher un
      composant — seulement le thème
- [ ] Les deux schémas (clair/sombre) restent lisibles, mesuré au harnais

## Déclencheur

La livraison de l'asset. Rien à faire avant.
