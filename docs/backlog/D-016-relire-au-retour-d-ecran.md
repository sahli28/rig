# `D-016` — Trois écrans qui ne relisent rien quand on revient dessus

**Phase** `dette` · **Estimation** `0,5` j·h · **Dépend de** `P1-003c` (le correctif de la fiche de cours) · **Spec** `§4-P2` · **Origine** passe appareil du 5 septembre 2026

## Objectif

Un écran qu'on retrouve en revenant en arrière affiche l'état d'**aujourd'hui**,
pas celui du moment où on l'a quitté.

## Pourquoi un ticket, et pas trois lignes ajoutées au correctif de `P1-003c`

Le défaut a été trouvé sur la fiche de cours : couper « Apparaître dans la liste
des inscrits », revenir, et se voir encore dans la feuille. Corrigé là où il a
été vu.

Mais la cause n'appartient pas à cet écran. **Les quatre écrans de
`apps/mobile` chargent leurs données dans un `useEffect` monté une fois**, et la
navigation d'`expo-router` est une pile : revenir d'un écran poussé rend la main
à l'**instance déjà montée**, qui ne rejoue rien. La fiche de cours était le
premier endroit où ça se voyait, pas le seul endroit où c'est vrai.

C'est la règle des sœurs de `CLAUDE.md`, prise en flagrant délit : un chemin
corrigé, trois jumeaux intacts.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `useFocusEffect` | `expo-router` (SDK 57) — `node_modules/expo-router/build/exports.d.ts:19` | ✅ exporté, **et déjà employé** dans `apps/mobile/app/(app)/class/[id].tsx` depuis le correctif de `P1-003c` : la forme est éprouvée sur appareil, ce ticket la reprend |
| Les trois écrans à reprendre | `planning.tsx:103`, `index.tsx:48`, `bookings.tsx:55` | ✅ existent, tous sur le même `useEffect` de montage |
| La pile de navigation | `apps/mobile/app/_layout.tsx:98` — un seul `Stack` | ✅ existe. C'est elle qui décide quels écrans restent montés : la racine (`index`) **toujours**, `planning` tant qu'une fiche de cours est posée dessus |
| Un moyen de l'exercer sans téléphone | ❌ **aucun** — `apps/mobile` n'a pas de montage de composant | `D-015`. Ce ticket se vérifie donc à la main, comme le correctif qui l'a fait naître |

## Ce que ce ticket rend possible, et qui l'appellera

Rien de neuf n'est livré. Ce ticket **répare**, et il en va comme de `D-011` :
son appelant est le prochain geste de la prochaine passe.

## Périmètre

- **`planning.tsx`** — le cas visible, et le plus gênant : on réserve depuis la
  fiche d'un cours, on revient au planning, **le nombre de places restantes est
  celui d'avant**. `DayClass` porte `capacity` et `booked_count`
  (`packages/core/src/supabase/planning.ts:166`), donc l'écart s'affiche en
  toutes lettres à quelqu'un qui vient de réserver. Sur un produit de
  réservation, c'est le chiffre auquel on croit le moins volontiers deux fois.
- **`index.tsx`** — la racine de la pile, donc **montée une fois pour toute la
  session**. Le cours mis en avant sur l'accueil date du lancement de l'app.
- **`bookings.tsx`** — aujourd'hui poussé, donc remonté à chaque visite : il est
  correct **par accident de navigation**, pas par construction. Il entre ici pour
  que `P1-004` (annulation) ne le découvre pas au moment où une annulation devra
  disparaître de la liste.
- Le **premier passage garde son squelette, les suivants rafraîchissent en
  silence** — et un rafraîchissement qui échoue laisse à l'écran ce qui y est,
  au lieu de remplacer une information correcte par une erreur. C'est la forme
  retenue sur la fiche de cours ; la reprendre telle quelle est le sujet du
  ticket.

## Hors périmètre

- **Le temps réel.** Relire au retour n'est pas s'abonner aux changements : les
  places qui bougent pendant qu'on regarde l'écran, c'est `P1-005`.
- **Un tiré-pour-rafraîchir.** Geste utile, autre sujet, autre ticket — et il ne
  couvrirait pas ce défaut-ci, qui frappe précisément quelqu'un qui ne pense pas
  à rafraîchir.
- Le web. `apps/web` recharge côté serveur à chaque navigation.

## Critères d'acceptation

- [ ] Réserver depuis une fiche de cours, revenir au planning : **le nombre de
      places restantes a baissé d'une unité**, sans quitter ni rouvrir l'écran
- [ ] Revenir sur un écran déjà rempli **ne fait pas clignoter de squelette**
- [ ] Un rafraîchissement qui échoue (mode avion au retour) laisse le contenu
      précédent affiché, et ne le remplace pas par un écran d'erreur
- [ ] L'accueil, retrouvé après une réservation, montre l'état du moment
- [ ] Les trois écrans passent par la **même** forme que la fiche de cours —
      une seule manière de recharger dans l'app, pas quatre variantes

## Notes

**Ce que ce ticket n'aurait pas trouvé tout seul.** Le défaut est invisible au
harnais web et invisible à `pnpm test` : il ne vit ni dans une fonction ni dans
un rendu, mais dans le **cycle de vie** d'un écran poussé puis dépilé. Il a
fallu un doigt sur un téléphone, et il a fallu que ce doigt cherche autre chose
— c'est le cinquième défaut mobile trouvé de cette façon, et le troisième que la
règle des sœurs élargit après coup.

**Pourquoi l'estimation reste basse alors qu'il touche trois écrans.** La forme
est déjà écrite et déjà exercée sur appareil ; il n'y a pas de décision à
prendre, seulement à la reprendre trois fois et à la vérifier. Si la
vérification demande plus d'un geste par écran, c'est que le ticket a grossi et
il faut le dire.
