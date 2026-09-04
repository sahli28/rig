# D-010 — Un filet qui s'exécute sur le moteur du produit

**Phase** dette · **Estimation** 0,5 à 6 j·h selon l'option · **Origine** plantage du 4 septembre 2026 · **À arbitrer, pas à construire**

## Le problème, énoncé une fois

**Aucun de nos filets ne s'exécute sur le moteur du produit.**

| Filet | Moteur | `Intl` complet ? |
| ----- | ------ | ---------------- |
| Vitest | Node | oui |
| Harnais web (`expo start --web`) | navigateur | oui |
| pgTAP | PostgreSQL | sans objet |
| CI | Node, navigateur | oui |
| **Le produit** | **Hermes** | **non** |

Toute différence entre Hermes et un moteur complet nous est **structurellement
invisible**. Ce n'est pas un trou de couverture qu'on comble en écrivant plus de
tests : c'est un angle mort du dispositif.

Trois défauts en une semaine l'ont montré, tous de la même famille :

| Date | Défaut | Découvert par |
| ---- | ------ | ------------- |
| 3 sept. | `Intl.…resolvedOptions().locale` ne rend pas la langue du système | passe iPhone |
| 3 sept. | son jumeau `.timeZone` | relecture, en corrigeant le premier |
| 4 sept. | **`Intl.PluralRules` n'existe pas** — plantage du planning | passe iPhone |

Deux sur trois par une passe manuelle. Le troisième par un humain qui a pensé à
regarder la sœur. **Zéro par un test.**

Et ce n'est pas fini par nature : `Intl` était la surface visible, mais la même
logique vaut pour tout ce qu'un moteur JavaScript peut ne pas avoir — `Proxy`
partiel, `WeakRef`, `structuredClone`, les expressions régulières à groupes
nommés, `Array.prototype.at`. On ne le saura qu'en exécutant.

## Ce qui a été fait dans ce lot, et ce que ça ne couvre pas

Deux protections, statiques toutes les deux :

1. **`Intl` interdit hors d'un module unique** (ESLint). Elle empêche d'ajouter
   une dépendance au moteur sans passer par un endroit qui documente ce qu'il
   suppose ;
2. **un test qui ampute `globalThis.Intl`** de `PluralRules` et
   `RelativeTimeFormat`, et vérifie que le code s'en passe.

**Ce que le second ne fait pas** : il simule une *capacité manquante*, pas un
*moteur*. Il attrape « notre code dépend-il de X », qui est la bonne question
tant qu'on connaît X. Il n'attrape pas le X qu'on ne connaît pas encore — un
comportement d'`Intl.DateTimeFormat` qui diffère, des données ICU absentes pour
le français, une expression régulière que Hermes compile autrement.

## Les options, chiffrées

### A — Un écran de diagnostic au démarrage · **0,5 j·h**

Un écran mobile, atteignable en développement, qui énumère ce que le moteur
offre : les sous-objets d'`Intl`, quelques globales usuelles, la version de
Hermes, et le résultat de trois ou quatre formatages réels (une date, une heure,
un montant, un pluriel).

- **Ce que ça donne** : la réponse à « qu'est-ce que Hermes a, ici, aujourd'hui »
  en dix secondes, sur l'appareil de la développeuse, à chaque passe. Les trois
  défauts de la semaine auraient tous été visibles dessus **avant** d'écrire le
  code qui les déclenche ;
- **ce que ça ne donne pas** : rien d'automatique. Il faut ouvrir l'écran, et
  savoir quoi y chercher ;
- **coût réel** : un écran, une liste, aucune dépendance. C'est l'option la moins
  chère du dépôt, et de loin la meilleure par euro.

### B — Maestro sur appareil ou simulateur, en local · **2,5 j·h**

Le harnais E2E mobile annoncé par `CLAUDE.md` et jamais construit. Il exécute de
vrais parcours sur un vrai Hermes.

- **Ce que ça donne** : les parcours vérifiés automatiquement, sur le bon
  moteur. Le plantage du 4 septembre aurait été rouge au premier lancement ;
- **ce que ça coûte vraiment** : ce n'est pas 2,5 j·h une fois, c'est 2,5 j·h
  **plus** l'entretien des parcours à chaque écran. Et il ne tourne pas en CI
  sans un simulateur, donc il ne tourne que quand on y pense — c'est-à-dire au
  même moment qu'une passe manuelle, mais en plus lent à écrire ;
- **quand il devient rentable** : quand les parcours à revérifier dépassent ce
  qu'on accepte de refaire à la main. On y est presque : la passe du § 5 bis en
  compte déjà huit.

### C — Maestro en CI, sur simulateur hébergé · **6 j·h et un coût mensuel**

- **Ce que ça donne** : le seul dispositif qui attrape la régression sans que
  personne y pense ;
- **ce que ça coûte** : un runner macOS (GitHub le facture à la minute, ~10× un
  runner Linux), des simulateurs qui dérivent, et des tests intermittents qu'il
  faut soigner. Sur un projet à 2,3 j·h par semaine, c'est un second projet ;
- **quand** : pas avant que le produit encaisse. La spec le range en Phase 2, et
  c'est le bon moment.

## Recommandation

**A maintenant, B quand la passe manuelle dépassera dix minutes, C jamais avant
que le produit ait des clients.**

L'écran de diagnostic n'est pas un lot de consolation : il attaque le problème
au bon endroit. Ce qui nous a coûté trois défauts, ce n'est pas l'absence de
tests, c'est de **ne pas savoir ce que le moteur offre**. Une liste lue en dix
secondes le dit, et elle le dit avant qu'on écrive le code, pas après.

Maestro attrape les régressions ; le diagnostic évite de les écrire. Sur un
projet à une personne, éviter coûte moins cher qu'attraper.

## Ce qui reste vrai quoi qu'on décide

**La passe manuelle sur appareil reste le seul filet réel** tant que rien n'est
fait, et `docs/passe-mobile-iphone.md` en est le mode d'emploi. Sa faiblesse
n'est pas d'être manuelle, c'est d'être **rare** : entre deux passes, tout ce
qui touche le moteur est écrit à l'aveugle.

## Critères d'acceptation

À écrire quand l'option sera choisie. Ce ticket est un **arbitrage**, pas un
travail.
