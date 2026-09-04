# P1-001e — Apparence de la box

**Phase** P1 · **Estimation** 1 j·h · **Dépend de** P1-001a · **Spec** §5.2, §11.2, §12.2

## Pourquoi ce n'est pas cosmétique

`create_tenant()` insère `primary_color` à **`#E4572E` en dur** — une couleur
d'exemple de la spécification. Aucune box ne peut changer la sienne : la table
`themes` a ses policies, ses droits et son thème SSR, mais **aucun écran ne
l'écrit**.

Le produit dont l'argument numéro un est « votre app, à vos couleurs » ne sait
pas les changer. C'est le même motif que l'écran de connexion manquant : une
moitié posée, sa jumelle jamais écrite.

Et c'est le seul ticket qui **actionne** le code de correction de contraste posé
en P0-002 — `ensureContrast()`, `pickOnColor()`, `meetsContrast()` ont leurs
tests unitaires mais n'ont jamais vu une couleur choisie par un humain.

**À faire avant la première démo à un propriétaire**, pas après.

## Périmètre

- Écran `/box/[slug]/apparence` : couleur primaire, nom d'app, rayon, police.
  **Le logo part en P1-001f** : c'est le premier usage de Storage, donc le pilote
  de toute la couche fichiers — bucket, policies, limites, et la question que
  tout le monde oublie, qui supprime l'ancien fichier. Le concevoir ici, c'est le
  concevoir distrait.
- **OWNER seul** : la spec §5.2 exclut explicitement le gestionnaire du
  white-label, et la policy `themes_update` le fait déjà.
- Aperçu en direct des tokens dérivés, avec le **ratio de contraste affiché** et
  un avertissement quand la couleur choisie oblige `ensureContrast()` à corriger.
- **Deux constantes séparées.** `DEFAULT_BRAND.primary` (la couleur de Rack,
  avant qu'une box soit résolue) et le défaut de `themes.primary_color` (le point
  de départ d'une box neuve) partageaient le même littéral : impossible de savoir,
  en regardant un écran, si on voyait « la plateforme faute de box » ou « cette
  box, au défaut ». Le second devient un **gris ardoise** — un neutre dit « pas
  encore configuré », ce qui est exact et appelle l'action.

  Pas une teinte dérivée du slug : une couleur calculée est assez spécifique pour
  avoir l'air choisie, et « pourquoi ma box est turquoise ? » n'a pas de bonne
  réponse.

## Ce que ce ticket n'a pas eu besoin de faire

**Aucune migration de structure.** `app_name`, `primary_color`, `radius` et
`font` existent sur `themes` depuis P0-004, avec leurs contraintes ; la policy
`themes_update` était déjà réservée à l'OWNER, et les droits posés. Vérifié
avant d'estimer, pas supposé. La seule ligne de SQL du ticket est le changement
de défaut ci-dessus.

## Critères d'acceptation

- [x] Un OWNER change la couleur de sa box, et **la coquille du back-office
      comme la page publique d'invitation** se repeignent — couleur, police et
      rayon compris. C'est la promesse white-label rendue observable.
- [x] Un MANAGER n'atteint pas l'écran : pas d'entrée de navigation, et une
      phrase s'il force l'URL
- [x] Une couleur à faible contraste est acceptée, **enregistrée telle quelle**,
      et signalée : `#f2e94e` donne 1,3:1 en clair, l'écran annonce `#7f7909`
      (4,5:1) et explique pourquoi
- [x] Le thème par défaut d'une box nouvellement créée cesse d'être la couleur
      d'exemple de la spec (test pgTAP)
- [x] **L'app mobile** prend la couleur au chargement suivant — passe sur appareil du **4 septembre 2026** — iPhone 12 Pro Max, Expo Go, Expo SDK 57.
      L'écran de bienvenue ouvert sur `/invitation/inv-rueil-0001` s'affiche à
      l'orange de CF Rueil, **avant toute connexion**, et l'accueil la garde
      après. La couleur vient de `themes` en base, via `invitation_preview()`.

      Le **contrôle négatif** fait partie du critère : `/welcome` sans jeton est
      graphite. Tant que la marque de la plateforme partageait la couleur de
      Rueil, cocher cette ligne n'aurait rien prouvé — les deux écrans étaient
      identiques.

### Une correction au cahier des charges

`/login` **n'est pas** dans la liste des écrans qui se repeignent. Il n'a pas de
box dans son URL, donc pas de box à résoudre : il porte la marque **plateforme**,
par construction. Les trois écrans brandés sont la coquille `/box/[slug]/…`, la
page `/invitation/[token]`, et l'accueil mobile via `tenant_public_profile()`.
