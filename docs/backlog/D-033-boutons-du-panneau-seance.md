# `D-033` — Les boutons du panneau de séance, relus

**Phase** `dette` · **Estimation** `0,25` j·h · **Dépend de** `P1-025`/`P1-027` (le panneau bouge déjà) · **Spec** §12.1 · **Origine** usage réel du pilote, 14 septembre 2026 — priorité 3, cosmétique

## Objectif

Les actions du panneau de l'occurrence — Enregistrer / Annuler ce cours /
Fermer — se lisent d'un coup d'œil : une action primaire, la destruction
derrière un trait, la sortie à sa place.

## Le cadre déjà posé, à appliquer plutôt qu'à réinventer

`D-021` a tranché la hiérarchie de ce panneau : « la séance d'abord,
l'annulation derrière un trait et un bouton danger, un seul primaire »
(§12.1 : « si vous hésitez entre deux actions primaires, l'écran a un
problème »). Le lot `P1-025`/`P1-027` ajoute un champ et une liste au même
panneau : cette passe cosmétique se joue **après eux**, sinon elle se refait.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Le panneau et ses styles | `planning/workout-form.tsx`, `planning.module.css` | ✅ existent |
| Les tokens (espacement, danger) | variables `--rack-*` | ✅ — aucune valeur littérale |

## Périmètre

- Disposition : primaire seul à droite, « Fermer » en lien discret, « Annuler
  ce cours » isolé sous un séparateur — l'ordre de l'arbre d'accessibilité
  suit l'ordre visuel (contrôle 6bis de `/check`).

## Hors périmètre

- Tout changement de comportement des actions.

## Critères d'acceptation

- [ ] Une seule action primaire visible ; capture avant/après dans la PR
- [ ] `read_page filter=interactive` : l'ordre de tabulation suit la lecture,
      chaque bouton s'annonce par ce qu'il fait
