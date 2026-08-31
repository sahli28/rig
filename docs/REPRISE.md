# Point de reprise — 31 août 2026

**P0-005a est fusionné** (PR #6, merge commit `c25b810`). Il reste deux
vérifications à faire passer avant de considérer le ticket clos ; elles sont
dans `docs/backlog/P0-005a-connexion.md`, cases non cochées.

Ce fichier disparaît quand ces deux cases sont cochées — avec le paragraphe de
`CLAUDE.md` qui y renvoie.

---

## 1. Ce qui reste sur P0-005a

### a. Créer les deux `.env.local` — préalable à tout le reste

Claude ne peut pas les écrire : la règle `deny` de `.claude/settings.json` couvre
tout fichier `.env*`. Contenu exact dans le README, section « Variables
d'environnement ». **Deux fichiers** : Expo et Next lisent le dossier de leur
app, pas la racine du monorepo.

### b. Passer le parcours sur appareil

L'app mobile n'a **jamais démarré** — ni appareil, ni simulateur, ni web. Elle
typecheck et elle lint ; les quatre écrans, les deux fournisseurs de contexte et
l'aiguillage de `_layout.tsx` n'ont jamais exécuté une ligne. Ce qui a été
vérifié de bout en bout, ce sont les appels HTTP à la base, pas le code React qui
les appelle.

Les trois choses à surveiller, dans l'ordre de probabilité :

1. l'aiguillage `useAuthRedirect` — `router.replace` dans un effet, sur des
   routes du groupe qui déclenche l'effet. Les dépendances ont été relues, ça ne
   devrait pas boucler ;
2. `signInWithOtp` sous React Native, si l'`URL` de Hermes ne suffit pas. C'est
   là que `react-native-url-polyfill` se décide — volontairement pas ajouté
   d'avance : RN 0.86 pourrait n'en avoir plus besoin ;
3. l'écriture réelle dans le trousseau. Le découpage est testé en pur, la liaison
   `expo-secure-store` ne l'est pas.

Sur téléphone, `127.0.0.1` désigne le téléphone : mettre l'IP de la machine sur
le réseau local dans `EXPO_PUBLIC_SUPABASE_URL`. Next l'annonce au démarrage
(`Network: http://…:3000`) — au 31 août, `192.168.1.133`.

Un passage en **web Expo** (`pnpm --filter @rig/mobile dev` puis `w`) exerce le
routeur, les fournisseurs et les écrans sans appareil, avec le repli
`localStorage`. Ça élimine (1), pas (2) ni (3).

### c. Tester le chemin d'authentification web

Le même e-mail porte un **lien**, que le web consomme (`detectSessionInUrl`
actif + middleware de rafraîchissement). Deux chemins d'authentification, donc
deux à tester : sans cette ligne, seul celui du quotidien serait vérifié et
l'autre casserait en silence.

---

## 2. Pièges d'environnement

**Docker n'est pas sur le PATH** de la session Claude. Préfixer :

```
export PATH="$PATH:/c/Users/sahli/AppData/Local/Programs/DockerDesktop/resources/bin"
```

Docker Desktop s'installe **par utilisateur** sous Windows
(`AppData\Local\Programs`), pas dans `Program Files`.

**Ports Supabase décalés** (Windows réserve 53979–54478) : API 55321, base 55322,
Studio 55323, **Mailpit 55324** — c'est là qu'arrivent les codes de connexion.
Détail dans le README.

**Le port 3000 n'est pas interchangeable** : `supabase/config.toml` fixe
`site_url = "http://127.0.0.1:3000"`, allow-list de redirection de
l'authentification. D'où `"autoPort": false` dans `.claude/launch.json`. Si un
`next dev` lancé à la main l'occupe, l'arrêter plutôt que déplacer le serveur.

**Git Bash** : `UID` est en lecture seule — un script de test qui l'utilise comme
nom de variable échoue sur un message trompeur
(`invalid input syntax for type uuid: "197609"`). Et `node -e "…writeFileSync('/tmp/x')"`
écrit dans `C:\tmp`, pas là où Git Bash lit `/tmp`.

**pnpm** est installé au niveau utilisateur (`corepack enable` échoue faute de
droits admin sur `C:\Program Files\nodejs`).

---

## 3. Ensuite

**P0-005b — SSO Google**, 4 j·h. Deux prérequis administratifs qui ne se
rattrapent pas :

1. **Programme développeur Apple** — 99 $/an, délai d'enrôlement variable.
   Câbler Google engage sur Apple avant la soumission (guideline 4.8).
   Voir `docs/backlog/P2-003-sign-in-apple.md`.
2. **Identifiants OAuth Google** — trois `client_id` (web, iOS, Android). URI de
   redirection **exactement** `http://127.0.0.1:55321/auth/v1/callback` en local :
   Google exige la correspondance au caractère près, et `localhost` n'est pas
   `127.0.0.1` pour lui.

Dettes ouvertes : **D-001 à D-008**, dans `docs/backlog/README.md`. D-001 (vue
restreinte des membres) est **bloquante pour P1-001**. D-004 (langue) ne l'est
plus : elle attendait le profil serveur, que P0-005a livre.
