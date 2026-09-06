# `P1-005b` — Le même canal, dans la grille du back-office

**Phase** `P1` · **Estimation** `1` j·h · **Dépend de** `P1-005a` · **Spec** §7.4, §10 · **Non programmé** — voir ci-dessous

*Découpé de `P1-005` le 6 septembre 2026, en même temps que `P1-005a`.*

## Objectif

Le manager qui garde sa grille de semaine ouverte voit les compteurs bouger sans
rafraîchir.

## Pourquoi il est écrit et pas programmé

Même statut que `P1-013` : **écrit, chiffré, hors du total ①**.

Au pilote, la valeur du temps réel est sur le téléphone du membre — là où deux
personnes se disputent la dernière place, et où celle qui perd l'apprend en
appuyant sur un bouton. **Le manager qui regarde sa grille peut rafraîchir.** La
grille du back-office est un outil de préparation, consultée par une personne à
la fois, sans concurrence sur une ressource rare.

Il sort **en une session** si la box pilote le réclame : `P1-005a` aura livré la
migration de publication et le module d'abonnement, il ne resterait que le
branchement. Ce jour-là, la décision prendra une minute — c'est tout ce qu'on
demande à un ticket non programmé.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `public.classes` dans la publication `supabase_realtime` | migration de `P1-005a` | ❌ **`P1-005a`** |
| Le module d'abonnement | `packages/core/src/supabase/` — livré par `P1-005a` | ❌ **`P1-005a`** |
| Client Supabase navigateur | `apps/web/lib/supabase/client.ts:19` (`createBrowserClient`) | ✅ existe |
| L'écran qui affiche les places | `apps/web/app/box/[slug]/planning/week-grid.tsx:113` (`t('planning.places')`) | ✅ existe |
| Clés i18n des trois états du canal | `packages/core/src/i18n/locales/{fr,en}.json` — livrées par `P1-005a` | ❌ **`P1-005a`** |
| Une suite de tests dans `apps/web` | *aucune* | ❌ **rien ne la crée aujourd'hui.** Ce ticket se vérifie donc à la main, et il faut le savoir avant de le lancer, pas après |

## Périmètre

- Brancher le module d'abonnement de `P1-005a` sur la grille de semaine, depuis
  un composant client — la page est rendue côté serveur, l'abonnement ne peut
  pas y vivre.
- Le même indicateur d'état de canal que le mobile, en CSS Modules et variables
  `--rack-*` (`.claude/rules/ui.md`) — pas un second système.
- Désabonnement au démontage et au changement de semaine.

## Hors périmètre

- Toute modification du module partagé. S'il faut le changer pour le brancher
  ici, c'est que `P1-005a` l'a mal découpé, et ça se corrige là-bas.
- Le reste du back-office. Une seule grille, un seul canal.

## Critères d'acceptation

- [ ] Une réservation faite depuis le mobile fait bouger le compteur de la grille
      en moins de 3 secondes, sans rafraîchir la page
- [ ] Changer de semaine ferme le canal de la précédente
- [ ] Quitter la page ne laisse aucun canal ouvert
- [ ] Le manager d'une box ne reçoit rien d'une autre box
- [ ] L'indicateur d'état n'introduit **aucune** couleur littérale
      (`.claude/rules/ui.md`)

## Notes

Si ce ticket est un jour lancé, la première question à se poser est celle que
`P1-005a` a déjà tranchée pour le mobile : **ce qu'on montre est l'état du
canal, pas l'âge de la donnée.** Un « il y a 12 s » dans une grille de semaine
serait encore pire que sur un téléphone — sept colonnes de compteurs qui se
re-rendent chaque seconde.
