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
- **Cas nommé — l'écran Équipe** (relevé en test le 18 sept. 2026, captures) : la
  ligne membre empile **deux concepts** (le rôle ET l'accès) et **deux boutons
  rouges** aux libellés proches — « Retirer » = *exclure de la box*, « Retirer
  l'accès » = *retirer l'abonnement*. À reprendre : séparer le rôle (rare →
  discret, auto-appliqué sans bouton « Appliquer ») de l'accès (fréquent → durée
  + un seul bouton « Donner l'accès » qui devient « Prolonger » si un accès est
  actif) ; mettre les actions destructives derrière un menu « … » avec
  confirmation ; libellés distincts (« Exclure de la box » ≠ « Retirer l'accès »),
  jamais deux « Retirer ».

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

**Retour de test du 18 septembre 2026.** L'écran Équipe (staff) est le premier
jugé « brouillon, trop de boutons » par la commanditaire — c'est le cas d'usage
concret qui guide cette passe (détaillé dans Périmètre). Vérifié à cette
occasion : **aucun** de ces boutons n'envoie d'e-mail ni de notification ;
prévenir le membre à l'attribution ou au retrait de son accès reste hors
périmètre (motif laissé ouvert par `P2-018`), à rouvrir si l'usage le demande.
