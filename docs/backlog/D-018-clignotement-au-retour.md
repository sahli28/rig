# `D-018` — L'écran entier se recharge au retour sur le planning

**Phase** `dette` · **Estimation** `1` j·h *(0,5 à l'ouverture — recompté, voir l'arbitrage)* · **Origine** passe mobile du 6 septembre 2026, scénario C de P1-012 · **Spec** §12.1 (principe 3) · **✅ clos le 6 septembre 2026**

## Issue — arbitré le 6 septembre 2026

**La cause est trouvée et corrigée** (PR #48). `useFocusEffect` ne rejoue pas
seulement l'effet au retour du focus : il le rejoue **chaque fois que sa
callback change d'identité**. Elle dépendait de `chargerJour` et
`chargerReserves`, recréées à chaque changement de jour — donc changer de jour
déclenchait la lecture du jour, **puis aussitôt une seconde lecture silencieuse
du même jour**. Deux requêtes, deux `setEtat` portant un `schedule` neuf coup
sur coup : la liste était remplacée deux fois de suite, ce qui se voit même sans
squelette. Un `ref` tenu hors de l'identité de la callback rend à l'effet ce
qu'il prétend écouter : le focus, et rien d'autre.

**Le rechargement résiduel, s'il en reste un, est accepté et ne sera pas
chassé.** Décision de la commanditaire : le symptôme ne la gêne pas, et le coût
de la chasse a dépassé l'enjeu — deux tours de mesure et deux passes sur
appareil pour un défaut cosmétique, face à 30 j·h restants au jalon. Même forme
que l'arbitrage de `D-010`.

**Ce que la décision accepte de ne pas couvrir**, et il faut le lire avant de
rouvrir le sujet un jour :

- la confirmation sur appareil que le rechargement a disparu — non faite,
  assumée ;
- le `DÉMONTAGE planning` isolé du premier journal, jamais expliqué. Il a un
  effet propre, **le jour sélectionné perdu au retour** (`date` repassée de
  09-09 à 09-06). Observé une fois. S'il se reproduit, c'est un ticket à lui,
  pas une reprise de celui-ci.

## ✅ Les sondes sont retirées — le ticket est clos

PR #48 avait fusionné **l'instrument avec le correctif**. `main` a donc porté
pendant quelques heures, non gardées par `__DEV__` :

- une dizaine de `console.log('[D-018] …')` dans `planning.tsx`, `_layout.tsx`
  et `lib/session.tsx` ;
- le module `apps/mobile/lib/trace-deps.ts`, dont l'en-tête disait lui-même
  « **TEMPORAIRE — à retirer avec le correctif** ».

Deux raisons de ne pas laisser ça, et la seconde n'était pas cosmétique :

1. le dépôt a déjà la convention — `class/[id].tsx:285` écrit
   `if (__DEV__) console.log(...)` ;
2. **ces traces écrivaient `userId` et `activeTenantId` dans les journaux de
   l'appareil.** Des identifiants de personnes dans un log non gardé, sur la
   branche qui part chez une box.

Retirées le 6 septembre 2026, **avant P1-005** : les dix `console.log`, le
module `trace-deps.ts`, les deux effets de montage/démontage, les deux `ref`
d'instrumentation du focus, et les dépendances que la sonde avait ajoutées à
l'effet de chargement — il est revenu à `[chargerJour]`. **Le correctif reste
entier**, `lectures` et son commentaire compris : c'est lui qui porte la cause.

**La leçon d'outillage, et elle vaut pour la prochaine sonde** : une mesure et
son correctif ne devraient pas voyager dans la même PR. Ici l'instrument a été
gardé volontairement après le correctif, en attendant une passe qui n'aura pas
lieu — et c'est ce « volontairement » qui l'a fait fusionner. La règle simple :
si une sonde doit survivre à sa PR, elle porte `__DEV__` **dès la première
ligne** ; sinon elle part avec le correctif, dans le même commit.

## Ce qu'il reste, et qui n'est plus de ce ticket

Rien à faire. Deux choses sont **écrites pour ne pas se redécouvrir** :

- le doublon de focus vu sur appareil, sans cause établie — couvert par
  l'arbitrage ci-dessus, qui accepte le rechargement résiduel ;
- le `DÉMONTAGE planning` isolé et son effet propre (jour sélectionné perdu au
  retour). **S'il se reproduit, il prend son ticket**, il ne rouvre pas
  celui-ci.

## La leçon, à garder

Un défaut qui ne se reproduit **que sur l'appareil** coûte cher par nature :
chaque hypothèse fait un aller-retour par une passe manuelle. Ce genre de ticket
mérite un **plafond décidé à l'ouverture**, pas découvert au troisième tour.
Celui-ci a été plafonné après coup ; le prochain le sera avant.

## Le symptôme, et le test qui l'a coupé en deux

Réserver ou annuler depuis la fiche de cours, puis revenir sur le planning.

| Mode | Ce qu'on voit |
| ---- | ------------- |
| **Clair** | **Toute la page se recharge** — pas un clignotement, un rechargement visible. Le bouton retour, lui, ne bouge pas |
| **Sombre** | Le même rechargement, **plus** le bouton retour (« ‹ CF Nanterre ») qui clignote en blanc |

Le test en mode clair a été fait le 6 septembre 2026, et c'est lui qui rend ce
ticket lisible : **le rechargement est indépendant du thème, le clignotement du
bouton ne l'est pas.**

## La chaîne, et elle explique les deux

Un seul événement, deux conséquences visibles :

**1. Quelque chose remonte l'arbre au retour sur le planning.**

C'est ce qui produit le rechargement, dans les deux modes, et le raisonnement
est mécanique :

- au remontage, `premierPassage` (`planning.tsx:281`) repart à `true` ;
- le `useFocusEffect` se saute donc lui-même, croyant être au premier passage ;
- et l'effet de montage (`planning.tsx:206`) appelle `chargerJour()` **sans**
  `silencieux` → `setEtat({ phase: 'chargement', schedule: null })` → le
  squelette, c'est-à-dire le rechargement visible.

Autrement dit : **le chemin silencieux de P1-012 est correct et n'est jamais
emprunté.** Le garde-fou du premier passage, écrit pour éviter une double
lecture au démarrage, devient au remontage ce qui désactive la relecture
silencieuse. Chercher le défaut dans `chargerJour` ou dans le `silencieux` ferait
perdre une session.

**2. Le même remontage remet le thème en clair, le temps d'une image.**

```ts
const dernierScheme = useRef<ColorScheme>(INITIAL_SCHEME);  // 'light'
```

`useRef` ne survit pas à un remontage (`_layout.tsx:151`). Sur un écran sombre,
la première image repart donc en clair — et ce qui se voit le mieux est
l'en-tête natif, donc le bouton retour. **C'est exactement pourquoi ça ne se voit
qu'en sombre** : en clair, la valeur de repli est déjà celle qu'on affiche.

Le commentaire qui justifie `INITIAL_SCHEME = 'light'` dit « ce cas-là ne
clignote pas : il n'y a pas encore d'écran affiché à contredire ». **Vrai au
démarrage à froid, faux à un remontage.**

## Ce que ça dit de `D-017`

`D-017` (PR #43) traitait ce clignotement de bouton et portait une réserve
explicite : « **Non vérifié sur appareil** […] la disparition du clignotement ne
l'est pas ». La passe du 6 septembre la contredit.

**Le correctif reste juste et ne doit pas être annulé** : `useColorScheme()` est
déclarée non-nullable et rend `null` à l'exécution, `'unspecified'` veut dire
« suis le système ». Ces deux portes-là sont bien fermées. Il en restait une
troisième — le remontage — que rien dans ce fichier ne pouvait voir, parce que la
cause n'est pas dans le thème.

## Ce qu'il faut trouver, et la mesure qui le donne

**Ce qui remonte.** Ce n'est pas établi, et c'est le seul vrai travail du ticket.

La mesure, avant toute hypothèse : une trace dans l'effet de montage du planning
(`planning.tsx:206`) et une sur chaque changement de `status` de la session. Si
la trace de montage se rejoue au retour, le remontage est confirmé et il ne reste
qu'à remonter la pile.

Deux candidats connus, à écarter ou à confirmer par la mesure :

- **L'écran de chargement plein cadre** (`_layout.tsx:83`) : dès que
  `status === 'loading'`, tout l'arbre est remplacé par un `ActivityIndicator`.
  C'est la seule chose du dépôt qui peigne toute la surface, et en sortir
  **remonte** ce qu'elle avait remplacé. À la lecture, `load()`
  (`session.tsx:70`) ne remet jamais `status` à `loading` — donc à confirmer,
  pas à supposer.
- **`onAuthStateChange` qui rappelle `load()`** (`session.tsx:111`) à chaque
  rafraîchissement de jeton, avec `setMe()` et `setActiveTenantId()` sur des
  objets neufs. Aucun `key=` ne pilote de remontage dans `_layout.tsx` — vérifié
  — donc si remontage il y a par ce chemin, il vient d'un rendu conditionnel.

## ✅ La mesure du 6 septembre 2026 — trois candidats morts

**Passe sur appareil, scénario C, console Metro.** Écrit ici et pas seulement
dans un message : un candidat écarté qui ne vit nulle part se re-suspecte, et
c'est la partie la plus durable de cette mesure.

| Candidat | Verdict | Ce que dit le journal |
| -------- | ------- | --------------------- |
| L'écran plein cadre (`_layout.tsx:83`) | **mort** | Ses trois occurrences sont **toutes au démarrage**, avant `session status = ready`. Aucune au retour |
| Un remontage de `SessionProvider` | **mort** | **Un seul** `MONTAGE SessionProvider`, au démarrage |
| `enLigne` qui bascule | **mort** | `enLigne: true` sur **chacune** des traces de dépendances |

**Et le remontage lui-même n'a pas lieu.** Sur le retour après réservation : ni
`DÉMONTAGE planning`, ni `MONTAGE planning`, ni `effet chargerJour`. Seul le
chemin silencieux s'exécute. **La chaîne décrite plus haut est donc réfutée sur
ce parcours** — elle reste juste comme mécanisme (un remontage produirait bien
tout cela), elle n'est simplement pas ce qui se produit ici.

Une correction au passage, sur le raisonnement et non sur le verdict : le ticket
écrivait que `load()` ne remet jamais `status` à `loading`, donc que le candidat
était « à confirmer ». C'est vrai de `load()` et insuffisant — `useState('loading')`
s'exécute à **chaque montage** du fournisseur. Le mécanisme était donc plus large
que décrit ; la mesure a montré que le fournisseur ne remonte pas, ce qui clôt le
sujet par l'autre bout.

## 🔴 Ce que la mesure a trouvé à la place : le focus se déclenche **deux fois**

Systématiquement, dans les deux journaux, à chaque retour :

    [D-018] useFocusEffect — premierPassage = false
    [D-018] useFocusEffect — premierPassage = false

Donc **deux `chargerJour(true)` consécutifs**, deux requêtes, et deux `setEtat`
portant un objet `schedule` neuf coup sur coup. Une liste remplacée deux fois de
suite se voit, **même sans squelette** — et c'est l'explication qui restait à
trouver pour un rechargement visible sans remontage.

Le journal montre aussi **où** le doublon ne vient pas de nulle part : le
`useFocusEffect` se rejoue après **chaque** `effet chargerJour`, c'est-à-dire à
chaque changement de jour. Sa callback dépend de `chargerJour` et de
`chargerReserves` ; React Navigation ré-exécute un effet de focus quand sa
callback change d'identité. Reste à établir laquelle des deux change au
**retour**, où aucun `effet chargerJour` n'est journalisé — ou si le focus est
réellement émis deux fois par la navigation.

**Pas de garde par-dessus.** Une garde sur un double appel dont on ignore la
cause est une rustine, et elle masquerait le prochain.

### ✅ Une cause trouvée et corrigée : la callback de focus changeait d'identité

Mesuré au harnais, le 6 septembre 2026, sur un **changement de jour** :

    effet chargerJour — a changé : date
    chargerJour(2026-09-07) — SQUELETTE POSÉ (silencieux=false)
    FOCUS #2 — callback recréée par : chargerJour, chargerReserves
    chargerJour(2026-09-07) — RELECTURE SILENCIEUSE, aucun squelette

`useFocusEffect` ne rejoue pas seulement l'effet quand l'écran reprend le focus :
il le rejoue **chaque fois que sa callback change d'identité**. Elle dépendait de
`chargerJour` et `chargerReserves`, recréées à chaque changement de jour. Donc
changer de jour déclenchait la lecture du jour, **puis aussitôt une seconde
lecture silencieuse du même jour** — deux requêtes, deux `setEtat` portant un
`schedule` neuf coup sur coup, et une liste remplacée deux fois de suite.

**Corrigé à la cause** : les deux lectures passent par un `ref` mis à jour à
chaque rendu, et la callback de focus a des dépendances **vides**. L'effet ne se
déclenche plus que sur ce qu'il prétend écouter — le focus. Pas une garde sur le
second appel : le second appel n'a plus lieu d'être.

Après correctif, au harnais, un changement de jour donne :

    effet chargerJour — a changé : date
    chargerJour(2026-09-07) — SQUELETTE POSÉ (silencieux=false)

et un retour donne exactement un focus et une relecture silencieuse.

### ⏳ Ce qui reste ouvert, et ce que la prochaine passe dira toute seule

**Le doublon de l'appareil n'est pas expliqué par celui-ci.** Au harnais, le
focus se déclenche **une fois** par retour, avant comme après le correctif ; sur
l'appareil il se déclenchait **deux fois**, sans changement de jour. Ce sont deux
déclencheurs différents, et il en reste un.

L'instrument tranche désormais sans qu'on ait à interpréter :

| Ce que la prochaine passe affichera | Ce que ça veut dire |
| ----------------------------------- | ------------------- |
| Un seul `FOCUS #n` par retour | le doublon de l'appareil avait la même cause, c'est réglé |
| Deux `FOCUS #n`, tous deux « **rien — même identité** » | React Navigation **émet réellement le focus deux fois** sur iOS. Le correctif est alors au niveau navigation, pas dans cet écran |
| Deux `FOCUS #n` dont un « recréée par : … » | une dépendance bouge sur l'appareil et pas au harnais — la ligne la nomme |

Et surtout, la question qui manquait à la mesure précédente a maintenant sa
réponse dans le journal, sans qu'un humain ait à se souvenir de l'écran :

    chargerJour(…) — SQUELETTE POSÉ (silencieux=false)     ← rechargement visible
    chargerJour(…) — RELECTURE SILENCIEUSE, aucun squelette ← pas de rechargement

**Un `SQUELETTE POSÉ` sur un retour est le défaut. Sur un changement de jour,
c'est le comportement voulu.**

## ⚠️ Un défaut distinct, observé une fois, à ne pas absorber ici

Le premier journal portait un `DÉMONTAGE planning` isolé, apparu après la toute
première réservation et **jamais reproduit** sur les cinq suivantes. Il a un effet
visible propre : ce remontage a renvoyé l'écran **au jour du jour**, `date`
repassant de `09-09` à `09-06`.

Perdre le jour sélectionné en revenant d'une fiche de cours est un défaut à part
entière, pas une ligne de celui-ci. **S'il se reproduit, il prend son propre
ticket.** Noté ici pour qu'il ne se redécouvre pas depuis zéro.

## La question qu'il faut avoir posée : le rechargement n'est-il pas nécessaire ?

Posée le 6 septembre 2026, et elle mérite sa réponse écrite, sinon quelqu'un
fermera ce ticket en « comportement attendu ».

**Rafraîchir les données est nécessaire. Vider l'écran pour le faire ne l'est
pas.** Ce sont deux choses distinctes, et le code contient déjà la preuve :
`chargerJour(true)` fait **exactement la même requête réseau** que
`chargerJour()` — le drapeau `silencieux` ne garde qu'une seule ligne, le
`setEtat({ phase: 'chargement', schedule: null })`. Les données arrivent pareil ;
seule la liste cesse d'être effacée en attendant.

La distinction que le code encode déjà, et qui est la bonne :

| Situation | L'affichage en place est… | Donc |
| --------- | ------------------------- | ---- |
| **Changement de jour** | **faux** — c'est la liste d'un autre jour | on l'efface, le squelette dit la vérité |
| **Retour sur le même jour** | **vrai**, éventuellement en retard d'une réservation | on le garde et on le remplace quand la donnée arrive |

C'est le principe 3 de la spec (§12.1) : « optimiste, mais honnête ». Effacer une
liste juste pour la réafficher identique à 200 ms près n'informe de rien — ça
signale seulement à la personne que l'app travaille, ce qu'elle n'avait pas
demandé à savoir.

Et le rechargement n'est pas gratuit : il coûte le flash plein cadre **et** la
remise à zéro du thème (le bouton retour en sombre). Deux défauts visibles, pour
un bénéfice nul par rapport au chemin silencieux qui existe déjà.

## Ce qu'il ne faut pas faire

- **Ne pas supprimer le squelette du chargement de jour.** Il a une raison écrite
  (`planning.tsx:160`) : empêcher la liste du jour précédent de survivre au-dessus
  du bandeau du jour suivant. L'ôter échangerait un rechargement contre un
  affichage faux.
- **Ne pas revenir sur `D-017`.** Il corrige un défaut réel et indépendant.
- **Ne pas se contenter de durcir `INITIAL_SCHEME`.** Faire survivre le dernier
  mode connu au remontage (état hors de l'arbre, ou `Appearance.getColorScheme()`
  lu au chargement du module) supprimerait le clignotement du bouton **sans
  toucher au rechargement**, qui est le vrai défaut. C'est une assurance à
  ajouter **en plus** de la correction, jamais à la place.

## Critères d'acceptation

- [x] **La cause est nommée dans ce ticket**, pas seulement corrigée — et le
      remontage lui-même est **réfuté** par la mesure : ce qui se rejouait était
      l'effet de focus, pas le montage. Une cause trouvée et corrigée (la
      callback de focus changeait d'identité) ; **le doublon vu sur appareil
      reste, lui, sans cause établie**
Les quatre critères d'appareil ci-dessous **restent `[ ]` et le resteront** :
l'arbitrage du 6 septembre 2026 les abandonne, il ne les remplit pas. Ils sont
gardés cochables-jamais-cochés pour que la trace soit lisible — un critère effacé
laisserait croire qu'il a été tenu. **Ne pas les cocher un jour parce que le
symptôme aura disparu de lui-même** : personne ne l'aura vérifié.

- [ ] **abandonné** — Réserver depuis la fiche, revenir : la liste se met à jour
      **sans se recharger**, en mode clair comme en mode sombre
- [ ] **abandonné** — Annuler, revenir : idem
- [ ] **abandonné** — En mode sombre, le bouton retour ne clignote plus — **et le
      vérifier après** avoir corrigé le remontage, pas avant : c'est ce qui
      prouve que la cause est traitée et pas seulement masquée
- [ ] **abandonné** — Refaire le retour cinq fois dans chaque mode : un défaut de
      cette famille est intermittent, une observation ne prouve rien
- [x] Le squelette **reste** au changement de jour : c'est un chargement, pas un
      retour — vérifié au harnais après correctif : `SQUELETTE POSÉ` sur le
      changement de jour, `RELECTURE SILENCIEUSE` sur le retour
- [x] Le garde-fou `premierPassage` continue d'éviter la double lecture au
      démarrage à froid — la correction ne doit pas l'échanger contre une lecture
      en double : `FOCUS #1 · premierPassage = true`, puis retour, inchangé

## Notes

Trouvé par une passe manuelle sur un lot dont le compte rendu affirmait le
contraire — « la relecture est silencieuse ». L'affirmation était **vraie du
mécanisme** et **fausse de ce que voit la personne**, parce qu'un remontage rend
le mécanisme inatteignable. C'est la raison d'être des passes, et c'est la
deuxième fois en deux jours qu'un « vérifié au harnais » ne survit pas à un
iPhone.
