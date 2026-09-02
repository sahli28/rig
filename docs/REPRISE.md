# Point de reprise — 2 septembre 2026

À lire en premier. Ce fichier disparaît quand la dernière case de
`docs/backlog/P0-005a-connexion.md` sera cochée — avec le paragraphe de
`CLAUDE.md` qui y renvoie.

---

## 1. Où on en est

| | |
| --- | --- |
| `main` | `13f1325` — P0-001 à P0-004, **P0-005a**, **D-001**, **D-006**, **D-005**, **P1-001a**, **P1-001b** fusionnés |
| Branche en cours | `feat/P1-001c-staff-et-roles`, **à pousser et à fusionner** |
| Tests | **266 pgTAP** (16 fichiers) · **207 Vitest** · lint, typecheck, i18n (276 clés), format verts |
| Migrations | 19 |

**Fusionner avec un merge commit, jamais en squash.** Le squash a cassé trois
fois (PR #3, #4, #5) : il coupe le lien d'ascendance et toute branche empilée
part en conflit sur des fichiers pourtant identiques.

## 2. Ce qui reste ouvert, et pourquoi

### Une seule case non cochée sur P0-005a

**La passe sur appareil, via Expo Go.** L'app mobile — quatre écrans, deux
fournisseurs de contexte, l'aiguillage de `_layout.tsx` — **n'a jamais exécuté
une ligne**. Elle typecheck et elle lint, c'est tout. Le critère web, lui, a été
coché : P1-001a a livré l'écran manquant et le parcours a été fait en vrai.

Préalable : **`apps/mobile/.env.local`** (celui du web existe). Contenu dans le
README, section « Variables d'environnement ». Sur téléphone, `127.0.0.1` désigne
le téléphone : mettre l'IP de la machine — Next l'annonce au démarrage, au
1er septembre `192.168.1.133`.

Les trois choses à surveiller, par probabilité décroissante :

1. l'aiguillage `useAuthRedirect` — `router.replace` dans un effet, sur des
   routes du groupe qui déclenche l'effet. Dépendances relues, ça ne *devrait*
   pas boucler ;
2. `signInWithOtp` sous React Native, si l'`URL` de Hermes ne suffit pas. C'est
   là que `react-native-url-polyfill` se décide — volontairement pas ajouté
   d'avance ;
3. l'écriture réelle dans le trousseau. Le découpage est testé en pur, la liaison
   `expo-secure-store` ne l'est pas.

Un passage en **web Expo** (`pnpm --filter @rig/mobile dev` puis `w`) exerce le
routeur, les fournisseurs et les écrans sans appareil. Ça élimine (1), pas (2)
ni (3).

### P0-005b est bloqué, et l'est depuis quatre sessions

Ses quatre critères exigent tous des identifiants qu'il faut demander :

1. **Programme développeur Apple** — 99 $/an, délai d'enrôlement variable. Seul
   élément du chemin critique dont le délai ne se rattrape pas. Câbler Google
   engage sur Apple avant soumission (guideline 4.8).
2. **Trois `client_id` Google** (web, iOS, Android). URI de redirection
   **exactement** `http://127.0.0.1:55321/auth/v1/callback` en local — Google
   compare au caractère près, et `localhost` n'est pas `127.0.0.1` pour lui.

**Le chemin critique est administratif, pas technique.** Les quatre derniers
tickets ont été choisis parce qu'ils étaient le seul travail non bloqué.

### Les `.env.example` restent impossibles

La règle `deny` de `.claude/settings.json` couvre `.env.*`, donc aussi le fichier
d'exemple, en écriture comme en lecture. Correction proposée, non appliquée —
remplacer `"Read(./.env.*)"` et `"Read(./**/.env.*)"` par `"Read(./**/.env)"`,
`"Read(./**/.env.local)"`, `"Read(./**/.env.*.local)"`. En attendant, le README
porte le contenu exact.

### Ce que P1-001b a livré

L'écran `/box/[slug]/reglages` en cinq sections — identité, horaires, salles,
règles de réservation, types de cours — et les deux tables qui manquaient :
`class_types` (que P1-002 attend) et `opening_hours`. Plus
`tenants.default_locale`, exposée par `me()`.

**Le découpage de P1-001 existe enfin en fichiers** : P1-001a à P1-001e et
P2-004 sont dans `docs/backlog/`, et le tableau de son README est à jour. Il ne
vivait jusqu'ici que dans une section du ticket d'origine.

### Ce que P1-001c a livré

L'écran `/box/[slug]/staff` — annuaire, changement de rôle, retrait, invitations
— **et deux choses qui n'étaient pas au programme** :

- **la page publique `/invitation/[token]`**, qui sort D-008 du chemin critique.
  Une invitation s'accepte maintenant dans un navigateur, sans domaine ni compte
  Apple, et le QR mural encode enfin une URL plutôt qu'un jeton de 48 caractères ;
- **le journal d'audit, enfin écrit.** `log_audit()` existait depuis P0-004 sans
  aucun appelant ; les six mutations d'appartenance l'appellent désormais.

Au passage, un cul-de-sac réel : un COACH ou un MEMBER connecté sur le web
n'avait **aucun moyen de se déconnecter** — la coquille, donc le menu de compte,
ne se rend que pour un OWNER ou un MANAGER. Invisible tant que le web n'ouvrait
de session qu'au staff ; la page d'invitation en ouvre à tous les rôles. Le
message « espace réservé au staff » porte maintenant la sortie.

## 3. La suite du backlog

`P1-001` a été ré-estimé et découpé (voir la fin de son fichier) : les 4 j·h
annoncés omettaient la porte d'entrée, la migration `class_types` qui n'existe
pas, et un import CSV qui vaut 2 à 3 j·h seul.

| Ticket | Contenu | j·h |
| --- | --- | ---: |
| ~~P1-001b~~ | réglages box — **fusionné** (PR #12) | 3 |
| ~~P1-001c~~ | Staff & Roles + page d'invitation + journal — **fait**, à fusionner | 3,75 |
| **P1-001d** | Import CSV de membres | 3 |
| **P1-001e** | Apparence de la box — **avant la première démo** : `create_tenant()` fige chaque box sur la couleur d'exemple de la spec, et aucun écran ne l'écrit | 1 |
| **P2-004** | Dashboard box et mise en route — recueille les deux critères orphelins de P1-001 | 4 |

Les dépendances de P1-001c sont **déjà livrées** : D-001 a construit
`member_admin_directory`, D-005 l'API `create_invitation()`. C'était leur raison
d'être.

Dettes ouvertes : **D-002** (tests de rendu), **D-003** (SSR de l'i18n),
**D-004** (langue mobile — plus bloquée, le profil serveur existe), **D-007**
(contraste de la page de démo), **D-008** (deep link, attend un domaine et Apple).

## 4. Ce que P1-001a et P1-001b ont établi, et qu'il ne faut pas re-litiger

- **ADR 0005** : Radix Primitives pour le comportement, CSS Modules pour la
  forme. Pas de Tailwind, pas de shadcn/ui — ils apportent un second système de
  thème à côté de `@rig/ui/theme`, et deux endroits où définir une couleur, c'est
  la promesse white-label qui se casse silencieusement.
- **La box active vit dans l'URL** (`/box/[slug]/…`), jamais dans un contexte ni
  un cookie. Le slug se résout **parmi ses propres appartenances**
  (`findMembershipBySlug`), jamais par `tenant_public_profile()` : « box
  inconnue » et « accès refusé » restent indiscernables par construction.
- **La garde de rôle de la coquille est de l'ergonomie, pas de la sécurité.** Les
  policies et `current_admin_tenant_ids()` refusent déjà tout à un MEMBER.
- **La frontière OWNER / MANAGER se coupe par table, pas par colonne** (P1-001b,
  troisième fois que la question se pose) : `tenants` — nom, slug, fuseau,
  devise, langue — au seul propriétaire ; `tenant_settings`, `opening_hours`,
  `locations`, `rooms`, `class_types` au gestionnaire aussi. À l'écran, le bloc
  identité est en lecture seule **avec la phrase qui l'explique**.
- **Le journal d'audit s'écrit dans la même transaction que l'action**, et
  `log_audit()` lève si l'appelant n'est pas membre **actif** : `leave_tenant`
  journalise donc **avant** de passer le statut à `LEFT`, `accept_invitation` et
  `create_tenant` **après** l'insertion de l'appartenance. L'ordre est une
  question de correction, pas de style.
- **Ni jeton ni e-mail dans `audit_logs.diff`** : la table est append-only, une
  erreur y est définitive. Deux contrôles négatifs le vérifient dans
  `audit_trail_test.sql`.
- **`opening_hours` est une table, pas un `jsonb`** : P1-002 la joindra dans une
  fonction PLpgSQL. Ses heures sont des `time` **nus**, en heure locale de la
  box — jamais `timetz`, jamais UTC. Le chevauchement de deux créneaux n'est
  **pas** garanti par la base : il vit dans `overlappingSlots()`, et la migration
  le dit.

## 5. Pièges d'environnement

**Docker n'est pas sur le PATH** de la session Claude. Préfixer :

```
export PATH="$PATH:/c/Users/sahli/AppData/Local/Programs/DockerDesktop/resources/bin"
```

**Ports Supabase décalés** (Windows réserve 53979–54478) : API 55321, base 55322,
Studio 55323, **Mailpit 55324**.

**Le port 3000 n'est pas interchangeable** : `supabase/config.toml` fixe
`site_url = "http://127.0.0.1:3000"`, et `additional_redirect_urls` déclare
`localhost:3000` **et** `127.0.0.1:3000`, en `http`. D'où `"autoPort": false`
dans `.claude/launch.json`. Un `next dev` resté ouvert d'une session précédente
occupe le port : l'arrêter, ne pas déplacer le serveur.

**Les clés Supabase ont changé de format.** Le CLI expose `sb_publishable_…` et
`sb_secret_…`, plus les JWT `anon` / `service_role`. La clé publishable va dans
`*_SUPABASE_ANON_KEY` et fonctionne telle quelle — vérifié sur le parcours web
complet, ni montée de version ni clés héritées nécessaires.

**Expo réécrit `apps/mobile/tsconfig.json`** à chaque `expo start`, et il ne se
contente pas de reformater : il **retire** `.expo/types/**/*.ts` et
`expo-env.d.ts` de l'`include`, ce qui prive le typecheck des types générés du
routeur. Vérifier `git status` après avoir lancé Expo.

**Git Bash** : `UID` est en lecture seule — un script qui l'utilise comme nom de
variable échoue sur un message trompeur (`invalid input syntax for type uuid`).
Et `node -e "…writeFileSync('/tmp/x')"` écrit dans `C:\tmp`, pas là où Git Bash
lit `/tmp`.

**pnpm** est installé au niveau utilisateur (`corepack enable` échoue faute de
droits admin).

**Après un `db:reset`, la session du navigateur est morte** et la première
requête peut échouer en `PGRST303 « JWT issued at future »` — décalage d'horloge
entre le conteneur Postgres et l'hôte. Se reconnecter, ou attendre quelques
secondes et recharger.

**Un fichier `'use server'` ne peut exporter que des fonctions asynchrones.** Y
laisser une constante passe le typecheck et casse le rendu à l'exécution, sur un
message qui ne nomme pas le coupable. Constantes et types dans un module voisin.

**`tenantScope().select()` ne prend pas de liste de colonnes.** La rendre
générique pour que PostgREST type les lignes fait exploser `tsc` en « heap out of
memory » : il instancie l'analyseur de colonnes pour chaque table de l'union.
Mesuré. Toutes colonnes, et une **vue** le jour où ça ne suffira plus.

## 6. Le contexte qui compte

`.claude/rules/database.md` porte **douze pièges déjà payés**, et surtout la
**règle des sœurs** : cinq des cinq trous trouvés depuis P0-004 ont la même forme
— un chemin bien gardé, et son jumeau oublié.

| Gardé | Oublié |
| --- | --- |
| `tenant_settings` avait une garde de rôle | `tenants` non — le fuseau gouverne la fenêtre d'annulation de tout le monde |
| `create_tenant` vérifiait le quota | ni `accept_invitation`, ni `set_member_role` |
| `tenantScope.insert()` imposait le `tenant_id` | `update()` se contentait de filtrer |
| Les policies étaient soignées | les **droits de table** ne l'étaient pas : `TRUNCATE` accordé à `anon`, et la RLS ne s'y applique pas |
| P0-005a a livré les écrans du mobile | le web n'avait pas d'écran de connexion |

Aucun n'a été trouvé par les tests ni par `rls-auditor` : ils vérifient ce qui
est écrit, pas ce qui manque. La question utile n'est pas « ce que je viens
d'écrire est-il correct ? » mais « qu'est-ce qui, ailleurs, fait la même chose et
n'a pas été touché ? »

Le pendant côté tests : un **contrôle structurel** dit que la forme est bonne, un
**contrôle comportemental** dit que ça se comporte bien. `rls_leak_test.sql` porte
les deux depuis D-001 et D-006 — et le second a rattrapé un faux vert du premier.
