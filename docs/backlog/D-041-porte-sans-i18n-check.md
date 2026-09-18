# `D-041` — La porte `/check` ne lance pas `i18n:check`

**Phase** `dette` · **Estimation** `0,25` j·h · **Spec** §16 · **Origine** `main` passé rouge i18n sans être vu, 18 septembre 2026

## Objectif

La porte (`/check`) **échoue** si `i18n:check` échoue — plus de faux vert sur les
clés i18n.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| La porte `/check` | enchaîne typecheck / format / lint / 18 sondes / `test` | ⚠️ **n'inclut pas `i18n:check`** — c'est par ce trou que `main` est passé rouge (clés orphelines `booking.mine_cta`, `preferences.cta`) sans alerte |
| `pnpm i18n:check` | `scripts/i18n-check.mjs` | ✅ existe, rend un code d'échec |

## Périmètre

- Ajouter `pnpm i18n:check` à la porte `/check`, au même rang que typecheck /
  lint / test.

## Critères d'acceptation

- [ ] Une clé orpheline ou manquante fait **rougir** `/check`
- [ ] La porte reste verte sur un dépôt sain

## Notes

Trouvé le 18 sept. 2026 : `main` rouge i18n (2 clés orphelines) non vu parce que
la porte ne lançait pas `i18n:check`. Le faux vert est exactement ce que ce dépôt
traque — la vérif existait, elle n'était juste pas dans la porte.
