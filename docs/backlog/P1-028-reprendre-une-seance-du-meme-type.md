# `P1-028` — « Reprendre une séance » ne propose que le même type de cours

**Phase** `P1` · **Estimation** `0,25` j·h · **Dépend de** `P1-015` ✅ · **Spec** §7 · **Origine** usage réel du pilote, 14 septembre 2026 — priorité 2

## Objectif

En éditant la séance d'un WOD, le pré-remplissage ne propose plus une séance
d'Haltéro du même jour : **une séance ne se reprend qu'entre cours du même
type.**

## Le défaut, localisé

`sourcesPourOccurrence()` (`packages/core/src/supabase/workouts.ts:136`) retient
deux familles de candidats : *même type, semaine précédente* — déjà filtrée par
type — et ***même jour*, tous types confondus** (`:152`). C'est cette seconde
branche qui propose l'Haltéro dans le WOD. Les candidats portent déjà
`classTypeId` (`planning/page.tsx` → `candidates`) : le filtre est une
condition de plus, pas une donnée de plus.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| `sourcesPourOccurrence()` **pure et testée** | `workouts.ts:136`, suite Vitest de core | ✅ — le correctif est une ligne, le test avant |
| `classTypeId` sur l'occurrence éditée et les candidats | `page.tsx` (`candidates`), `Occurrence` | ✅ vérifié |

## Périmètre

- La branche « même jour » exige aussi `candidat.classTypeId ===
  occurrence.classTypeId` — test écrit avant (le cas Haltéro-dans-WOD rougit,
  puis vert), les cas existants inchangés.

## Hors périmètre

- Une bibliothèque de séances inter-types : `P2-009`.

## Critères d'acceptation

- [ ] Le cas rapporté rougit avant le correctif, passe après : un candidat d'un
      autre type le même jour n'est **plus** proposé
- [ ] « Même type la semaine précédente » et « même type le même jour »
      restent proposés — aucune régression dans la suite
