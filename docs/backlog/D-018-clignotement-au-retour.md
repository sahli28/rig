# `D-018` — L'écran entier se recharge au retour sur le planning

**Phase** `dette` · **Estimation** `0,5` j·h · **Origine** passe mobile du 6 septembre 2026, scénario C de P1-012 · **Spec** §12.1 (principe 3)

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

- [ ] **La cause du remontage est nommée dans ce ticket**, pas seulement corrigée
- [ ] Réserver depuis la fiche, revenir : la liste se met à jour **sans se
      recharger**, en mode clair comme en mode sombre
- [ ] Annuler, revenir : idem
- [ ] En mode sombre, le bouton retour ne clignote plus — **et le vérifier
      après** avoir corrigé le remontage, pas avant : c'est ce qui prouve que la
      cause est traitée et pas seulement masquée
- [ ] Refaire le retour cinq fois dans chaque mode : un défaut de cette famille
      est intermittent, une observation ne prouve rien
- [ ] Le squelette **reste** au changement de jour : c'est un chargement, pas un
      retour
- [ ] Le garde-fou `premierPassage` continue d'éviter la double lecture au
      démarrage à froid — la correction ne doit pas l'échanger contre une lecture
      en double

## Notes

Trouvé par une passe manuelle sur un lot dont le compte rendu affirmait le
contraire — « la relecture est silencieuse ». L'affirmation était **vraie du
mécanisme** et **fausse de ce que voit la personne**, parce qu'un remontage rend
le mécanisme inatteignable. C'est la raison d'être des passes, et c'est la
deuxième fois en deux jours qu'un « vérifié au harnais » ne survit pas à un
iPhone.
