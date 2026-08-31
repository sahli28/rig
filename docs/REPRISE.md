# Point de reprise — 31 août 2026

Document de passage entre sessions. À lire en premier, à supprimer quand P0-005a
sera fusionné.

---

## 1. Faire ceci en premier

### a. Créer les deux `.env.local`

**Rien ne tourne côté mobile sans eux**, et Claude ne peut pas les écrire : la
règle `deny` de `.claude/settings.json` couvre tout fichier `.env*` — y compris
`.env.example`, ce qui est plus large que voulu. Le contenu exact est dans le
README, section « Variables d'environnement ». Deux fichiers, un par app :
Expo et Next lisent le dossier de leur app, pas la racine du monorepo.

La clé se lit avec `pnpm exec supabase status`.

### b. Fermer la PR #5 **sans la fusionner**

Son contenu est déjà dans `main`. La PR #4 a été fusionnée **en squash** jusqu'au
commit `c49190a`, ce qui couvre les migrations, les tests et les quatre tours de
corrections d'audit. PR #5 tentait donc de refusionner une soixantaine de fichiers
identiques — d'où les conflits.

La branche `feat/P0-004-schema-rls` peut être supprimée côté GitHub une fois la
PR fermée.

### c. Pousser la branche de travail

`git push` est en `deny` dans `.claude/settings.json`, volontairement — la poussée
est une décision humaine.

```
git -C C:/Users/sahli/imys push -u origin feat/P0-005a-connexion
```

### d. Fusionner avec un **merge commit**, jamais en squash

Le squash a causé le problème trois fois (PR #3, #4, #5) : il coupe le lien
d'ascendance, et toute branche empilée part en conflit sur des fichiers pourtant
identiques. La règle est dans `CLAUDE.md`, point 5 du workflow, avec la commande
de rattrapage.

---

## 2. État du projet

| | |
| --- | --- |
| Branche | `feat/P0-005a-connexion`, arbre propre |
| Fusionné dans `main` | P0-001, P0-002, P0-003, **P0-004** (`VERDICT: SAFE`) |
| En cours | **P0-005a — Se connecter**, code complet, reste la passe sur appareil |
| Tests | **139 pgTAP** (11 fichiers) · **148 Vitest** · lint, typecheck, i18n, format verts |
| Migrations | 8 |

Ticket : `docs/backlog/P0-005a-connexion.md`

---

## 3. Pièges d'environnement — à savoir avant la première commande

**Docker n'est pas sur le PATH** de la session. Toute commande touchant Supabase
doit être préfixée :

```
export PATH="$PATH:/c/Users/sahli/AppData/Local/Programs/DockerDesktop/resources/bin"
```

Docker Desktop s'installe **par utilisateur** sous Windows (`AppData\Local\Programs`),
pas dans `Program Files` — chercher au mauvais endroit fait conclure à tort qu'il
n'est pas installé.

**Les ports Supabase ne sont pas ceux par défaut.** Windows réserve la plage TCP
53979–54478, qui avale les six ports habituels. Tout a été décalé :

| Service | Port |
| --- | --- |
| API | 55321 |
| Base | 55322 |
| Studio | 55323 |
| **Mailpit** | 55324 — c'est là qu'arrivent les codes de connexion en local |

**Autres :**

- `pnpm` est installé au niveau utilisateur (`corepack enable` échoue faute de
  droits admin sur `C:\Program Files\nodejs`).
- `UID` est une variable en lecture seule dans Git Bash. Un script de test qui
  l'utilise comme nom d'identifiant échoue avec un message trompeur
  (`invalid input syntax for type uuid: "197609"`).
- `node -e "…writeFileSync('/tmp/x')"` écrit dans `C:\tmp`, pas là où Git Bash
  lit `/tmp`. Utiliser le répertoire de travail.
- **Le port 3000 n'est pas interchangeable** : `supabase/config.toml` fixe
  `site_url = "http://127.0.0.1:3000"`, qui sert d'allow-list de redirection à
  l'authentification. D'où `"autoPort": false` dans `.claude/launch.json`. Si le
  port est occupé par un `next dev` lancé à la main, l'arrêter plutôt que de
  déplacer le serveur.
- Studio bascule en disposition mobile dans un panneau étroit. L'ouvrir dans un
  vrai navigateur.

---

## 4. P0-005a — fait / reste à faire

### Fait

- Backlog découpé : **P0-005a / P0-005b / P2-002 / P2-003**, plus
  `docs/procedures/effacement-manuel.md` et **ADR 0004** (pas de couche API).
- Migrations `me()` et `app_error_codes`, 25 tests pgTAP.
- **`packages/core/src/errors.ts`** : les 24 codes applicatifs, chacun relié à
  une clé i18n, plus `appErrorCodeOf()` qui lit le champ `details` de PostgREST.
  Un test relit les migrations : un `app_error()` ajouté en SQL sans message
  côté client fait échouer `pnpm test`.
- **`packages/core/src/supabase/`** : types générés, fabrique de client,
  `me()` en Zod, profil public, invitation, profil, consentements,
  `tenantScope()`, et le découpage du trousseau.
- **Mobile** : client `expo-secure-store`, `SessionProvider`, `BrandProvider`,
  quatre écrans `(auth)` et l'atterrissage `(app)`.
- **Web** : `@supabase/ssr`, session en cookies, middleware de rafraîchissement.
  Le web reste consultable **sans** `.env.local` — la session est simplement
  désactivée.
- `jwt_expiry = 900` et gabarits d'e-mail portant `{{ .Token }}` : sans eux,
  Mailpit ne livre qu'un lien, et l'écran de saisie du code n'a rien à saisir.
- Parcours vérifié de bout en bout **par appels HTTP réels** sur la base locale :
  demande de code → Mailpit → vérification → `accept_invitation` → profil →
  consentements → `me()` avec `required_actions: []`.

### Reste à faire

1. **Créer les deux `.env.local`** (section 1a).
2. **Passer le parcours sur appareil** via Expo Go — critère d'acceptation non
   coché. Sur téléphone, `127.0.0.1` désigne le téléphone :
   il faut l'IP de la machine sur le réseau local, que Next annonce au démarrage
   (`Network: http://…:3000`). Au 31 août : `EXPO_PUBLIC_SUPABASE_URL=http://192.168.1.133:55321`.
3. **Tester le chemin web** : le même e-mail porte un lien, et le web le
   consomme (`detectSessionInUrl` actif + middleware). Deux chemins
   d'authentification, deux à vérifier — sinon seul celui du quotidien l'est.
4. Si `signInWithOtp` échoue sur appareil avec une erreur d'URL, ajouter
   `react-native-url-polyfill` — volontairement **pas** ajouté d'avance : RN 0.86
   pourrait n'en avoir plus besoin, et une dépendance non justifiée est une
   dépendance de trop.

---

## 5. Décisions prises — ne pas les re-litiger

- **Code OTP à 6 chiffres sur mobile**, pas le magic link. Le lien impose du deep
  linking, dont la configuration diffère entre Expo Go et un build de
  développement : deux à trois jours cachés. Le lien reste sur le web.
- **`me()` ne devine pas la box active.** Sans `p_tenant_id`, `current_tenant`
  est nul. Le choix est fait côté client par `chooseActiveTenant()` : la box
  mémorisée, sinon la box unique, sinon **rien** — et l'écran demande. Choisir
  « la plus ancienne » afficherait les données d'une box sous le nom d'une autre.
- **Le trousseau ne prend pas une session entière** (2 Ko de plafond, 2 à 4 Ko de
  session). D'où `chunkedStore()`, logique pure et testée sans appareil.
- **Pas de couche API** avant P1-003 (ADR 0004).
- **Maestro sort du ticket** — ni émulateur ni appareil sur cette machine. Part
  avec D-002.
- **Ouverture à froid sans slug** : thème RIG neutre, la marque de la box
  s'applique après `me()`. Pas d'écran de saisie de code de box en 005a.
- **Box Switcher hors périmètre** — une box pilote est une box.
- **Consentements** : `TERMS` et `PRIVACY` sont de plateforme (`tenant_id` nul),
  `PUSH` et `LEADERBOARD` portent la box, qui devient responsable de traitement.

---

## 6. Bloquants hors développement

1. **Inscription au programme développeur Apple** — 99 $/an, délai d'enrôlement
   variable. Seul élément du chemin critique dont le délai ne se rattrape pas.
   Câbler Google en P0-005b engage sur Apple avant la soumission (guideline 4.8).
   Voir `docs/backlog/P2-003-sign-in-apple.md`.
2. **Identifiants OAuth Google** (P0-005b) — trois `client_id` distincts (web,
   iOS, Android). URI de redirection **exactement**
   `http://127.0.0.1:55321/auth/v1/callback` en local : Google exige la
   correspondance au caractère près, et `localhost` n'est pas `127.0.0.1`.
3. **Élargir ou restreindre la règle `deny` sur `.env*`** si l'on veut que Claude
   puisse fournir un `.env.example`. Aujourd'hui la règle couvre aussi le fichier
   d'exemple, ce qui n'était probablement pas l'intention.

---

## 7. Le contexte qui compte pour la suite

`.claude/rules/database.md` contient **onze pièges déjà payés** pendant P0-004,
plus une section sur ce que les tests d'isolation ne voient pas.
`.claude/rules/api.md` porte désormais la règle du tenant actif **pour les appels
directs**, pas seulement pour les futures routes.

La leçon la plus utile de P0-004 : la faille la plus grave — `tenants` sans garde
de rôle — n'a été trouvée **ni par les 106 tests, ni par le sous-agent
`rls-auditor`**, mais en relisant le code. Elle ne concernait pas l'isolation
inter-tenant mais la matrice de permissions de la spec §5.2, qu'aucun des deux ne
confrontait au schéma.

La classe de bug équivalente pour P1 est le **filtre de box active** : la RLS ne
l'attrape pas, aucun test pgTAP ne peut l'attraper, et tous les voyants restent
verts pendant que l'écran ment. C'est la raison d'être de `tenantScope()`.

Dettes ouvertes : **D-001 à D-008**, listées dans `docs/backlog/README.md`.
D-001 (vue restreinte des membres) est **bloquante pour P1-001**. D-004 (langue)
n'est plus bloquée : elle attendait le profil serveur, que 005a livre.
