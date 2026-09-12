# `D-030` — Le mapping CSV reconnaît ses propres clés

**Phase** `dette` · **Estimation** `0,25` j·h · **Dépend de** `P1-001d` ✅ · **Spec** §8 · **Origine** test de bout en bout du 12 septembre 2026 (constat mineur)

## Objectif

Un CSV dont les en-têtes sont `first_name` / `last_name` — les clés **que le
produit utilise lui-même** — est mappé automatiquement, au lieu de laisser ces
deux colonnes « à choisir à la main ».

## Le constat

`guessMapping()` (`packages/core/src/import/mapping.ts:19-24`) reconnaît
`prenom`, `first name`, `firstname`, `given name`… mais **pas `first_name`
avec tiret bas**, ni `last_name` : `normalise()` retire accents et casse,
pas les tirets bas. Un export produit par un outil qui parle snake_case — dont
tout ce que ce dépôt émet — n'est donc pas reconnu. Sans gravité (l'invitation
ne se sert que de l'e-mail, et le mapping se corrige à l'écran), mais c'est
l'outil qui ne se comprend pas lui-même.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| `guessMapping()` et sa table `ENTETES` | `packages/core/src/import/mapping.ts:19` | ✅ existe |
| Sa suite de tests | `packages/core/src/import/import.test.ts` | ✅ existe |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| Les synonymes snake_case dans `ENTETES` | `guessMapping()`, déjà appelée par l'écran d'import | celui-ci |

## Périmètre

- `first_name`, `last_name` (et `e_mail` si l'on y touche déjà) entrent dans la
  reconnaissance — soit comme entrées de `ENTETES`, soit en normalisant le
  tiret bas en espace dans `normalise()`, ce qui couvre les deux d'un coup.
- Le test qui prouve chaque en-tête ajouté, dans le même commit.

## Hors périmètre

- Tout élargissement du format d'import (colonnes nouvelles, autres langues).

## Critères d'acceptation

- [ ] Un CSV à en-têtes `email,first_name,last_name,role` est entièrement mappé
      sans intervention
- [ ] Les en-têtes déjà reconnus le restent (aucune régression dans la suite)
