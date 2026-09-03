# RIG

SaaS multi-tenant pour boxes CrossFit / Hyrox — réservation, programmation,
coopération inter-box.

Monorepo Expo + Next.js + Supabase, développé avec Claude Code. Le dépôt est à la
fois le code et son poste de pilotage : la spécification, les décisions et le
backlog vivent à côté des sources.

## Ce qu'il y a dans le dépôt

```
CLAUDE.md                  instructions permanentes lues à chaque session
.claude/
  settings.json            permissions et hooks
  rules/                   règles chargées seulement quand le fichier concerné est ouvert
  agents/                  sous-agents spécialisés (audit RLS, revue financière…)
  skills/                  commandes /ticket /check /migration /ship
  hooks/                   garde-fous exécutés automatiquement
docs/
  spec/                    la spécification produit complète (20 sections)
  adr/                     décisions d'architecture et leurs raisons
  backlog/                 un fichier par ticket, avec critères d'acceptation
  environnement-local.md   les pièges de la machine de développement
apps/
  mobile/                  Expo + expo-router (iOS, Android)
  web/                     Next.js App Router (back-office box, pages publiques)
packages/
  core/                    types, schémas Zod, helpers partagés
  ui/                      kit de composants thémable, partagé mobile / web
supabase/                  migrations SQL, fonctions PLpgSQL, tests pgTAP
```

## Démarrer

Prérequis : **Node 22.20.0** (voir `.nvmrc`), **pnpm 9**, et **Docker Desktop**
uniquement pour la base locale.

```bash
corepack enable pnpm || npm install -g pnpm@9.15.4
```

```bash
pnpm install
```

```bash
pnpm dev
```

`pnpm dev` lance le web sur <http://localhost:3000> et le serveur Expo — appuyer
sur `a` pour Android, `i` pour iOS, ou scanner le QR code avec Expo Go.

Pour la base locale (nécessite Docker Desktop démarré) :

```bash
pnpm exec supabase start
```

⚠️ **Les ports ne sont pas ceux par défaut de Supabase.** Windows réserve la plage
TCP 53979–54478 (exclusions Hyper-V / WinNAT), qui avale les six ports habituels.
Tout a été décalé de 543xx vers 553xx dans `supabase/config.toml` :

| Service | Port  | URL                                                       |
| ------- | ----- | --------------------------------------------------------- |
| API     | 55321 | <http://127.0.0.1:55321>                                  |
| Base    | 55322 | `postgresql://postgres:postgres@127.0.0.1:55322/postgres` |
| Studio  | 55323 | <http://127.0.0.1:55323>                                  |
| Mailpit | 55324 | <http://127.0.0.1:55324>                                  |

Pour vérifier les plages réservées sur une autre machine :
`netsh interface ipv4 show excludedportrange protocol=tcp`.

Les autres pièges de la machine — Docker hors PATH, le port 3000 qui ne se
déplace pas, Expo qui réécrit un `tsconfig.json` — sont dans
**`docs/environnement-local.md`**. Les lire avant de perdre une heure dessus.

### Variables d'environnement

**À créer à la main.** Ni Claude ni le dépôt ne les écrivent : `.claude/settings.json`
interdit à Claude de lire ou d'écrire tout fichier `.env*`, et `.gitignore` exclut
les `.env.local`. Chaque framework lit le dossier de son app, pas la racine du
monorepo — il faut donc **deux fichiers**.

Les valeurs se lisent avec `pnpm exec supabase status`. La clé est publique par
construction : elle part dans le bundle et ne donne accès qu'à ce que la RLS
autorise. Ce n'est pas un secret.

⚠️ Le CLI Supabase récent expose les **nouvelles** clés — `Publishable` et
`Secret`, au format `sb_publishable_…` — et non plus les JWT `anon` /
`service_role`. Mettre la clé **publishable** dans `NEXT_PUBLIC_SUPABASE_ANON_KEY`
et `EXPO_PUBLIC_SUPABASE_ANON_KEY` : `@supabase/ssr` 0.12 et `supabase-js` 2.112
l'acceptent telle quelle, vérifié sur le parcours de connexion web complet. Le
nom de la variable garde `ANON` pour ne pas casser l'existant ; c'est la seule
incohérence, et elle est ici plutôt que dans une surprise.

`apps/mobile/.env.local` :

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<clé anon>
```

`apps/web/.env.local` :

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé anon>
```

Sur **appareil physique**, remplacer `127.0.0.1` par l'IP de la machine sur le
réseau local (`http://192.168.x.x:55321`) : sur le téléphone, `127.0.0.1` désigne
le téléphone.

Le web sait vivre sans ces variables — la page publique et la galerie du système
de design restent consultables, la session est simplement désactivée. Le mobile,
lui, refuse de démarrer avec un message qui nomme le fichier à créer.

Après toute migration, régénérer les types :

```bash
pnpm db:types
```

Note : Docker Desktop s'installe **par utilisateur** sous Windows. S'il vient
d'être installé, un terminal déjà ouvert ne le verra pas — son PATH est figé au
démarrage. Ouvrir un nouveau terminal suffit.

## Vérifier

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm format:check
```

| Commande          | Ce qu'elle fait                                         |
| ----------------- | ------------------------------------------------------- |
| `pnpm dev`        | web + mobile en parallèle                               |
| `pnpm typecheck`  | `tsc --noEmit` sur les 4 packages                       |
| `pnpm lint`       | ESLint (flat config, TypeScript strict)                 |
| `pnpm test`       | Vitest                                                  |
| `pnpm test:db`    | tests pgTAP, dont le test anti-fuite inter-tenant       |
| `pnpm format`     | Prettier — la prose de `docs/` et `.claude/` est exclue |
| `pnpm db:migrate` | applique les migrations Supabase en local               |
| `pnpm db:reset`   | reset + seed local                                      |
| `pnpm db:types`   | régénère les types TypeScript depuis la base locale     |

## Travailler avec Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

Lancer `claude` à la racine, puis dans la session :

```
/ticket P0-002
```

## Boucle de travail

```
/ticket P0-00X     →  Claude lit le ticket, propose un plan, attend validation
                      sur tout ce qui touche base / argent / auth
   ↓
   il écrit les tests, puis le code
   ↓
/check             →  types, lint, tests, test anti-fuite, i18n, tokens, secrets
   ↓
/ship P0-00X       →  branche + commit. La poussée reste manuelle, volontairement.
```

Une session = un ticket. Quand la session devient longue ou confuse, `/clear`
et on repart : `CLAUDE.md` et les règles se rechargent seuls.

## Habitudes qui font la différence

- **Plan mode d'abord** (`shift+tab`) sur tout ticket touchant la base, l'argent
  ou l'authentification. Lire le plan avant de laisser écrire.
- **Un ticket à la fois.** Ce qui déborde devient un nouveau fichier dans
  `docs/backlog/`, jamais du code en plus dans le ticket courant.
- **Corriger dans `CLAUDE.md`, pas dans le chat.** Une erreur répétée deux fois
  est une ligne manquante dans les instructions.
- **Ne jamais valider un diff qu'on n'a pas lu**, surtout sur `supabase/` et le
  paiement. Les sous-agents `rls-auditor` et `money-reviewer` aident, ils ne
  remplacent pas la relecture.
- **Le jalon qui compte** : une box réelle qui réserve en production, vers le
  mois 6, avec le paiement encore hors app. Pas le MVP complet.

## Où est la vérité

| Question                         | Fichier                                                 |
| -------------------------------- | ------------------------------------------------------- |
| Que construit-on et pourquoi ?   | `docs/spec/RIG-spec-produit-technique.md`               |
| Comment code-t-on ici ?          | `CLAUDE.md` et `.claude/rules/`                         |
| Pourquoi ce choix technique ?    | `docs/adr/`                                             |
| Quoi faire maintenant ?          | `docs/backlog/README.md`                                |
| Qu'est-ce qui bloque hors code ? | `docs/backlog/README.md`, « Chemin critique hors code » |
| Pourquoi ma machine résiste ?    | `docs/environnement-local.md`                           |
