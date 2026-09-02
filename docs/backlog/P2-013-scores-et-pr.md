# P2-013 — Saisie de score et records personnels

**Phase** P2 · **Estimation** 5 j·h · **Dépend de** P2-012 · **Spec** §2.2 (M14), §4-P5 (RM5.3, RM5.5), §7.3

## Objectif

Un membre enregistre son score après le cours, et l'app lui dit quand c'est un
record. C'est **la boucle d'engagement quotidienne** (M14) : ce qui fait ouvrir
l'app un jour où l'on ne réserve rien.

## Le choix qui structure le ticket : le PR suit la personne, pas la box

`personal_records` est indexée sur `user_id`, **pas** sur `membership_id`
(§7.2 : « le PR suit la personne, pas la box »). Une personne qui change de box
garde ses records ; c'est la même logique que `users`, global depuis P0-004.

Conséquence directe, et c'est une contrainte de confidentialité, pas de
modélisation : **une box ne doit pas voir les records qu'une personne a établis
ailleurs.** La table est globale, la lecture par un coach ne l'est pas. Le
prédicat de lecture staff se borne aux records dont le `source_score_id` pointe
une séance de **sa** box.

C'est la « règle des sœurs » de `.claude/rules/database.md` appliquée d'avance :
un chemin bien gardé (`scores`, tenant-scopé) et son jumeau qui ne l'est pas
(`personal_records`, global). Cinq trous sur cinq ont eu cette forme.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `scores`, `personal_records` | P2-009 | ❌ **à créer par P2-009** |
| Écran WOD du jour, point d'entrée de la saisie | P2-012 | ❌ **à créer par P2-012** |
| `movements.measured_by` (TIME / LOAD / REPS / DISTANCE) | P2-009 | ❌ **à créer par P2-009** — sans elle, on ne sait pas ce qu'est un « meilleur » score |
| Fenêtre de saisie configurable (défaut J+48 h, RM5.3) | `tenant_settings` (P1-001b) | ⚠️ **la table existe, la colonne non.** Une colonne à ajouter, dans l'écran de réglages existant |
| `users.gender`, `users.birthdate` (catégories du leaderboard) | P0-004 | ✅ existent, **facultatifs** (RM1.5) |
| `checkins`, pour ne proposer la saisie qu'aux présents | P1-008 | ❌ **à créer par P1-008.** Nuance, pas blocage : à défaut, on propose la saisie aux réservés |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `record_score()` — saisie transactionnelle + détection de PR | l'écran de saisie | celui-ci |
| `personal_records` alimentés | résolution des charges en % de 1RM | **P2-011** |
| `scores` avec leur `level` | le leaderboard | **P2-014** |
| `GET /v1/me/records` | l'écran « Mes records » | celui-ci |

## Périmètre

- Écran de saisie, adapté à l'unité du bloc : un temps (mm:ss), des reps, une
  charge, une distance. Pas un champ texte libre — un leaderboard sur du texte
  libre n'existe pas.
- `record_score()` en PLpgSQL : insertion du score **et** mise à jour du PR dans
  la **même transaction**, avec `unique(session_id, block_id, membership_id)`
  qui rend la double saisie impossible plutôt qu'improbable.
- **Détection du PR par (mouvement × type de mesure)** (RM5.5) : le sens de
  « meilleur » dépend de `measured_by` — le plus petit temps, la plus grosse
  charge, le plus grand nombre de reps. Une comparaison unique et fausse est le
  bug classique de cette fonctionnalité.
- Fenêtre de saisie (RM5.3) : jour du cours + 48 h par défaut, configurable par
  box. Au-delà, le score est saisissable mais **marqué hors délai** et exclu du
  leaderboard — refuser sèchement fait perdre la donnée pour rien.
- `level` obligatoire sur le score, hérité du variant choisi (prépare RM5.4).
- Validation par un coach (`verified_by`) : facultative, et **jamais bloquante**.
  Un score non vérifié compte ; il est simplement signalé comme tel.
- Écran « Mes records » : par mouvement, avec la date et un lien vers la séance
  qui l'a produit.

## Hors périmètre

- Le leaderboard (P2-014).
- Les benchmarks nommés et leur historique (S3, P3).
- Les notes de coach (S4, P3).
- Les commentaires sur les scores : autorisés par §2.5 mais non demandés. Un
  ticket le jour où une box le réclame.
- Les données de santé : **rien ici n'en approche**, et rien ne doit s'en
  approcher (règle 11 de `CLAUDE.md`). Une « note de blessure » sur un score
  serait une donnée de santé dans une table lue par un leaderboard.

## Critères d'acceptation

- [ ] Un membre saisit un temps, une charge, des reps ; l'unité vient du bloc
- [ ] Un PR est détecté dans le bon sens pour chacun des quatre `measured_by` —
      quatre tests pgTAP, pas un
- [ ] Une seconde saisie sur le même bloc **modifie** le score, n'en crée pas un
      second
- [ ] Un score hors fenêtre est accepté, marqué, et **absent du leaderboard**
- [ ] Un coach de la box A ne voit **aucun** record établi par la même personne
      dans la box B — test pgTAP explicite, c'est le trou par lequel ce ticket
      peut fuir
- [ ] Un membre voit tous ses propres records, toutes boxes confondues
- [ ] `rls_leak_test.sql` reste vert avec `personal_records` en table globale
      déclarée

## Notes

`rls-auditor` obligatoire : ce ticket ajoute la **troisième** table globale du
schéma (`users`, `movements`, `personal_records`), et c'est la première dont la
lecture doit être filtrée sans que `tenant_id` puisse le faire.
