# `P1-026` — Un cours ponctuel, sans série d'un jour

**Phase** `P1` · **Estimation** `1,25` j·h · **Dépend de** `P1-025` (même panneau, mêmes gardes) · **Spec** §7 · **Origine** usage réel du pilote, 14 septembre 2026 — **priorité 1**

## Objectif

Le staff pose un cours **unique** — date + heure, type, salle, coach, places —
sans créer une série d'un jour qui encombre la liste des séries. Aujourd'hui
« Nouvelle série » est le seul chemin de création.

## La décision de modélisation (à valider avant le code — plan mode, base)

`classes.schedule_id` est **`NOT NULL`** (`20260902120000:160`). Deux montages
possibles, un seul propre :

- **Retenu : `schedule_id` devient nullable**, avec l'invariant en contrainte —
  `check (schedule_id is not null or is_override)` : une occurrence sans série
  est **par construction** dérogatoire, donc aucun refresh ne la balaie (ils
  filtrent `schedule_id = s.id`, un `null` n'y correspond jamais — double
  ceinture). Les lectures du produit n'exigent pas la série : la grille web et
  le planning mobile lisent `classes` seul ; `schedule_id` n'y sert qu'à
  regrouper.
- **Écarté : une série cachée par occurrence** — c'est exactement la pollution
  que l'usage reproche, déplacée sous le tapis, plus un état « série à une
  occurrence » que tous les écrans de série devraient apprendre à taire.

C'est le seul ticket du lot avec une **migration** : `rls-auditor` avant
commit, cas `rls_leak_test` inchangés (aucune policy ne bouge), et un test
pgTAP qui prouve les deux moitiés — l'occurrence ponctuelle survit à un
`refresh_class_schedule()` de toutes les séries, et l'invariant refuse
`schedule_id null` sans `is_override`.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| `is_override` respecté par les deux refresh | `20260902120000:351`, `20260908210000:218` | ✅ vérifié |
| Policies + grants d'insertion admin sur `classes` | `classes_insert`, `grant insert (…)` — `:429,437` | ✅ existent, `schedule_id` dans la liste de colonnes du grant (un `null` s'insère) |
| Le formulaire de série dont l'UI s'inspire | `planning/series-form.tsx` | ✅ existe — champs identiques moins la récurrence |
| La conversion heure locale → instant | `instantLocal()` (`@rack/core/supabase`) | ✅ existe — l'heure saisie est locale à la box (règle 9 CLAUDE.md) |
| Chevauchement salle/heure | *rien ne le contrôle pour les séries non plus* | ⚠️ hors périmètre ici comme là — même niveau de garde que l'existant |

## Périmètre

- Migration : `schedule_id` nullable + contrainte d'invariant + commentaire.
- Action `createOneOff(slug, …)` : validation Zod (date au fuseau de la box),
  insertion `is_override: true`, `schedule_id: null`.
- Bouton « Cours ponctuel » à côté de « Nouvelle série », même dialogue
  dépouillé ; l'occurrence apparaît dans la grille comme les autres
  (annulable, séance éditable, capacité modifiable par `P1-025`).
- pgTAP : les deux moitiés ci-dessus.

## Hors périmètre

- Supprimer/déplacer un ponctuel : l'annulation d'occurrence existe et suffit
  au pilote.
- Le chevauchement de salle — même statut que pour les séries (aucun contrôle),
  à traiter ensemble le jour où il se pose.

## Critères d'acceptation

- [ ] Un cours ponctuel créé à l'écran apparaît dans la grille à sa date, sans
      nouvelle ligne dans « Séries »
- [ ] `refresh_class_schedule()` (modif d'une série quelconque) ne le touche ni
      ne le duplique — pgTAP
- [ ] `schedule_id null` sans `is_override` est refusé par la base — pgTAP
- [ ] Il se réserve côté membre comme n'importe quel cours (vérif harnais :
      `book_class` ne lit pas la série)
- [ ] `rls-auditor` SAFE sur la migration
