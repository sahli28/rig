# `D-017` — Le flash blanc au démarrage, en mode sombre *(rétroactif)*

**Phase** `dette` · **Estimation** `0,25` j·h · **✅ fait le 5 septembre 2026** (PR #43) · **Origine** revue de backlog du 5 septembre au soir

## Pourquoi un ticket écrit après coup

Même motif que `D-012`, et c'est la deuxième fois : **le travail était fait et
n'apparaissait dans aucun total.** Il ne pouvait pas y apparaître — il a été
rattaché à `D-009`, qui était close depuis la veille. Un ticket clos ne se relit
pas, c'est écrit noir sur blanc dans la section ④ du README ; il ne se recharge
pas non plus.

Le rattacher à `D-009` aurait fait porter à un ticket clos un travail qu'il
n'avait pas prévu — `D-009` est la **navigation** (en-tête, historique, retours),
pas le thème au démarrage. Les deux lots sont distincts, et les compter une seule
fois rendait le total du jalon pilote faux de 0,25 j·h.

## Le défaut

`useColorScheme()` a **trois** états, pas deux : `'light'`, `'dark'`, et `null`
tant que la première image n'est pas rendue. Le code traitait `null` comme
« clair ». Sur un iPhone en mode sombre, l'app s'ouvrait donc sur un flash blanc
— court, mais c'est le premier geste du produit, et il annonce le contraire de ce
que le reste de l'app fait.

C'est la même forme que les défauts que ce dépôt collectionne : une valeur
absente traitée comme une valeur par défaut, au lieu d'être traitée comme absente.

## Ce qui a été livré

- `apps/mobile/lib/color-scheme.ts` — la résolution du thème à partir des trois
  états, et le repli explicite ;
- sa suite de tests (`color-scheme.test.ts`), qui exerce le cas `null` ;
- le câblage dans `apps/mobile/app/_layout.tsx` ;
- **la règle écrite dans `.claude/rules/ui.md`**, pour que le motif ne revienne
  pas par un autre écran. C'est la partie qui vaut plus que le correctif.

## Ce que ce ticket ne fait pas

Le **balayage iOS** de `D-009` reste ouvert, et le reste : il attend la prochaine
passe sur appareil, avec `D-011`.
