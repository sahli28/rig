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

  **Ce montage est temporaire, et ne se recrée pas pour du travail courant.** Le
  fichier `hosted-db-url` et le petit client `pg` jetable n'existent que pour la
  mise en place hébergée. Le SQL de tous les jours passe par une **migration**, le
  **CLI**, ou l'**éditeur SQL du tableau de bord** — jamais par une chaîne de
  connexion posée à la main. Voir la section « Décommissionner » ci-dessous.

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

**Deux réglages de droits, appris le 11 septembre :**

- **`auto_expose_new_tables = false`** sur l'hébergé (choix de création) **et**
  dans `config.toml` (parité). Le schéma s'appuie sur des `grant` **explicites**,
  pas sur une exposition automatique — c'est ce qui fait que `test:db` en local
  mord sur un grant oublié comme l'hébergé le ferait. Laissé à `true` en local, il
  a masqué deux défauts (voir `P1-017`, note de réalisation).
- **pgTAP est installé par une migration** (`20260830143104:17`), donc présent
  **aussi sur l'hébergé** — de l'outillage de test en production, à conditionner
  (`D-026`). **Ne pas le retirer à la main** : `db push` ou toute reconstruction
  le recrée.

**Purger l'hébergé vers schéma seul** (après un `test:db` distant, avant tout
décor) : `supabase db reset --linked --no-seed` — il **drop** les tables et
rejoue les migrations, ce qui contourne proprement les gardes append-only
(`audit_logs`, `ledger_entries`) et la FK `restrict` de `ledger_entries` qui
bloquent un `delete` ciblé. **Ne pas** purger par `TRUNCATE` : il échappe au
trigger append-only (piège 5). Après le reset, re-poser `push_emitter_url` (le
reset vide `app_runtime_config`).

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

## Le back-office web (Vercel)

Projet **`rack8/rack-web`** (équipe `rack`), déployé le 11 sept. 2026, framework
Next.js, par **CLI** (`npx vercel` ; la connexion GitHub a échoué au `link` — on
déploie par upload de fichiers).

> **Le déploiement n'est PAS automatique — une fusion sur `main` ne redéploie
> rien.** La connexion GitHub ayant échoué, `rack-web-rack8.vercel.app` sert le
> **dernier build uploadé à la main** jusqu'à ce que quelqu'un relance
> `npx vercel deploy --prod --scope rack8 --yes` (voir plus bas). **Conséquence à
> tenir** : le critère « le back-office est atteignable depuis l'ordinateur de la
> box » peut être **vert sur un build périmé**, et toute variable d'env nouvelle
> (`BREVO_API_KEY`, `RACK_INVITE_URL`) n'est embarquée **qu'au prochain déploiement
> explicite**, posée **avant** lui. **Rebrancher Vercel sur GitHub vaut d'être
> retenté une fois avant la mise en service** pour retirer ce geste manuel ; tant
> que ce n'est pas fait, le redéploiement est une **étape de `P1-016`**, pas un
> automatisme. Le runbook e-mail le rappelle aussi (`email-et-domaine.md`).

**Répertoire racine = `apps/web`, et le CLI ne le pose pas tout seul.** Un
`vercel link` non interactif laisse `rootDirectory = null` (il traite le dossier
lié comme la racine), ce qui casse la résolution des paquets d'espace de travail
(`@rack/core`, `@rack/ui`). On le pose par l'API une fois — à refaire si le projet
est recréé :

```
PATCH https://api.vercel.com/v9/projects/rack-web?teamId=<orgId>
{ "rootDirectory": "apps/web" }        # en-tête Authorization: Bearer <jeton du CLI>
```

**Déployer depuis la RACINE du dépôt**, pas depuis `apps/web` : Vercel téléverse
le dossier courant, et le build hébergé a besoin de **tout l'espace de travail**
(`pnpm-workspace.yaml`, `packages/*`). Le lien `.vercel/` est donc placé à la
racine (copié de `apps/web/.vercel/project.json`). Avec `rootDirectory = apps/web`,
Vercel installe à la racine (pnpm, workspace-aware) et construit `apps/web` (Next
transpile `@rack/*` depuis les sources — `transpilePackages`).

```bash
npx vercel deploy --prod --scope rack8 --yes   # depuis la racine du dépôt
```

**`vercel build --prebuilt` ne marche pas sous Windows** : le build Next réussit,
mais Vercel déduplique les fonctions par **symlink** dans `.vercel/output` et
Windows refuse (`EPERM: operation not permitted, symlink`). D'où le build hébergé
ci-dessus, et non le prebuilt local.

**Variables** (les deux **publiques** — l'anon l'est par construction), posées en
`production` **et** `preview`, type `config` :
`NEXT_PUBLIC_SUPABASE_URL = https://llakbulflemibnfagnyh.supabase.co`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase → Project Settings → API). Aucune
`service_role` côté web (vérifié : `apps/web` n'en contient aucune). En
non-interactif : `vercel env add <NOM> <env> --type config --value <valeur> --yes`.

**Protection de déploiement DÉSACTIVÉE** (`ssoProtection: null`, par l'API). Par
défaut Vercel place chaque déploiement derrière le SSO de l'équipe (302 vers
`vercel.com/sso-api`) — la box ne pourrait pas atteindre le back-office. Or il a
**sa propre** authentification (session Supabase + RLS) ; le SSO Vercel est
redondant et bloquant. Les routes sensibles restent protégées par l'app, pas par
Vercel.

**Adresses publiques** (200 vérifié) : `https://rack-web-rack8.vercel.app`,
`https://rack-web-eight.vercel.app`. La page rend (`<title>Rack</title>`, i18n
FR/EN). *Défaut relevé, hors périmètre infra : une erreur React #418 (décalage
d'hydratation) sur l'accueil — la page se rétablit côté client ; à traiter
séparément (accueil `apps/web`, probablement langue/thème SSR ≠ client).*

**Région des fonctions — à forcer en UE (RGPD).** Par défaut Vercel exécute les
fonctions en `iad1` (US) ; les données membres qui transitent par le SSR doivent
rester en UE (`.claude/rules/privacy.md`, registre `docs/rgpd/sous-traitants.md`).
Vercel est un sous-traitant **US** (plan de contrôle et comptes aux US, transfert
sous Data Privacy Framework), mais l'exécution est **forçable** en région UE.

- [ ] Forcer la région des fonctions en **UE** (`cdg1` Paris ou `fra1` Francfort) —
      `functions.<glob>.region` dans `vercel.json`, ou *Project Settings → Functions →
      Region* — et le consigner dans le registre des sous-traitants.

## Le SMTP tiers

**Brevo, sur `rack-app.fr`.** Requis avant les 80 invitations de `P1-016` ; ne
bloque ni le push ni l'accès back-office (lien de connexion). Le câblage complet —
compte Brevo, clé SMTP, enregistrements DNS OVH (SPF/DKIM/DMARC), champs SMTP du
dashboard Supabase, durcissement DMARC — vit dans son propre runbook :
**`email-et-domaine.md`**.

## Rien n'est automatique côté hébergé — trois écarts, une checklist

**Découvert le 12 septembre 2026 en répétant la mise en service : trois choses que
« fusionné » ou « vert en CI » laisse croire faites, et qui ne le sont pas.** Aucune
ne se signale ; on les découvre en butant dessus.

1. **Le web ne se redéploie pas.** Une fusion sur `main` ne change **rien** au site
   servi (connexion GitHub échouée, voir « Le back-office web »). Il faut
   `npx vercel deploy --prod --scope rack8 --yes` depuis la racine. Fait le 12 sept.
2. **Les migrations ne partent pas seules.** Le 12 sept., la base hébergée avait
   **sept migrations de retard** (`20260911101000` → `20260912090000`), soit deux
   tickets entiers (waitlist + émetteur d'invitations + reprise). Poussées par
   `supabase db push --linked`. Le cron `rack-expire-waitlist-offers` tourne
   désormais. **`db push` est un geste manuel** — le rappeler à chaque lot qui
   ajoute une migration destinée à la box.
3. **La configuration d'URL de Supabase Auth n'avait jamais été posée.** *Site URL*
   restait `http://localhost:3000`, donc **tout lien de connexion renvoyait vers
   localhost** — cassé pour quiconque n'est pas sur la machine de dev. Corrigé :
   - **Site URL** = `https://rack-web-eight.vercel.app`
   - **Redirect URLs** : `https://rack-web-eight.vercel.app/**`,
     `https://rack-web-rack8.vercel.app/**`, `http://localhost:3000/**`
   (Supabase → *Authentication → URL Configuration*.) À reposer vers le **domaine**
   quand il servira le back-office.

### Variables Vercel de l'émetteur d'invitations (`P1-018`), posées le 12 sept.

| Variable | Type | Environnements | Valeur |
| --- | --- | --- | --- |
| `BREVO_API_KEY` | **Sensitive** | Production | la clé API Brevo (jamais ici) |
| `RACK_INVITE_URL` | Config | Production **+** Preview | **provisoire** `https://rack-web-rack8.vercel.app/login` — à remplacer par le lien TestFlight |

> **À vérifier** : le déploiement du 12 sept. n'a aliasé que `rack-web-eight.vercel.app`.
> Si `rack-web-rack8.vercel.app` sert encore le build du 11 sept., `RACK_INVITE_URL`
> pointe un build périmé — le corriger vers `rack-web-eight` (ou le domaine).

### La CI n'est pas une barrière de fusion — à poser

**Cinq PR (#82→#86) ont fusionné par-dessus une CI rouge** (job « Format », voir
`fix(ci)` du 12 sept.). La **protection de branche GitHub n'exige donc pas les
checks verts avant fusion** — sinon ces merges auraient été bloqués. C'est un
réglage à poser (*Settings → Branches → Branch protection → Require status checks
to pass*), et il vit **hors du dépôt**, d'où sa place ici. Sans lui, une CI rouge
qui dure cesse d'être un signal, et le prochain rouge (anti-fuite, concurrence)
ressemblera au rouge d'hier. *(Non vérifié depuis cette machine — à confirmer dans
les réglages du dépôt.)*

### Checklist de mise en service — à passer avant que la box arrive

Aucune n'est couverte par une CI verte ou une fusion. Dans l'ordre :

- [ ] `supabase db push --linked` : la base hébergée porte **toutes** les migrations
      (comparer à `supabase/migrations/`), et `select version()` commence par `17`.
- [ ] `npx vercel deploy --prod --scope rack8 --yes` : le site sert le **dernier**
      build (vérifier une chaîne récente à l'écran, pas juste un `200`).
- [ ] Supabase *Authentication → URL Configuration* : Site URL = l'adresse publique
      réelle (pas localhost), Redirect URLs à jour.
- [ ] Variables Vercel posées **avant** le déploiement, prod **et** preview au besoin.
- [ ] Gabarits d'e-mail hébergés recopiés (voir `email-et-domaine.md`), OTP = 6.
- [ ] Passage Supabase **Pro** et Vercel **Pro** (voir `P1-016`).
- [ ] Protection de branche GitHub exigeant la CI verte (ci-dessus).

## Ce qui vit hors du dépôt

| Élément | Où | Note |
| --- | --- | --- |
| Jeton d'accès Supabase | trousseau du CLI (`supabase login`) | jamais commité |
| Mot de passe de la base | tableau de bord Supabase ; trousseau du CLI ; `supabase/.temp/hosted-db-url` (git-ignoré) | **partagé une fois en clair dans une conversation le 11 sept. — à réinitialiser** (tableau de bord → Database → Reset password) après la mise en place |
| `anon key` | tableau de bord Supabase → API | **publique** par construction (RLS fait foi) ; part dans le bundle web |
| `push_emitter_url` | table `app_runtime_config` (hébergé **et** local) | non secret ; posé par l'`insert` ci-dessus |
| Variables Vercel | tableau de bord Vercel | les deux `NEXT_PUBLIC_*` ci-dessus |

## Décommissionner le montage temporaire — l'ordre compte

Quand la mise en place hébergée est finie :

1. **Supprimer `supabase/.temp/hosted-db-url`** — dès la fin du travail SQL, pas
   « plus tard ». Le fichier est jetable ; il n'a aucune raison de survivre.
2. **Réinitialiser le mot de passe de la base** (tableau de bord → Database →
   Reset password) — il est passé en clair dans une conversation le 11 sept. 2026.

**Le piège, et c'est pourquoi l'ordre est écrit :** supprimer le fichier
**seulement après** le reset laisse, dans l'intervalle — ou pour toujours si on
oublie l'étape — un fichier qui porte un mot de passe **mort** mais a l'exacte
apparence d'un secret **valide**. Le prochain qui le trouve ne saura pas qu'il est
périmé. On retire donc le fichier **d'abord** (il est jetable), le reset ensuite :
à aucun moment il n'existe de fichier « valide en apparence, mort en réalité ». Si
le fichier a malgré tout survécu au reset, le supprimer aussitôt et vérifier qu'il
a disparu.
