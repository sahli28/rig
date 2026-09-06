# P1-012 — Le planning dit ce qui est déjà réservé

**Phase** P1 · **Estimation** 1 j·h · **Dépend de** P1-003b ✅, P1-011 ✅, **P1-014 ✅** · **Après P1-004** · **Spec** §12.4

> **Révisé le 6 septembre 2026 — 2 → 1 j·h.** P1-014 a livré la moitié du chemin
> de données et tranché la décision hors ligne. Ce qui reste : la granularité par
> cours, le badge, et **le volet `planning.tsx` de `D-016`, que ce ticket
> absorbe**.

## Ce que la passe d'usage a montré

Une membre ouvre son planning et **ne voit pas qu'elle est inscrite au 18h30**.
L'information existe — « Mes réservations » la porte — mais il faut quitter
l'écran où l'on se pose la question pour aller la chercher ailleurs.

C'est du confort, pas du chemin critique. Mais c'est le genre de confort qui
décide si une box trouve l'app agréable ou pénible, et il se paie une fois.

## Périmètre

Deux niveaux, parce que ce sont deux questions différentes :

1. **Sur la ligne du cours** — un badge « Réservé ». La question est « suis-je
   inscrite à *celui-là* ? ».
2. ~~**Sur le jour, dans le bandeau de semaine** — une pastille.~~ **Parti en
   P1-014**, le 5 septembre 2026. Le bandeau de semaine est remplacé par une
   grille de mois, et la pastille arrive avec elle — sur un mois entier, passé
   compris, ce que ce ticket-ci ne prévoyait pas. Le laisser ici ferait livrer
   la même pastille deux fois.

**Ce ticket se réduit donc à son premier niveau.** Il reste utile : « ai-je
quelque chose ce jour-là » et « suis-je inscrite à *ce cours-là* » sont deux
questions, et la seconde se pose sur une ligne, pas sur une case de calendrier.
Estimation revue le 6 septembre 2026 : **2 → 1 j·h**.

**Le badge est un texte, jamais une couleur seule** (`.claude/rules/ui.md`).

Ce ticket ne touche plus qu'un écran, `planning.tsx`. C'est pourquoi il est resté
à part : glissé dans P1-004, il aurait brouillé un ticket dont le sujet est une
transaction.

## Ce que P1-014 a déjà livré — et la décision qui n'a plus à être prise

Ce ticket portait une décision ouverte : **le marqueur hors ligne**, le cache de
P1-002b excluant volontairement les réservations personnelles. Deux options
étaient posées, avec une recommandation pour la B (mettre en cache des
identifiants, et rien d'autre).

**Elle est tranchée, et déjà en place** — P1-014 l'a implémentée en livrant la
pastille du mois, avec les deux garde-fous demandés :

| Ce qui existe | Où |
| ------------- | -- |
| `fetchBookedDays()` → `BookedDays = Record<string, number>` | `packages/core/src/supabase/bookings.ts:437` |
| `writeBookedDays()` / `readBookedDays()`, préfixe `rack.bookeddays.` | `apps/mobile/lib/schedule-cache.ts:120` |
| Clé partitionnée par `userId` **et** `tenantId`, purge branchée sur `clearScheduleCache()` | idem |
| **Relecture au retour d'écran** des pastilles (`useFocusEffect`) | `apps/mobile/app/(app)/planning.tsx:243` |

**Ce qui manque est la granularité.** `BookedDays` est une date vers un
*nombre* : il dit « tu as deux choses mardi », pas *lesquelles*. Le badge se pose
sur une ligne de cours, il lui faut donc l'ensemble des `class_id` réservés du
jour affiché. C'est l'essentiel du travail restant.

## Pourquoi ce ticket porte aussi la relecture au retour du planning

`D-016` recense trois écrans qui ne relisent rien quand on y revient. P1-014 a
laissé le cas du planning à `D-016`, et l'a écrit dans le code :

> « La **liste du jour**, elle, ne se relit pas au retour : c'est D-016, et ce
> ticket ne l'absorbe pas. **Rien de ce qu'elle affiche ne dépend d'une
> réservation** — le badge « Réservé » sur la ligne est P1-012. »
> — `apps/mobile/app/(app)/planning.tsx:238`

Le raisonnement était juste **le 5 septembre**. Ce ticket-ci le rend faux : à
partir du moment où la ligne porte un badge « Réservé », ce qu'elle affiche
dépend d'une réservation. Livrer le badge sans la relecture produirait une
incohérence **plus visible** que celle qu'on corrige — le badge serait faux au
moment précis où on le regarde, en revenant sur la liste juste après avoir
réservé.

**Ce ticket absorbe donc le volet `planning.tsx` de `D-016`** (`+0,25`, compté
dans le 1 j·h). `D-016` se réduit à ses deux écrans restants, `index.tsx` et
`bookings.tsx`.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `bookings`, et la lecture de ses propres réservations | P1-003 ✅ | ✅ existe — policy `bookings_own_select` |
| L'écran de planning mobile et sa ligne de cours | P1-003b ✅ | ✅ existe |
| Le bandeau de semaine | P1-011 ✅ | ✅ existe, avec sa suite de tests |
| Le cache hors ligne et sa clé partitionnée | P1-002b ✅ | ✅ existe — **à étendre**, voir la décision ci-dessus |
| La purge à la déconnexion | P1-002b ✅ | ✅ existe — le nouveau cache doit s'y brancher, pas en créer une seconde |
| Une suite de tests pour `apps/mobile` | P1-011 ✅ | ✅ existe depuis P1-011 — c'est elle qui rend ce ticket testable sans appareil |
| Le planning **web** | P1-002 ✅ | ⚠️ **hors périmètre, et à décider** : le staff regarde le planning de la box, pas ses propres réservations. Le marqueur n'y a probablement pas de sens — le dire plutôt que l'oublier |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| Le badge « Réservé » sur une ligne de cours | le planning mobile | celui-ci |
| Le détail **par cours** des réservations du jour | le badge, ci-dessus | celui-ci |
| La liste du jour relue au retour d'écran | le planning | celui-ci (volet de `D-016`) |

## Critères d'acceptation

- [x] Une membre inscrite au 18h30 le voit **sur la ligne du cours**, sans
      ouvrir le détail
- [x] Le badge est un texte lisible par VoiceOver, pas une couleur seule
- [x] Annuler une réservation (P1-004) fait disparaître le marqueur **au retour
      sur le planning**, sans relancer l'app — c'est le geste 3 de `D-016`, et il
      s'est déjà fait prendre deux fois
- [x] **Réserver, revenir sur la liste : le nombre de places du cours a changé
      lui aussi**, pas seulement le badge — c'est le volet `D-016` absorbé, et
      c'est le symptôme cité par ce ticket
- [ ] **Le retour ne fait clignoter ni la liste ni la page** — ❌ **échoué à la
      passe du 6 septembre 2026** : toute la page clignote après une réservation
      comme après une annulation. Parti en `D-018` ; le mécanisme de ce ticket
      est hors de cause, la relecture est bien silencieuse
- [x] Hors ligne, le marqueur reste affiché à partir du cache — **vérifié sur
      appareil le 6 septembre 2026** (scénario E)
- [x] **Vérifié le 6 septembre 2026.** Se déconnecter efface ce cache : le compte suivant sur le même téléphone ne
      voit aucun marqueur du précédent
- [~] Deux boxes sur le même compte ne mélangent pas leurs marqueurs — **non
      exerçable** : changer de box impose une déconnexion, qui purge le cache et
      validerait le critère par le mauvais mécanisme. Exerçable dès **P1-009**
      (sélecteur de box). Constaté à la passe du 6 septembre 2026

## Notes

Le quatrième critère est le piège de ce ticket, et il est connu : un marqueur est
un état dérivé, et les états dérivés de cet écran ont déjà affiché le contraire
de la base deux fois (P1-003c, puis `D-016`). Le relire au retour d'écran n'est
pas une précaution, c'est la règle du dépôt.

## Ce qui a été décidé en cours de route

**1. `BookedDays` passe de `jour → nombre` à `jour → identifiants de cours.**
Le ticket disait que l'option B — « mettre en cache des identifiants » — était
déjà en place. Elle ne l'était qu'à moitié : P1-014 stockait des **comptes**.
Deux façons de combler le manque, une seconde lecture par jour ou élargir la
première ; c'est la seconde, parce qu'une requête sert alors les deux usages et
que **le compte devient dérivé** (`ids.length`). Deux valeurs qui ne peuvent plus
se contredire valent mieux que deux valeurs à synchroniser.

Conséquence assumée : un cache écrit par la version précédente ne valide plus.
`readBookedDays()` le jette, la première lecture réseau le remplace — c'est
exactement ce que le schéma Zod est là pour faire.

**2. Le trou que le ticket ne voyait pas : les mois sont chargés, le jour est
affiché, et ce ne sont pas les mêmes.** Depuis P1-014, feuilleter octobre ne
déplace pas le jour ouvert en dessous. Un badge qui aurait lu « le mois chargé »
aurait donc perdu ses marqueurs dès qu'on feuillette, sur une liste qui n'a pas
bougé. D'où un état **indexé par mois** et `moisACharger()`, qui ne demande le
second mois que s'il diffère vraiment — soit jamais, dans le cas courant.

**3. Le badge s'ajoute au compteur, il ne le remplace pas.** « Suis-je
inscrite ? » et « reste-t-il de la place ? » sont deux questions, et la seconde
reste utile une fois inscrite. C'est aussi ce qui rend le quatrième critère
observable : réserver change **les deux**.

## Ce qui reste à vérifier à la main

Quatre critères sur sept sont vérifiés au harnais web — badge, texte lisible,
annulation, et le volet `D-016`. Les trois derniers demandent un appareil :
hors ligne, purge à la déconnexion, et deux boxes sur le même compte. Ils sont
tenus **par construction** (clé de cache `(userId, tenantId)`, purge branchée sur
`clearScheduleCache()`), ce qui n'est pas la même chose qu'observé.
