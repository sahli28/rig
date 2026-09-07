# `D-016` — Trois écrans qui ne relisent rien quand on revient dessus

**Phase** `dette` · **Estimation** `0,25` j·h · *(0,5 → 0,25 le 6 sept. 2026 : le volet `planning.tsx` part dans **P1-012**, qui rend sa liste dépendante d'une réservation)* · **Dépend de** `P1-003c` (le correctif de la fiche de cours) · **Spec** `§4-P2` · **Origine** passe appareil du 5 septembre 2026

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
| Les écrans à reprendre | ~~`planning.tsx:103`~~ **→ P1-012**, `index.tsx:48`, `bookings.tsx:55` | ✅ existent, tous sur le même `useEffect` de montage |
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
  places qui bougent pendant qu'on regarde l'écran, c'est `P1-005a`.

## Ce que `P1-005a` retire à ce ticket, et ce qu'il lui laisse

*Écrit le 6 septembre 2026, à la découpe de `P1-005`.*

Le temps réel tue **la moitié « places restantes »** de cette dette : sur le
planning et sur l'accueil, un compteur périmé cesse d'être possible, puisqu'un
canal le corrige pendant qu'on regarde l'écran.

**Le reste survit, et ses raisons ne sont plus les places** — c'est ce qui
importe ici, parce qu'un ticket dont on a retiré la motivation la plus visible
se referme par erreur :

- **`index.tsx`** — le **badge « Réservé »** et le cours mis en avant. L'accueil
  est la racine de la pile, donc monté une fois pour toute la session, et **aucun
  événement sur `classes` ne dit « cette personne a réservé »** : le canal porte
  un compteur, pas une appartenance.
- **`bookings.tsx`** — **une annulation faite ailleurs**. Un canal branché sur
  `classes` ne la verra jamais passer.

Après `P1-005a`, cette dette c'est donc **`index.tsx` et `bookings.tsx`**, et
rien d'autre. `planning.tsx` était déjà parti dans `P1-012`.
- **Un tiré-pour-rafraîchir.** Geste utile, autre sujet, autre ticket — et il ne
  couvrirait pas ce défaut-ci, qui frappe précisément quelqu'un qui ne pense pas
  à rafraîchir.
- Le web. `apps/web` recharge côté serveur à chaque navigation.

## Critères d'acceptation

- [x] Réserver depuis une fiche de cours, revenir au planning : **le nombre de
      places restantes a baissé d'une unité**, sans quitter ni rouvrir l'écran —
      **livré par P1-012** le 6 sept. 2026, et vérifié au harnais : 16 → 15
      places au retour, avec le badge « Réservé » apparu en même temps
- [x] Revenir sur un écran déjà rempli **ne fait pas clignoter de squelette** —
      vérifié au harnais le 7 septembre 2026 sur le scénario que ce ticket
      nomme : annuler depuis la fiche de cours, revenir sur « Mes réservations ».
      La liste passe de la réservation à l'état vide **sans squelette**, sur
      l'instance déjà montée
- [x] Un rafraîchissement qui échoue (mode avion au retour) laisse le contenu
      précédent affiché, et ne le remplace pas par un écran d'erreur — exercé en
      faisant échouer les lectures pendant la transition : la réservation reste
      affichée, aucun écran « indisponible »
- [ ] L'accueil, retrouvé après une réservation, montre l'état du moment.
      **Mécanisme vérifié, effet visible non observé** : au retour sur l'accueil,
      une lecture fraîche part bien (`/rest/v1/classes`) alors que cet écran est
      la racine de la pile et n'avait jamais rien relu. Mais la carte n'affiche
      que le prochain cours **du jour**, et la passe s'est faite à 23 h 55 heure
      de la box : il n'y en avait plus. **Ne pas cocher sur le mécanisme** — c'est
      le faux vert que ce dépôt traque. **Geste écrit — bloc B de la passe groupée**, § 5 sexies de `docs/passe-mobile-iphone.md`, avec sa contrainte d'heure : la carte n'affiche que le prochain cours *du jour*
- [x] Les trois écrans passent par la **même** forme — et elle n'est plus à
      recopier : `apps/mobile/lib/use-relire-au-retour.ts`. `planning.tsx`,
      `index.tsx` et `bookings.tsx` l'appellent ; `class/[id].tsx` reste à part
      **et le fichier dit pourquoi**

## Ce que le correctif a changé, et la variante qu'il retire

**La forme n'est plus dans un écran, elle est dans un fichier** —
`apps/mobile/lib/use-relire-au-retour.ts`. Le ticket demandait « une seule
manière de recharger dans l'app, pas quatre variantes » ; la tenir par la
discipline aurait suffi à trois écrans et échoué au quatrième. Elle est
structurelle : il n'y a plus rien à recopier.

**Et ce qui est extrait n'est pas la forme d'origine, c'est celle corrigée par
`D-018`** — le `ref` et les dépendances vides. C'est le point : la correction du
6 septembre vivait dans `planning.tsx` seulement, et les deux écrans de ce
ticket-ci allaient reprendre la version d'avant. Un correctif qui n'existe qu'à
un endroit est un correctif que ses sœurs ignorent.

**`class/[id].tsx` n'emploie pas le hook, et ce n'est pas un oubli.** Il n'a pas
d'effet de montage : son `useFocusEffect` dépend de `charger` et fait les deux
travaux à la fois — charger, et relire quand la langue ou l'appartenance change.
Sa dépendance n'est pas celle que `D-018` a corrigée, elle est **porteuse** ; la
retirer l'empêcherait de relire. Deux formes, deux besoins, et la différence est
écrite dans l'en-tête du hook plutôt que laissée à deviner.

**Deux défauts corrigés au passage, tous deux dans le périmètre du ticket :**

- `bookings.tsx` reposait un squelette à **chaque** lecture et remplaçait la
  liste par un écran « indisponible » au moindre échec. Les deux sont
  maintenant conditionnés au premier chargement ;
- `index.tsx` effaçait sa carte sur un échec de lecture. Au retour, une carte
  correcte reste en place : un réseau tombé ne la rend pas fausse.

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
