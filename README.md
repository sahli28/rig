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

| Question                       | Fichier                                   |
| ------------------------------ | ----------------------------------------- |
| Que construit-on et pourquoi ? | `docs/spec/RIG-spec-produit-technique.md` |
| Comment code-t-on ici ?        | `CLAUDE.md` et `.claude/rules/`           |
| Pourquoi ce choix technique ?  | `docs/adr/`                               |
| Quoi faire maintenant ?        | `docs/backlog/README.md`                  |
