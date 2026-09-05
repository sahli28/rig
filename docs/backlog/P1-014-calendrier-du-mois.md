# P1-014 — Un calendrier du mois, avec une pastille sur mes jours réservés

**Phase** P1 · **Estimation** 2,5 j·h · **Dépend de** P1-011 ✅ (qu'il remplace), P1-003 ✅, P1-004 ✅ · **Spec** §7.1 (« vue jour (mobile) »), §12.4

## Objectif

Une membre voit **un mois entier d'un coup d'œil**, avec une pastille sur chaque
jour où elle est inscrite, et atteint n'importe quel jour en un tap depuis le
même écran — **les mois passés compris**.

C'est une demande d'usage, formulée en regardant l'app d'un concurrent
(Peppy) : « j'aime bien voir ça quand j'ai réservé plusieurs jours dans un mois,
**c'est historique** ». Le mot compte : ce qui manque n'est pas un sélecteur de
jour de plus, c'est **la vue d'ensemble de son propre mois**.

## Ce que ce ticket remplace, et ce qu'il en garde

**Il retire le bandeau de semaine de P1-011** (`apps/mobile/components/week-strip.tsx`)
et met la grille du mois à sa place, au-dessus de la liste du jour — la
disposition exacte de la capture : mois en haut, cours du jour choisi en bas.

P1-011 a coûté **2 j·h et trois essais**, tous sur le même défaut. Ce qui a été
payé là-bas ne se repaie pas ici :

- **aucun état à tenir d'accord avec une position de défilement.** C'était le
  défaut de fond, pas les deux bugs corrigés au passage. Une grille de mois est
  **statique** : elle n'a pas de carrousel, donc pas de synchronisation — la
  conception qui a coûté trois essais, la grille l'obtient gratuitement. Le
  changement de mois se fait par **flèches**, pas par balayage. Si un balayage
  arrive un jour, il reprend la règle de P1-011 : la position **est** la vérité,
  et rien ne défile par programme ;
- **les flèches de jour restent.** Elles sont le seul chemin annoncé au clavier
  et au contrôle vocal, et la grille ne les remplace pas ;
- **la logique vit hors du `.tsx`.** `month-grid-state.ts` à côté de son test,
  comme `week-strip-state.ts` : c'est ce que `D-015` a payé, et c'est ce qui rend
  ce ticket vérifiable sans téléphone.

**Ce qui change, et c'est le sujet** : on va dans le passé. P1-011 s'y refusait
— « la fenêtre de réservation est de sept jours, un cours passé ne se réserve
pas ». C'était juste pour un sélecteur de réservation ; ça ne l'est plus pour un
**historique**, qui est la moitié de la demande.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| L'écran de planning mobile et son état à un seul jour | `apps/mobile/app/(app)/planning.tsx` | ✅ existe |
| Le bandeau de semaine à retirer, et sa suite de tests | `apps/mobile/components/week-strip*.ts(x)` | ✅ existe — **supprimé par ce ticket**, tests compris |
| Une suite de tests pour `apps/mobile` | P1-011 ✅ / D-015 ✅ | ✅ existe — `apps/mobile/components/week-strip-state.test.ts` en est le modèle |
| Lire ses propres réservations | policy `bookings_own_select` (P1-003) | ✅ existe — **aucune migration dans ce ticket** |
| La date locale de la box à partir d'un instant | `localDay()` / `localDayIn()`, `packages/core/src/supabase/planning.ts:90` | ✅ existe — **obligatoire**, voir le piège ci-dessous |
| Borner une requête sur une journée locale | `instantLocal()`, `packages/core/src/supabase/planning.ts:122` | ✅ existe — c'est lui qui donne les deux bornes UTC d'un mois local |
| Un lecteur des réservations **bornées à un intervalle** | `packages/core/src/supabase/bookings.ts` | ❌ **à créer dans ce ticket** — `fetchUpcomingBookings()` lit tout puis filtre sur les cours **futurs** (`bookings.ts:402`), il ne sait pas regarder en arrière |
| Le cache hors ligne et sa purge à la déconnexion | P1-002b ✅ | ✅ existe — **à étendre**, voir la décision ci-dessous |
| La porte `tenantScope` et la règle ESLint qui l'impose | `packages/core/src/supabase/` | ✅ existe — le nouveau lecteur y entre, il ne lit pas une table de box depuis l'app |
| `memberships.joined_at`, pour borner le passé | P0-004 ✅ | ✅ existe — déjà lisible par tout membre de la box |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `fetchBookedDays(client, { tenantId, membershipId, from, to })` | la grille du mois | celui-ci |
| `month-grid-state.ts` (les six semaines d'une grille, le mois affiché) | `MonthCalendar` | celui-ci |
| `MonthCalendar` | `planning.tsx` | celui-ci |
| Le cache des jours réservés | la grille, hors ligne | celui-ci |

## Périmètre

- **La grille.** Titre du mois, en-têtes de jours de semaine dans la langue
  active, six lignes de sept cases, jours hors mois vides. Le jour choisi est un
  disque plein ; aujourd'hui est marqué **autrement** — la capture les confond,
  nous non : deux états différents ne portent pas le même signe.
- **Les flèches de mois**, et le retour au mois courant.
- **La pastille** sous le numéro, sur chaque jour où la personne a au moins une
  réservation `CONFIRMED` — passée comme à venir.
- **`fetchBookedDays()`**, une requête par mois affiché, rien de préchargé.
- **La borne basse** : on ne recule pas avant `joined_at` de l'appartenance. Il
  n'y a rien à voir avant, et ça évite une navigation infinie vers un vide.
- **Le cache** des jours réservés du mois, pour que la pastille survive au mode
  avion.
- **Retirer** `week-strip.tsx`, `week-strip-state.ts` et son test.

## Hors périmètre

- **Les onglets de la capture** (« Séances à venir », « Drop-Ins ») : le premier
  est déjà `Mes réservations`, le second est le réseau inter-box (S12, hors MVP).
- **L'icône de filtres** : les filtres type/coach existent déjà sur le planning
  (P1-010), ce ticket n'y touche pas.
- **Le planning web.** Le back-office regarde le planning de la box, pas les
  réservations d'une personne : la pastille n'y a pas de sens. Dit ici pour ne
  pas le redécouvrir.
- **Une pastille par cours, ou un compte affiché dans la case.** Un point suffit
  à répondre à « ce jour-là, oui ou non » ; le nombre est dans l'étiquette
  d'accessibilité et dans la liste en dessous.

## Trois décisions, prises ici

### 1. La pastille se pose sur la **date locale de la box**, jamais sur l'UTC

`starts_at` est un `timestamptz`. Un cours à 00h30 le 1er octobre à Paris est le
**30 septembre à 22h30 UTC** : un `starts_at.slice(0, 10)` poserait la pastille
sur le mauvais jour, et sur le mauvais **mois** une fois par mois. La conversion
passe par `localDay()`, et les bornes de la requête par `instantLocal()` — les
deux existent, écrits pour exactement ce piège en P1-002.

C'est la règle 9 de `CLAUDE.md`, et c'est le seul endroit de ce ticket où une
erreur ne se verrait pas à l'écran.

### 2. Hors ligne : on met en cache **des dates**, rien d'autre

Même arbitrage que P1-012, un cran plus bas. P1-012 proposait de cacher des
identifiants de cours ; ici il suffit d'une **liste de dates** `AAAA-MM-JJ` par
mois. Aucune donnée d'autrui, aucun nom, aucune heure — la personne connaît déjà
ses propres jours.

Les deux garde-fous de P1-012 valent tels quels : clé partitionnée par
`user_id` **et** `tenant_id`, et **purge à la déconnexion** en se branchant sur
celle qui existe, jamais en en créant une seconde.

### 3. Le passé s'arrête à l'adhésion

Une navigation par flèches, sans limite, finirait par interroger 2019. La borne
est `memberships.joined_at` : avant, la personne n'était pas là. La flèche se
désactive, avec le libellé qui le dit — pas un bouton muet.

## Ce que P1-012 devient

**Son deuxième niveau est absorbé ici.** P1-012 prévoyait « une pastille sur le
jour, dans le bandeau de semaine » : le bandeau disparaît, la pastille arrive
avec la grille. P1-012 se réduit donc à son **premier** niveau — le badge
« Réservé » sur la ligne du cours, qui répond à une autre question (« suis-je
inscrite à *celui-là* ? ») et reste utile.

À reporter dans P1-012 dans le même commit que ce fichier, sinon deux tickets
promettent la même pastille et le second la livrera une seconde fois.

## Critères d'acceptation

- [ ] La grille montre le mois entier, jours de semaine et titre dans la langue
      active — vérifié en `fr` **et** en `en`
- [ ] Une pastille apparaît sur chaque jour portant au moins une réservation
      confirmée, **y compris dans un mois passé**
- [ ] Le jour choisi et aujourd'hui sont **deux signes différents**, et aucun des
      deux n'est porté par la couleur seule (`.claude/rules/ui.md`)
- [ ] L'étiquette d'accessibilité du jour dit la pastille en toutes lettres —
      « mardi 8 septembre, 2 réservations » — et non « mardi 8 »
- [ ] Un cours à 00h30 heure de la box tombe sur **son** jour local, pas sur la
      veille : test aux deux bornes de minuit, et autour d'un changement d'heure
- [ ] Annuler une réservation (P1-004) fait disparaître la pastille **au retour
      sur le planning**, sans relancer l'app — geste 3 de `D-016`, déjà pris deux
      fois
- [ ] Hors ligne, les pastilles du mois déjà visité restent affichées
- [ ] Se déconnecter efface ce cache : le compte suivant sur le même téléphone ne
      voit aucune pastille du précédent
- [ ] La flèche du passé s'arrête à l'adhésion, et dit pourquoi
- [ ] `month-grid-state.ts` est testé sans appareil : mois à 28, 30 et 31 jours,
      mois commençant un dimanche, année bissextile

## Notes

**Le risque de ce ticket n'est pas la grille, c'est la pastille.** La grille est
de l'arithmétique de calendrier, entièrement testable sous Vitest. La pastille
est un **état dérivé** de la base, et les états dérivés de cet écran ont affiché
le contraire de la base deux fois — P1-003c, puis `D-016`. Le sixième critère
n'est pas une précaution, c'est la règle du dépôt.

**Une passe mobile sera nécessaire** avant la fusion : ce ticket remplace le
composant de navigation le plus touché de l'app, et P1-011 a montré que le geste
ne se juge pas au harnais. Protocole dans `docs/passe-mobile-iphone.md`.
