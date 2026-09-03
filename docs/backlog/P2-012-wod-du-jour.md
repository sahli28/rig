# P2-012 — Le WOD du jour, côté membre

**Phase** P2 · **Estimation** 3 j·h · **Dépend de** P2-010, P1-007 · **Spec** §4-P5 (étapes 7 et 8, RM5.2), §6.1

## Objectif

Un membre ouvre l'app et voit la séance du jour, dans son niveau, avec ses
charges. Une notification l'a prévenu à la publication.

C'est le petit ticket de la famille, et c'est celui qui rend les trois autres
visibles. Sans lui, la programmation est un back-office que personne ne lit.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| Séances publiées, `publish_session()` | P2-009, P2-010 | ❌ **à créer par P2-009 / P2-010** |
| `resolve_block_for_member()` | P2-011 | ❌ **à créer par P2-011**. Sans elle, ce ticket affiche « 75 % 1RM » brut — dégradation acceptable, à dire au plan |
| Notifications push, catégorie « WOD publié » | P1-007 | ❌ **à créer par P1-007** — la catégorie est **déjà nommée dans son périmètre**, marquée « (P2) ». C'est ce ticket-ci |
| **L'app mobile ayant tourné au moins une fois** | `apps/mobile` | ✅ passe faite le 3 septembre 2026 (`docs/passe-mobile-iphone.md`). Le chiffrage à 3 j·h ne repose plus sur une supposition |
| Deep link vers un écran depuis une notification | P1-007 | ❌ **à créer par P1-007** (critère d'acceptation existant) |
| Planificateur pour les publications futures | P2-010 | ❌ **à créer par P2-010** — job `pg_cron` |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| L'écran « WOD du jour » | le membre | celui-ci |
| Le point d'entrée de la saisie de score | le bouton « enregistrer mon score » | **P2-013** |

## Périmètre

- Écran mobile « WOD du jour » : blocs dans l'ordre, format, time cap, mouvements
  avec charges résolues, sélecteur de niveau.
- Séance rattachée à un cours réservé : accessible aussi depuis le détail du
  cours (`GET /v1/classes/{id}` rend déjà « WOD publié » dans la spec §7.5).
- **Rien avant `published_at`** (RM5.2). Le filtre est en base, dans la policy,
  pas dans la requête du client : une séance non publiée ne doit pas pouvoir être
  demandée, même par quelqu'un qui connaît son identifiant.
- Notification à la publication, aux membres **inscrits au cours** — pas à toute
  la box. Une notification à 200 personnes pour un cours de 16 est du bruit, et
  le plafond de P1-007 existe pour ça.
- Historique : les séances des sept derniers jours, pour qui a manqué un cours.

## Hors périmètre

- Saisie de score (P2-013) et leaderboard (P2-014) : le bouton existe, il mène à
  P2-013.
- Écran TV de salle (C8, v2).
- Commentaires sur les séances (§2.5 les autorise sur les scores uniquement).

## Critères d'acceptation

- [ ] Une séance publiée apparaît chez les membres inscrits, dans leur langue
- [ ] Une séance dont `published_at` est future est **inaccessible**, y compris
      en demandant son identifiant directement — test pgTAP, pas seulement
      d'interface
- [ ] La notification arrive et ouvre l'écran de la séance, pas l'accueil
- [ ] Changer de niveau change les charges affichées sans recharger
- [ ] Un membre sans PR sur le mouvement de référence voit le pourcentage nommé
      et un chemin pour renseigner son record

## Notes

**Ce ticket paie la dette mobile de P0-005a ou il la subit.** Quatre écrans
mobiles n'ont jamais exécuté une ligne. En ajouter un cinquième sans avoir fait
la passe Expo, c'est empiler du non-vérifié. La passe est un préalable, pas une
formalité.
