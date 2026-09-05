# `P1-011` — Le bandeau de semaine : atteindre un jour en un tap

**Phase** P1 · **Estimation** `1,5` j·h · **Dépend de** P1-002b ✅, P1-003b ✅, P1-003c ✅ · **Spec** §4-P2, §12.4

## Objectif

Un membre atteint n'importe quel jour de la semaine **en un tap**, au lieu de
toucher « Jour suivant » autant de fois qu'il y a de jours d'écart.

## Pourquoi maintenant, et pas « quand on aura le temps »

**C'est la friction de la persona Léa, à chaque réservation.** Elle réserve la
veille au soir et vient le samedi : depuis le planning du jour, atteindre samedi
demande aujourd'hui deux à six taps sur une flèche, et chaque tap déclenche un
chargement. Ce n'est pas un défaut — l'écran fait ce qu'il annonce — c'est le
geste le plus fréquent du produit rendu le plus lent.

Elle arrive **après P1-003c** parce qu'elle touche `planning.tsx`, que P1-003b et
P1-003c viennent de modifier tous les deux. Les trois sont fusionnés ; la
condition est levée.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| Le calcul de semaine | `mondayOf()`, `weekDates()`, `shiftWeeks()`, `shiftDays()` — `packages/core/src/supabase/class-schedules.ts:228` | ✅ existent **et sont testés**. C'est ce qui rend ce ticket petit : la partie qui se trompe est déjà écrite, et partagée avec la grille du web |
| L'écran de planning et son état par jour | `apps/mobile/app/(app)/planning.tsx` | ✅ existe. `VueJour` porte déjà son jour, donc changer de jour est déjà sûr |
| Le jour local de la box | `localDay()` (règle 9) | ✅ existe — le bandeau se calcule en heure de la box, pas du téléphone |
| **Un format « jour de la semaine » dans la façade `Intl`** | `packages/core/src/i18n/format.ts` | ❌ **à créer.** `formatDate` ne connaît que `short` et `long` ; le bandeau veut « lun. » et « 7 » séparément. Passe par `packages/core/src/i18n/intl.ts`, seul module autorisé à toucher `Intl` |
| Les noms de jours sous Hermes | `intl.ts`, supposition « `DateTimeFormat` + données ICU françaises » | ⚠️ **prouvée en partie** : l'en-tête du planning affiche « vendredi 4 septembre 2026 » sur appareil depuis le 4 septembre. Les noms **abrégés** (`weekday: 'short'`) viennent des mêmes données ICU, donc le risque est faible — mais il est du même genre que `Intl.PluralRules`, et il se vérifie à la passe, pas au harnais |
| Un composant de bandeau horizontal | `packages/ui/src/native` | ❌ **à créer, et dans l'app, pas dans le kit** : un seul écran l'utilise (`CLAUDE.md`, conventions). Il rejoindra `packages/ui` le jour où un second écran en veut un |

## Périmètre

- **Le bandeau** : les sept jours de la semaine affichée, chacun un bouton
  portant l'abréviation du jour et le numéro. Le jour **sélectionné** est marqué,
  le jour **courant** l'est aussi et différemment — deux états distincts, parce
  qu'ils se superposent le plus souvent et se séparent dès qu'on navigue.
- **Le balayage** change de semaine. Les flèches « Jour précédent / Jour
  suivant » **restent** : elles sont le seul chemin accessible au clavier et au
  contrôle vocal, et un balayage n'a pas d'équivalent annoncé.
- **`formatWeekday()`** dans la façade `Intl`, avec ce qu'elle suppose du moteur
  écrit à côté, comme ses voisines.
- **L'accessibilité** : chaque jour s'annonce par sa **date entière** — « lundi
  7 septembre, aujourd'hui, sélectionné » — jamais par « lun. 7 », qui ne dit ni
  le mois ni l'état. C'est le piège nommé dans `.claude/rules/ui.md` : un
  élément ne se lit pas avec ce qui l'entoure.
- Le bouton « Revenir à aujourd'hui » **reste** et reprend son sens : il ramène
  la semaine *et* le jour.

## Hors périmètre

- **Aucun préchargement.** Rendre les sept jours atteignables ne veut pas dire
  les charger : chaque jour visité écrit une entrée de cache
  `(utilisateur, box, jour)`, et précharger une semaine en écrirait sept, dont
  six que personne n'a regardées. Ce serait aussi rendre `D-011` — la relecture
  à la main du contenu du cache — sept fois plus longue, pour économiser une
  attente d'une demi-seconde.
- Un calendrier mensuel, un sélecteur de date natif. Sept jours tiennent dans la
  largeur d'un téléphone ; un mois n'y tient pas, et le besoin est la semaine.
- La grille web, qui a déjà sa navigation par semaine.

## Critères d'acceptation

- [ ] Depuis le planning d'aujourd'hui, atteindre samedi en **un tap**
- [ ] Le jour courant et le jour sélectionné se distinguent **sans la couleur
      seule** (règle d'accessibilité du projet) — un contour, une graisse, un
      marqueur
- [ ] Chaque jour s'annonce par sa date entière et son état, vérifié dans l'arbre
      d'accessibilité au harnais (`read_page filter=interactive`)
- [ ] Les flèches et « Revenir à aujourd'hui » fonctionnent toujours
- [ ] Les jours sont ceux de la **semaine locale de la box** : un téléphone réglé
      sur un autre fuseau affiche la même semaine
- [ ] Rien n'est chargé avant d'être demandé — vérifié en comptant les requêtes
      au harnais, pas en le supposant
- [ ] **Sur appareil** : le balayage change de semaine, et les abréviations de
      jours s'affichent en français. C'est le seul critère que le harnais ne peut
      pas couvrir, et il porte la seule supposition non prouvée du ticket

## Notes

**Ce ticket est petit parce que le calcul est déjà fait.** `mondayOf()`,
`weekDates()` et `shiftWeeks()` vivent dans `@rack/core` depuis P1-002 et sont
testés — ils ont été écrits pour la grille du web, et c'est la deuxième fois
qu'ils servent. Ce qui reste ici est de la présentation et de l'accessibilité,
c'est-à-dire ce qui ne se partage pas entre un écran large à la souris et un
écran étroit au pouce.

**Ce qu'il coûte au jalon** : le total ① passe de 30,5 à 32 j·h restants, soit
environ **quatre jours de calendrier** au rythme de 2,3 j·h par semaine. En
dessous de la semaine, donc sans arbitrage à reprendre.
