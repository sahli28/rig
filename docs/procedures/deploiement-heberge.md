# Déploiement hébergé — ce qui vit hors du dépôt, et comment le recréer

**Livrable de `P1-017`.** À partir de ce ticket, une partie du produit vit dans
deux tableaux de bord (Supabase, Vercel). Ce document est la source de vérité de
ce qui s'y configure — pour qu'on n'ait jamais à s'en souvenir.

> **Aucun secret dans ce fichier.** Mots de passe, jetons et clés vivent dans les
> tableaux de bord, le trousseau du CLI, ou un fichier ignoré par git
> (`supabase/.temp/`). Ce document dit **où** ils sont et **comment** les poser,
> jamais leur valeur.

## Le projet Supabase hébergé

| | |
| --- | --- |
| ref | `llakbulflemibnfagnyh` |
| région | `eu-west-3` (Paris, UE — ADR 0001, spec §15) |
| Postgres | **17.6** (`select version()`, lu le 11 sept. 2026 — doit égaler `supabase/config.toml:41`) |
| formule | **Free** pour prouver la chaîne ; **Pro avant la mise en service** (voir `P1-016` : une base Free se met en pause après une semaine) |

Trois choix faits à la création, à **reproduire** si le projet est recréé :

- **GitHub non connecté.** Les migrations partent quand on les lance et qu'on les
  vérifie, jamais par un push automatique sur une base qui portera 80 membres.
- **« Automatically expose new tables » décoché.** Les migrations accordent les
  droits table par table ; on ne veut pas que la plateforme en accorde par-dessus.
  Un 401 après migration = un `grant` manquant dans la migration, pas un réglage
  de tableau de bord.
- **« Enable automatic RLS » décoché.** Les migrations font `enable` + `force` sur
  chaque table ; un second mécanisme rendrait muettes les tables d'infrastructure
  sans policy (`processed_webhook_events`, `push_outbox`, `app_runtime_config`).

## S'authentifier (les secrets restent sur la machine)

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref llakbulflemibnfagnyh
```

- `login` stocke un jeton d'accès personnel dans la config du CLI ; `link` demande
  le **mot de passe de la base** une fois et le garde dans le trousseau du système.
  Ni l'un ni l'autre n'apparaît dans le dépôt.
- Pour le SQL ponctuel (poser l'URL de l'émetteur, un enfilage de test), le CLI
  **n'a pas** de commande SQL générique et `psql` n'est pas installé sur la
  machine de dev. La chaîne de connexion **Session pooler** (port 5432,
  IPv4 ; tableau de bord → *Project Settings → Database → Connection string →
  Session pooler*) se dépose dans `supabase/.temp/hosted-db-url` — **ignoré par
  git** (`supabase/.temp/`). Coller la chaîne telle quelle : le mot de passe peut
  contenir des caractères spéciaux (`@`, …) que l'encodage d'URL de `node-postgres`
  abîmerait ; les outils la lisent en clair, en champs discrets.

## Appliquer le schéma

```bash
pnpm exec supabase db push --linked --yes
```

- Applique toutes les migrations manquantes et les inscrit dans
  `supabase_migrations.schema_migrations`. Utilise le pooler ; **le CLI porte le
  mot de passe** (via `link`) — pas besoin de le passer en clair. Sur une base
  neuve, pas de `--include-all`.
- Le seed (décor de démo) : ajouter `--include-seed`. Le projet hébergé **reçoit
  le seed ou rien** ; les membres réels arrivent en `P1-016`, avec le RGPD.
- `select version()` doit commencer par `PostgreSQL 17` — **lu**, pas déduit.

## Les extensions

`pg_cron`, `pg_net` et `supabase_vault` **s'activent par `create extension` dans
les migrations** — aucun réglage de tableau de bord (vérifié le 11 sept. :
`pg_cron 1.6.4`, `pg_net 0.20.4`, `supabase_vault 0.3.1`). `pg_cron` **accepte la
planification sous-minute** (`'30 seconds'`, ≥ 1.5). Si un `create extension`
était un jour refusé, l'activer dans *Database → Extensions* puis relancer
`db push` (les migrations sont en `if not exists`).

## L'émetteur push

```bash
pnpm exec supabase functions deploy rack-push-emitter
```

- `verify_jwt = false` (dans `supabase/config.toml`, section
  `[functions.rack-push-emitter]`) est honoré **automatiquement** au déploiement —
  pas de `--no-verify-jwt`. L'émetteur est réveillé par un `net.http_post` sans
  en-tête d'auth ; il s'authentifie à la base par la `service_role` injectée dans
  le runtime.
- **Porte de vérification, à passer à chaque déploiement :**

  ```bash
  curl -i -X POST https://llakbulflemibnfagnyh.supabase.co/functions/v1/rack-push-emitter
  ```

  **Doit rendre `200`** (corps `{"claimed":N}`). Un `401` signifie que
  `verify_jwt = false` n'a pas été appliqué — `kick_push_emitter` avalerait alors
  l'exception et la ligne resterait `pending` pour toujours. **Piège de
  redéploiement connu** (bug CLI) : `verify_jwt = false` peut ne **pas** être
  ré-appliqué sur une mise à jour d'une fonction existante. Après **chaque**
  redéploiement de l'émetteur : re-vérifier ce `curl` ; s'il rend `401`, vérifier
  le bouton « Verify JWT » (off) dans le tableau de bord ou redéployer avec
  `--no-verify-jwt`.

## Poser l'URL de l'émetteur — des deux côtés

`kick_push_emitter` lit l'URL dans la table `app_runtime_config` (clé
`push_emitter_url`), **pas dans un GUC** : l'hébergé refuse `ALTER DATABASE|ROLE
SET` de paramètre personnalisé au rôle `postgres` (non superutilisateur). La table
se comporte identiquement des deux côtés — c'est tout l'intérêt.

**Sur l'hébergé** (SQL comme `postgres`, qui a `bypassrls` et écrit malgré la RLS
forcée) :

```sql
insert into public.app_runtime_config (key, value)
values ('push_emitter_url', 'https://llakbulflemibnfagnyh.supabase.co/functions/v1/rack-push-emitter')
on conflict (key) do update set value = excluded.value, updated_at = now();
```

**En local** (l'URL est celle du réseau Docker, joignable depuis le conteneur
postgres — voir `environnement-local.md`) :

```bash
docker exec supabase_db_imys psql -U postgres -d postgres -c \
  "insert into public.app_runtime_config (key, value) values ('push_emitter_url', 'http://kong:8000/functions/v1/rack-push-emitter') on conflict (key) do update set value = excluded.value, updated_at = now();"
```

## Le back-office web (Vercel) — à compléter

*Lot en cours ; cette section sera renseignée au déploiement (`vercel login` +
CLI). Le monorepo pnpm/Turborepo se déploie tel quel ; à configurer :*

- *Répertoire racine : `apps/web`.*
- *Variables (toutes deux **publiques** — l'anon key l'est par construction) :*
  `NEXT_PUBLIC_SUPABASE_URL` = `https://llakbulflemibnfagnyh.supabase.co`, et
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` = *(tableau de bord Supabase → Project Settings
  → API)*. Aucune `service_role` côté web (vérifié : `apps/web` n'en contient
  aucune).

## Le SMTP tiers

**En attente du domaine** (SPF/DKIM/DMARC). Arbitrage écrit dans `P1-017`, §
« Le SMTP tiers : pourquoi il attend, et jusqu'à quand » — il ne bloque ni le
push ni l'accès back-office (lien de connexion). Requis avant les 80 invitations
de `P1-016`.

## Ce qui vit hors du dépôt

| Élément | Où | Note |
| --- | --- | --- |
| Jeton d'accès Supabase | trousseau du CLI (`supabase login`) | jamais commité |
| Mot de passe de la base | tableau de bord Supabase ; trousseau du CLI ; `supabase/.temp/hosted-db-url` (git-ignoré) | **partagé une fois en clair dans une conversation le 11 sept. — à réinitialiser** (tableau de bord → Database → Reset password) après la mise en place |
| `anon key` | tableau de bord Supabase → API | **publique** par construction (RLS fait foi) ; part dans le bundle web |
| `push_emitter_url` | table `app_runtime_config` (hébergé **et** local) | non secret ; posé par l'`insert` ci-dessus |
| Variables Vercel | tableau de bord Vercel | les deux `NEXT_PUBLIC_*` ci-dessus |
