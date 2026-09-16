# `P2-021` — Passe design mobile (et direction visuelle)

**Phase** `P2` · **Estimation** `4` j·h · **Dépend de** `P1-001e` (thème), la galerie de composants · **Spec** §12 · **Origine** demande commanditaire, 14–16 septembre 2026 (réf. visuelle : Hustle Up)

## Objectif

Les écrans membres passent d'« ça marche » à « on a envie de l'ouvrir » —
accueil, planning, WOD, carte membre — sur une direction visuelle assumée,
inspirée de ce qui rend Hustle Up agréable, sans le copier.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Kit de 22 composants + galerie | `apps/mobile/components` | ✅ existe — la passe retouche l'assemblage et les tokens, pas les primitives |
| Tokens de thème (couleurs, espaces, rayons, typo) | P1-001e | ✅ existe, correction de contraste comprise |
| Les écrans à reprendre | accueil, planning, WOD, carte membre | ✅ existent (P1) |
| Une direction visuelle décidée | — | ❌ **première étape de ce ticket** : trancher la direction (typo, densité, thème sombre par défaut §12.1, accents) **avant** de toucher un écran. C'est aussi le « autre thème » demandé le 16 sept. — décidé ici, partagé avec `P2-022` |

## Périmètre

- Étape 0 : direction visuelle (1–2 planches), validée avant tout code, partagée
  avec la passe web (`P2-022`).
- Reprise des quatre écrans membres : hiérarchie, respiration, lisibilité à bout
  de bras (§12.1), états vides parlants (§12.1, principe 7).
- Aucune couleur en dur ; tout par tokens (la passe est aussi un filet pour la
  règle des tokens).

## Hors périmètre

- De nouveaux composants → si un écran en réclame un, c'est un ticket à part
  (« ce qui déborde devient un ticket »).
- Le back-office → `P2-022`.
- Le nom / l'icône du binaire → hors MVP (N2).

## Critères d'acceptation

- [ ] La direction visuelle est validée **avant** la première retouche d'écran
- [ ] Les quatre écrans respectent §12 (pouce, contraste, 16 px mini, état vide
      parlant)
- [~] Rendu sur iPhone (la seule preuve qui compte pour du design) — passe appareil

## Notes

« Amélioration design » n'est pas mesurable en soi ; ce ticket la rend mesurable
en nommant quatre écrans et une direction. D'autres écrans s'ajoutent en puces ou
en second ticket, pas en cours de route.
