# D-009 — La navigation mobile : en-tête, historique, et retours interdits

**Phase** dette · **Estimation** 1 j·h · **Origine** passe sur appareil du 3 septembre 2026 · **Dépend de** P0-005a ✅

> **À traiter avant P1-002b.** C'est de la navigation : chaque écran ajouté
> multiplie les chemins de retour, donc le coût du correctif. Trois écrans
> aujourd'hui, huit après P1-002b et P1-003b.

## Le défaut, tel qu'il se produit

Deux causes qui se rencontrent :

1. **La pile affiche l'en-tête par défaut d'expo-router.** `_layout.tsx` passe
   des `screenOptions` de couleur et de police, mais ne dit jamais quels écrans
   ont un titre, lequel, ni s'ils ont un bouton retour. Chaque écran hérite donc
   d'un chevron et d'un titre technique — la passe a relevé `(app)/index` en
   titre d'écran d'accueil.

   **Précision trouvée en corrigeant** : cinq écrans sur six déclaraient bien
   `headerShown: false`. Seul l'accueil ne disait rien. Le défaut n'est donc pas
   « personne ne déclare » mais « la convention repose sur la mémoire, et elle
   tombe au premier oubli » — ce qui change le correctif : un défaut sûr, pas un
   rappel de plus ;
2. **les redirections d'aiguillage ne vident pas l'historique.**
   `useAuthRedirect` utilise `router.replace()`, qui remplace l'entrée courante
   mais laisse celles d'avant. Après `welcome → auth → profile-setup →
   consents → /`, la pile garde des écrans que l'aiguillage refusera.

Résultat observé : on touche le chevron, on revient sur un écran interdit,
`useAuthRedirect` refoule immédiatement, et le chevron disparaît. Rien ne
plante, mais l'app se contredit sous le doigt — et c'est le genre de détail qui
fait douter du reste.

## Pourquoi maintenant, et pas « quand ça gênera »

Parce que le coût monte avec le nombre d'écrans, pas avec le temps. La règle
d'aiguillage est aujourd'hui lisible d'un coup d'œil dans une seule fonction ;
elle le restera si on la corrige à trois écrans, beaucoup moins à huit. P1-002b
en ajoute deux et P1-003b trois de plus.

C'est aussi le seul défaut de la passe qui **empire tout seul**.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `useAuthRedirect()` — la règle d'aiguillage, en un seul endroit | `apps/mobile/app/_layout.tsx` | ✅ existe, et c'est ce qui rend le correctif petit |
| Les groupes de routes `(auth)` et `(app)` | `apps/mobile/app` | ✅ existent |
| `Stack.Screen options` par écran | expo-router | ✅ disponible — déjà utilisé pour `headerShown: false` sur trois écrans, un par un |
| Des titres d'écran traduits | `fr.json` / `en.json` | ✅ **existent déjà** — ce ❌ était faux. `design_system.title` est en place depuis P0-002, et l'écran s'en sert. Aucune clé nouvelle n'a été nécessaire : le seul écran à en-tête avait déjà le sien |
| Un écran avec un vrai retour légitime | — | ❌ aucun aujourd'hui. Le premier sera le détail d'un cours (P1-003b) : ce ticket doit donc **poser la convention**, pas seulement éteindre les chevrons |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| La convention d'en-tête et de retour de la pile | tout écran mobile ajouté après | P1-002b, P1-003b, P1-009 |
| Un aiguillage qui ne laisse pas d'écran interdit derrière lui | idem | idem |

## Périmètre

- **Chaque écran déclare son en-tête** : masqué, ou avec un titre traduit. Plus
  aucun titre technique tiré du nom de fichier.
- **L'aiguillage ne laisse rien derrière lui.** Un passage d'un groupe à
  l'autre — `(auth)` → `(app)` — repart d'une pile vide, plutôt que d'empiler
  un `replace` sur des écrans devenus interdits.
- La convention est écrite dans `.claude/rules/ui.md`, pour que l'écran suivant
  la suive sans la redécouvrir.

## Hors périmètre

- **Une barre d'onglets.** Elle se décide quand il y aura de quoi la remplir —
  planning, réservations, compte — donc après P1-003b. La poser maintenant
  reviendrait à dessiner la navigation d'un produit qu'on n'a pas encore.
- L'entrée du sélecteur de box dans l'en-tête : **P1-009**, qui attend ce
  ticket.
- Les transitions et animations : rien n'a été signalé.

## Critères d'acceptation

- [x] Aucun écran n'affiche un titre tiré d'un nom de fichier — vérifié sur
      `pnpm --filter @rig/mobile web` : le bandeau `(app)/index` a disparu de
      l'accueil, et l'écran du système de design garde le sien, traduit
- [x] **Aucun nom de route ne subsiste dans l'arbre d'accessibilité** — critère
      ajouté en cours de route, parce que le harnais a trouvé la rémanence :
      `headerShown: false` masque l'en-tête mais laisse le routeur employer le
      nom de route comme titre, et le bouton retour de l'écran suivant
      s'annonçait « (app)/index, back ». Il dit désormais « CF Rueil, back »
- [x] Après connexion, la pile ne contient plus `welcome`, `auth`,
      `profile-setup` ni `consents` — parcours complet rejoué depuis
      `/invitation/inv-rueil-0001` sur seed neuf ; le retour laisse sur l'accueil
      au lieu de rebondir sur l'écran de bienvenue
- [x] Le premier écran à retour légitime (détail d'un cours, P1-003b) trouve la
      convention écrite — `.claude/rules/ui.md`, section « La convention de
      navigation mobile »
- [ ] **Vérifié sur appareil** : le balayage iOS et le bouton retour Android ne
      se testent pas au navigateur. C'est le seul critère qui reste, et il tient
      dans la prochaine passe — § 5 bis de `docs/passe-mobile-iphone.md`

## Notes

**Ce que le harnais web prouve, et ce qu'il ne prouve pas.** Il exerce le
routeur, donc l'en-tête, le titre, l'arbre d'accessibilité et l'état de la pile
après redirection — c'est lui qui a trouvé la rémanence du nom de route. Il
n'exerce ni le balayage iOS ni le bouton matériel Android, qui restent le
dernier critère.

**Ce n'est pas un défaut de sécurité.** `useAuthRedirect` refoule bien, et les
policies refusent de toute façon — un retour sur `/consents` ne montre aucune
donnée. C'est un défaut de justesse : l'app propose un geste puis le reprend.

Le lien avec P1-009 vaut d'être noté : le sélecteur de box a besoin d'un endroit
où vivre, et cet endroit est l'en-tête. Faire D-009 en premier lui donne sa
place ; l'inverse ferait poser un menu sur un en-tête qu'on refera juste après.
