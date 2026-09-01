# Point de reprise — 1er septembre 2026

À lire en premier. Ce fichier disparaît quand la dernière case de
`docs/backlog/P0-005a-connexion.md` sera cochée — avec le paragraphe de
`CLAUDE.md` qui y renvoie.

---

## 1. Où on en est

| | |
| --- | --- |
| `main` | `76919f1` — P0-001 à P0-004, **P0-005a**, **D-001**, **D-006**, **D-005** fusionnés |
| Branche en cours | `feat/P1-001a-porte-back-office`, 2 commits, **poussée, à fusionner** |
| Tests | **195 pgTAP** (13 fichiers) · **158 Vitest** · lint, typecheck, i18n (134 clés), format verts |
| Migrations | 12 |

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

## 3. La suite du backlog

`P1-001` a été ré-estimé et découpé (voir la fin de son fichier) : les 4 j·h
annoncés omettaient la porte d'entrée, la migration `class_types` qui n'existe
pas, et un import CSV qui vaut 2 à 3 j·h seul.

| Ticket | Contenu | j·h |
| --- | --- | ---: |
| **P1-001b** | `class_types` + Box Settings : infos, horaires, salles, règles | 3 |
| **P1-001c** | Staff & Roles : annuaire, invitations, changement de rôle | 2 |
| **P1-001d** | Import CSV de membres | 3 |

Les dépendances de P1-001c sont **déjà livrées** : D-001 a construit
`member_admin_directory`, D-005 l'API `create_invitation()`. C'était leur raison
d'être.

Dettes ouvertes : **D-002** (tests de rendu), **D-003** (SSR de l'i18n),
**D-004** (langue mobile — plus bloquée, le profil serveur existe), **D-007**
(contraste de la page de démo), **D-008** (deep link, attend un domaine et Apple).

## 4. Ce que P1-001a a établi, et qu'il ne faut pas re-litiger

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
