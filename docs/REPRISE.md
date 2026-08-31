# Point de reprise — 31 août 2026

Document de passage entre sessions. À lire en premier, à supprimer quand P0-005a
sera livré.

---

## 1. Faire ceci en premier

### a. Fermer la PR #5 **sans la fusionner**

Son contenu est déjà dans `main`. La PR #4 a été fusionnée **en squash** jusqu'au
commit `c49190a`, ce qui couvre les migrations, les tests et les quatre tours de
corrections d'audit. PR #5 tentait donc de refusionner une soixantaine de fichiers
identiques — d'où les conflits.

Le seul commit réellement absent (`cce2500`, cinq fichiers de documentation) a été
rebasé sur la branche de travail. Vérifié : le diff entre l'ancienne branche et la
branche actuelle ne contient que des ajouts.

La branche `feat/P0-004-schema-rls` peut être supprimée côté GitHub une fois la PR
fermée.

### b. Pousser la branche de travail

`git push` est en `deny` dans `.claude/settings.json`, volontairement — la poussée
est une décision humaine.

```
git -C C:/Users/sahli/imys push -u origin feat/P0-005a-connexion
```

### c. Fusionner avec un **merge commit**, jamais en squash

Le squash a causé le problème trois fois (PR #3, #4, #5) : il coupe le lien
d'ascendance, et toute branche empilée part en conflit sur des fichiers pourtant
identiques. La règle est dans `CLAUDE.md`, point 5 du workflow, avec la commande
de rattrapage.

---

## 2. État du projet

| | |
| --- | --- |
| Branche | `feat/P0-005a-connexion`, 5 commits d'avance sur `main`, arbre propre |
| Fusionné dans `main` | P0-001, P0-002, P0-003, **P0-004** (`VERDICT: SAFE`) |
| En cours | **P0-005a — Se connecter** |
| Tests | **139 pgTAP** (11 fichiers) · 83 Vitest · lint, typecheck, i18n, format verts |
| Migrations | 8 |

Plan validé de P0-005a :
`C:\Users\sahli\.claude\plans\humming-sleeping-dragonfly.md`
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
| **Mailpit** | 55324 — c'est là qu'arrivent les magic links en local |

**Autres :**

- `pnpm` est installé au niveau utilisateur (`corepack enable` échoue faute de
  droits admin sur `C:\Program Files\nodejs`).
- `.claude/launch.json` existe mais l'outil de prévisualisation résout encore vers
  l'ancien répertoire de session. Démarrer le serveur web à la main :
  `pnpm --filter @rig/web dev`, puis naviguer sur `http://localhost:3000`.
- Studio bascule en disposition mobile dans un panneau étroit. L'ouvrir dans un
  vrai navigateur.

---

## 4. P0-005a — fait / reste à faire

### Fait

- Backlog réorganisé : P0-005 découpé en **P0-005a / P0-005b / P2-002 / P2-003**.
- `docs/procedures/effacement-manuel.md` — condition du report de P2-002.
- **ADR 0004** : pas de couche API tant qu'aucune opération ne l'exige. Bascule
  en P1-003, quand `Idempotency-Key` devra être persistée et la réponse rejouée.
- Migration `me()` — profil, appartenances, box active, `required_actions`.
- Migration `app_error_codes` — les neuf fonctions portent un **code applicatif**
  dans `detail`, exposé par PostgREST.
- 25 tests pgTAP (`me_test.sql`, `app_error_codes_test.sql`).

### Reste à faire, dans cet ordre

1. **`packages/core/src/errors.ts`** — étendre la table `code → message_i18n`
   avec les 24 codes applicatifs de la migration `app_error_codes`, plus un helper
   qui lit le champ `details` d'une erreur PostgREST. À faire en premier : tout le
   reste s'en sert. La liste des codes se relève dans la migration.
2. **Clients Supabase** — `@supabase/supabase-js` partout, `expo-secure-store` sur
   mobile (un jeton de session est un identifiant, il ne va pas dans
   `AsyncStorage`), `@supabase/ssr` sur le web. Types :
   `pnpm exec supabase gen types typescript --local`.
3. **Helper de tenant actif** dans `packages/core`, traversé par **tout** accès aux
   données. La RLS garantit qu'on ne sort pas des boxes de l'utilisateur, pas qu'on
   reste dans la box active — et aucun test pgTAP ne peut attraper cette confusion.
4. **Écrans** : Welcome brandé, Auth (code à 6 chiffres), Profile Setup, Consents.

---

## 5. Décisions prises — ne pas les re-litiger

- **Code OTP à 6 chiffres sur mobile**, pas le magic link. Le lien impose du deep
  linking, dont la configuration diffère entre Expo Go et un build de
  développement : deux à trois jours cachés. Le lien reste sur le web. Et six
  chiffres se tapent plus vite à l'accueil d'une box qu'un aller-retour entre
  l'app mail et l'app.
- **`me()` ne devine pas la box active.** Sans `p_tenant_id`, `current_tenant` est
  nul. Choisir « la plus ancienne » inscrirait l'hypothèse mono-box dans la
  fonction la plus appelée du produit. Un `p_tenant_id` étranger donne nul aussi,
  jamais un repli silencieux.
- **Pas de couche API** avant P1-003 (ADR 0004).
- **Maestro sort du ticket** — ni émulateur ni appareil sur cette machine. Passage
  manuel via Expo Go ; Maestro part avec D-002.
- **Ouverture à froid sans slug** : thème RIG neutre, la marque de la box
  s'applique après `me()`. Pas d'écran de saisie de code de box en 005a.
- **Box Switcher hors périmètre** — une box pilote est une box. Le multi-box part
  avec le réseau inter-box.

---

## 6. Bloquants hors développement

1. **`.env.local`** — à créer à la main pour l'étape 2 ci-dessus. La clé anon
   locale se lit avec `pnpm exec supabase status`. Le fichier est couvert par
   `.gitignore` **et** par la règle `deny` de `settings.json` : Claude ne le crée
   pas et ne le lit pas.
2. **Inscription au programme développeur Apple** — 99 $/an, délai d'enrôlement
   variable. Seul élément du chemin critique dont le délai ne se rattrape pas.
   Câbler Google en P0-005b engage sur Apple avant la soumission (guideline 4.8).
   Voir `docs/backlog/P2-003-sign-in-apple.md`.
3. **Identifiants OAuth Google** — trois `client_id` distincts (web, iOS, Android).
   URI de redirection **exactement** `http://127.0.0.1:55321/auth/v1/callback` en
   local : Google exige la correspondance au caractère près, et `localhost` n'est
   pas `127.0.0.1` pour lui.

---

## 7. Le contexte qui compte pour la suite

`.claude/rules/database.md` contient **onze pièges déjà payés** pendant P0-004,
plus une section sur ce que les tests d'isolation ne voient pas. Les relire avant
d'écrire du SQL coûte cinq minutes et en a coûté plusieurs jours.

Six passes du sous-agent `rls-auditor` ont trouvé 20 problèmes, dont 8 failles
exploitables — et **4 avaient été introduites par les correctifs précédents**.

La leçon la plus utile : la faille la plus grave — `tenants` sans garde de rôle,
n'importe quel membre pouvait changer le fuseau horaire de sa box, donc la fenêtre
d'annulation de tout le monde — n'a été trouvée **ni par les 106 tests, ni par le
sous-agent**, mais en relisant le code. Elle ne concernait pas l'isolation
inter-tenant mais la matrice de permissions de la spec §5.2, qu'aucun des deux ne
confrontait au schéma.

Dettes ouvertes : **D-001 à D-007**, listées dans `docs/backlog/README.md`.
D-001 (vue restreinte des membres) est **bloquante pour P1-001**.
