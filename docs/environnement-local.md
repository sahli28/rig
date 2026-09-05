# Pièges d'environnement — la machine de développement

Ce fichier ne décrit pas comment démarrer le projet (c'est le `README.md`) mais
**ce qui casse en chemin**, et qui n'a rien à voir avec le code.

Il est lié depuis `CLAUDE.md` et le `README.md` pour une raison précise : ces
pièges frappent **avant** qu'on ouvre un fichier. Les mettre dans
`.claude/rules/` les aurait enterrés — ces fichiers portent un `paths:` et ne se
chargent qu'à l'ouverture d'un fichier qui correspond. Aucun glob ne déclenche
« Docker n'est pas sur le PATH ».

---

## Docker n'est pas sur le PATH de la session Claude

Préfixer les commandes qui en ont besoin :

```bash
export PATH="$PATH:/c/Users/sahli/AppData/Local/Programs/DockerDesktop/resources/bin"
```

Docker Desktop s'installe **par utilisateur** sous Windows. Fraîchement
installé, un terminal déjà ouvert ne le verra pas : son PATH est figé au
démarrage.

## Les ports Supabase sont décalés

Windows réserve la plage TCP 53979–54478, qui avale les six ports habituels.
Tout est décalé de 543xx vers 553xx dans `supabase/config.toml` — **le tableau
des ports est dans le `README.md`, section « Démarrer »**, et il n'est pas
recopié ici pour qu'il n'existe qu'à un endroit. Les deux à retenir : API
**55321**, Mailpit **55324**.

## Le port 3000 n'est pas interchangeable

`supabase/config.toml` fixe `site_url = "http://127.0.0.1:3000"`, et
`additional_redirect_urls` déclare `localhost:3000` **et** `127.0.0.1:3000`, en
`http`. D'où `"autoPort": false` dans `.claude/launch.json`.

Un `next dev` resté ouvert d'une session précédente occupe le port : **l'arrêter,
ne pas déplacer le serveur.** Un serveur déplacé sur 3001 démarre très bien et
casse la connexion au moment du retour de lien, loin de la cause.

## Les clés Supabase ont changé de format

Le CLI expose `sb_publishable_…` et `sb_secret_…`, plus les JWT `anon` /
`service_role`. La clé **publishable** va dans `*_SUPABASE_ANON_KEY` et
fonctionne telle quelle — vérifié sur le parcours web complet, ni montée de
version ni clés héritées nécessaires. Le détail des variables est dans le
`README.md`, section « Variables d'environnement ».

## Après un `db:reset`, la session du navigateur est morte

Et la première requête peut échouer en `PGRST303 « JWT issued at future »` :
décalage d'horloge entre le conteneur Postgres et l'hôte. Se reconnecter, ou
attendre quelques secondes et recharger.

## Expo réécrit `apps/mobile/tsconfig.json`

À chaque `expo start`, et il ne se contente pas de reformater : il **retire**
`.expo/types/**/*.ts` et `expo-env.d.ts` de l'`include`, ce qui prive le
typecheck des types générés du routeur. Vérifier `git status` après avoir lancé
Expo — la procédure complète est dans `docs/passe-mobile-iphone.md`, section 6.

## Le harnais mobile en préréglage « mobile » : les clics expirent

Après `resize_window` en préréglage **mobile**, les clics du harnais expirent au
bout de trente secondes sur les écrans React Native Web — alors qu'ils
**atteignent bien la cible** : l'état change, c'est l'attente de stabilité de
l'outil qui échoue. Le préréglage mobile active l'émulation tactile, et RN Web
n'émet pas le signal attendu.

Symptôme trompeur : on croit à un écran figé, on cherche un défaut dans son code.
Le contrôle qui tranche en dix secondes — `get_page_text` juste après le clic
qui a « échoué » : si l'état a changé, le clic est passé.

La règle qui évite le détour : **vérifier le fonctionnement en taille bureau, et
l'apparence en taille mobile.** Trouvé en P1-011, une demi-heure perdue.

## Git Bash

- **`UID` est en lecture seule.** Un script qui l'utilise comme nom de variable
  échoue sur un message trompeur : `invalid input syntax for type uuid`.
- **Un antislash doublé perd sa doublure.** Un `\\` écrit dans une commande
  arrive dans le fichier comme un `\` simple. Conséquence vicieuse : un
  `\\d` destiné à une expression régulière JavaScript y devient `\d`, donc
  la lettre `d` dans la regex — qui compile, et ne correspond plus à rien.
  Écrire `[0-9]` plutôt que `\d` dans tout script généré depuis le shell,
  et `String.fromCharCode(92)` quand il faut vraiment un antislash. Cette
  phrase elle-même a dû être réécrite deux fois pour cette raison.
- **`node -e "…writeFileSync('/tmp/x')"` écrit dans `C:\tmp`**, pas là où Git
  Bash lit `/tmp`.
- **`$TMPDIR` n’est pas défini.** `cat > "$TMPDIR/x.mjs"` écrit donc dans
  `/x.mjs`, c’est-à-dire **à la racine d’installation de Git**
  (`C:\devtools\Git`). Quatorze scripts jetables y ont atterri en une séance,
  sans qu’aucune commande n’échoue. Écrire le chemin en toutes lettres.

## pnpm

Installé au niveau utilisateur : `corepack enable` échoue faute de droits admin.

**Un `pnpm add` interrompu laisse l'arbre à moitié détruit.** Symptôme :
`ERR_PNPM_ENOENT … scandir 'node_modules/<paquet>_tmp_<pid>/node_modules'`, qui
revient à chaque tentative en changeant de paquet. Ce qu'il faut regarder :

```bash
ls node_modules/.pnpm | wc -l      # doit valoir des centaines, pas 1
```

Si le magasin virtuel `.pnpm` est vide alors que `node_modules` est plein, tous
les liens pendent dans le vide et **aucun `pnpm install` ne s'en remet** : il
bute sur un dossier réel laissé par le `_tmp_` de la fois précédente. Retirer
les `node_modules` (racine **et** paquets) et réinstaller depuis le lockfile —
35 s, et rien n'est perdu :

```bash
node -e "for (const d of ['node_modules','apps/mobile/node_modules','apps/web/node_modules','packages/core/node_modules','packages/ui/node_modules']) require('node:fs').rmSync(d,{recursive:true,force:true})" && pnpm install
```

`--force`, `--package-import-method=copy` et la suppression des seuls dossiers
`_tmp_` ont tous été essayés : aucun ne suffit.

---

## Deux pièges de code qui ne se voient qu'à l'exécution

Ils vivaient ici parce que rien d'autre ne les portait. Ils ont désormais leur
place là où un glob les charge au bon moment, et ne sont rappelés ici que pour
mémoire :

- **un fichier `'use server'` ne peut exporter que des fonctions asynchrones** —
  `.claude/rules/ui.md` ;
- **`tenantScope().select()` ne prend pas de liste de colonnes** —
  `.claude/rules/api.md`.
