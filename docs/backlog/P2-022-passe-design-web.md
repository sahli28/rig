# `P2-022` — Passe design web (back-office)

**Phase** `P2` · **Estimation** `3` j·h · **Dépend de** `P2-021` (direction visuelle partagée) · **Spec** §12, §6.2 · **Origine** demande commanditaire, 16 septembre 2026 (réf. visuelle : Hustle Up)

## Objectif

Le back-office (planning, membres, programmation) devient lisible et rapide à
piloter au clavier, sur la même direction visuelle que le mobile.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Base de composants web accessible (shadcn/Radix, §12.2) | `apps/web` | ⚠️ **à confirmer dans le dépôt** ; la passe s'appuie dessus, elle ne recode pas l'accessibilité des menus/dialogues |
| La direction visuelle | `P2-021` étape 0 | ✅ décidée là, réutilisée ici |
| Les écrans back-office | planning, membres, réglages, program builder | ✅ existent (P1 + `P2-010`) |

## Périmètre

- Reprise visuelle des écrans back-office clés, **clavier d'abord** (§12.4 :
  navigation clavier complète, `aria-live` sur les compteurs de places).
- Cohérence avec la direction mobile (mêmes tokens, même langage).

## Hors périmètre

- Le program builder dans le détail → il a son ticket (`P2-010`) ; la passe
  l'habille, ne le construit pas.
- Le mobile → `P2-021`.

## Critères d'acceptation

- [ ] Les écrans back-office clés suivent la direction visuelle et §12.4 (clavier,
      contraste, focus)
- [ ] Rendu web vérifié dans un navigateur (Playwright ou manuel)

## Notes

Après `P2-021` : la direction se décide une fois, pour les deux surfaces.
