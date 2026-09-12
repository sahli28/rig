# `P1-017` — La première infrastructure de production

**Phase** `P1` · **Estimation** `1,5` j·h · **Dépend de** rien · **À jouer pendant** `P1-008a` · **Spec** §15.1, §18.4 · **Origine** découpe de `P1-016`, 9 septembre 2026

## Objectif

Un projet Supabase hébergé en région UE porte le schéma du dépôt, le back-office
web répond sur une adresse publique, **et l'émetteur push y prouve la chaîne de
notification de bout en bout** — **des semaines avant** qu'une box en ait besoin.

## Pourquoi ces deux lots sortent de `P1-016`

`P1-016` dépend de tout le reste de ① : c'est la mise en service, elle vient en
dernier. Mais deux de ses lots techniques **ne dépendent de rien** — le projet
hébergé et le déploiement web — et ce sont précisément ceux qui portent la
nouveauté : première infrastructure de production, première migration contre une
base qui n'est pas locale, premiers secrets hors d'un `.env.local`, et la
vérification du major 17 que `CLAUDE.md` attend depuis le 6 septembre.

**Les jouer en novembre, la même semaine que la box, concentrerait tout
l'inconnu au moment où on a le moins de marge.** Même raisonnement que pour le
compte Apple : ce dont on ne contrôle pas le déroulé se lance tôt. Ils ne
bloquent personne, et ils ne servent à rien de plus tard.

Ce qui reste dans `P1-016` est ce qui dépend vraiment du reste : le build
TestFlight, les invitations, la sauvegarde restaurée, et les quatre jours
d'accompagnement.

## Ce que ce ticket suppose et qui doit exister

*Chaque état est vérifié dans le dépôt, le 9 septembre 2026.*

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Le schéma, rejouable de zéro | `supabase/migrations/`, `supabase db reset` en CI | ✅ **c'est exactement ce qui rend le ticket court** : la CI reconstruit le schéma à chaque PR, donc il n'y a rien à « préparer » — seulement à appliquer ailleurs |
| Le major attendu | `supabase/config.toml:41` — `major_version = 17` | ✅ **et la case à cocher est déjà écrite dans `CLAUDE.md`** : le projet hébergé doit porter le même major. Une divergence ne se découvre pas à la migration, elle se découvre sur une fonction absente, en production |
| `pg_cron` | `20260902120000:389` | ⚠️ activé en local par migration ; **sur un projet hébergé, c'est une extension à activer dans le tableau de bord** — à vérifier le jour même, c'est le premier candidat au « ça marchait en local » |
| Un compte Supabase et une organisation | *rien* | ❌ **à créer** — un compte personnel suffit, l'entité juridique n'est pas requise. Région **UE** obligatoire (ADR 0001, spec §15) |
| Un compte Vercel | *rien* — Vercel n'est qu'un nom dans l'ADR 0001 | ❌ **à créer**. Le monorepo pnpm + Turborepo se déploie tel quel ; ce qui se configure est le répertoire racine `apps/web` et les variables |
| Les secrets de `apps/web` | `apps/web/.env.local`, ignoré par git | ⚠️ **à poser dans le fournisseur, jamais dans le dépôt** — et à lister, pour qu'un second déploiement ne les redécouvre pas |
| **Un envoi d'e-mails qui tient 80 invitations** | *rien* — en local, Mailpit reçoit tout | ❌ **le trou que ce ticket a trouvé.** Le SMTP intégré d'un projet Supabase hébergé est **limité à quelques envois par heure** et prévu pour le développement ; la limite exacte se vérifie sur le projet le jour où il existe, mais l'ordre de grandeur interdit d'inviter 80 membres. Il faut un SMTP tiers, **donc un domaine avec SPF, DKIM et DMARC** — la ligne du chemin critique qui n'attendait que P2-015 et D-008 attend désormais aussi **P1-016** |
| Une adresse publique pour le back-office | *rien* | ⚠️ l'URL du fournisseur suffit pour le pilote ; le domaine n'est bloquant **que** pour l'e-mail, pas pour l'accès |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --- | --- | --- |
| Le projet hébergé, à jour du schéma, major 17 vérifié | le build TestFlight et les invitations | `P1-016` |
| **L'émetteur push déployé et servi** | la passe § 5 nonies de `P1-007` — **iOS < 30 s** et le deep link `rack://`, les deux `[ ]` d'appareil de `P1-007`, prouvés sur la chaîne réelle | `P1-007` |
| Le back-office déployé | la box, le jour de la configuration en visio | `P1-016` |
| Le SMTP tiers configuré | les invitations, les liens de connexion, puis les e-mails transactionnels | `P1-016`, puis `P2-015` |
| La liste des secrets et de ce qui se configure hors du dépôt | le second déploiement, et quiconque reprend le projet | celui-ci — **dans `docs/procedures/`** |

## Périmètre

- **Le projet Supabase hébergé** : région UE, migrations appliquées depuis le
  dépôt, `pg_cron` vérifié, **major 17 lu dans le projet et non supposé**.
- **L'émetteur push, déployé et servi** sur le projet hébergé :
  `supabase functions deploy rack-push-emitter`, **`pg_net` et `pg_cron` activés**
  (par `create extension` dans les migrations — pas de réglage de tableau de
  bord, vérifié), et **l'URL posée dans la table `app_runtime_config`** — **pas un
  GUC** : l'hébergé refuse `ALTER DATABASE|ROLE SET` à `postgres`, voir la Note de
  réalisation et la migration `20260911100800`. C'est ce qui **sert l'émetteur
  pour de vrai**, et rend la passe § 5 nonies de `P1-007` jouable — donc ferme ses
  deux `[ ]` d'appareil, sur la chaîne réelle et non un montage local.
- **Le déploiement de `apps/web`** sur Vercel, variables posées, une adresse qui
  répond.
- **Le SMTP tiers**, ou l'arbitrage écrit qui explique pourquoi il attend — mais
  pas le silence.
- **Une procédure** dans `docs/procedures/` : ce qui vit hors du dépôt, où, et
  comment on le recrée. C'est le livrable qui survit au ticket.

**L'ordre interne, et il compte.** Le projet hébergé, l'émetteur et le web ne
demandent qu'un **compte Supabase gratuit (région UE) et un compte Vercel** —
**aucun domaine**. Le SMTP tiers est le **seul** lot derrière le domaine (au
pilote, l'accès par lien de connexion passe par l'URL du fournisseur, voir
« ce que ce ticket suppose »). **Ne pas laisser l'e-mail retarder ce qui débloque
le push** : les deux `[ ]` de `P1-007` sont derrière le lot hébergé + émetteur,
pas derrière un achat de domaine qui a déjà glissé trois fois.

## Hors périmètre

- **Le build iOS et TestFlight** → `P1-016`. Il dépend du projet hébergé, pas
  l'inverse.
- **La sauvegarde restaurée** → `P1-016`. Rien n'empêche de la jouer dès que le
  projet existe, et c'est même recommandé ; elle reste là-bas parce que c'est son
  critère d'acceptation qui la porte.
- **Le domaine lui-même.** C'est une démarche du chemin critique hors code, pas
  un lot de ce ticket. Ce ticket dit ce qu'il attend d'elle.
- **Toute donnée réelle.** Le projet hébergé reçoit le seed ou rien ; les
  membres de la box arrivent avec `P1-016`, et avec le RGPD qui va avec.

## Le SMTP tiers : pourquoi il attend, et jusqu'à quand

**L'arbitrage écrit que le critère réclame — parce que le silence serait pire que
l'attente.** Le SMTP tiers est le seul lot de ce ticket qui n'est **pas** joué
maintenant. Il attend le domaine, et lui seul.

**Pourquoi le domaine.** Faire _arriver_ un e-mail dans 80 boîtes de réception,
ce n'est pas l'envoyer : c'est prouver au récepteur qu'on écrit légitimement au
nom d'un domaine — SPF, DKIM, DMARC, trois enregistrements DNS sur un domaine
qu'on possède. Sans domaine, rien où les poser, donc pas de SMTP tiers à
configurer : le lot n'a pas d'objet aujourd'hui. Le SMTP **intégré** du projet
hébergé ne comble pas le trou — plafonné à quelques envois par heure, prévu pour
le développement, pas pour un envoi de masse.

**Jusqu'à quand.** Jusqu'à `P1-016`, pas avant : c'est là que tombe le premier
envoi qui _exige_ le domaine, les **80 invitations** de la mise en service. Le
domaine est déjà sur le chemin critique hors code ; ce ticket ne le déplace pas,
il **nomme la dépendance** au lieu de la laisser en blanc.

**Ce que l'attente ne bloque pas — et c'est tout l'enjeu.** Les quatre lots joués
maintenant (projet hébergé, émetteur, réglage, web déployé) ne touchent pas
l'e-mail : le push part par Expo, pas par SMTP, et l'accès au back-office pendant
la configuration se fait par **lien de connexion** — quelques magic links pour
l'équipe de la box et nous, très en-deçà du plafond du SMTP intégré. Les deux
`[ ]` d'appareil de `P1-007` sont derrière l'émetteur, jamais derrière l'e-mail.
**L'attente du domaine ne retarde donc ni les quatre lots ni la passe § 5
nonies.**

**Le bord honnête.** Le jour où l'on enverra 80 invitations d'un coup avec le
seul SMTP intégré, elles seront étranglées ou refusées — ce n'est pas une
hypothèse à vérifier, c'est la raison d'être du lot. Il est donc **vraiment**
suspendu au domaine, et `P1-016` le porte déjà dans ses prérequis. Côté SMTP, ce
ticket se ferme sur **cet arbitrage** (son critère le prévoit), et le temps non
consommé du lot migre vers `P1-016`, comme l'Estimation l'annonce.

> **Mise à jour — 11 septembre 2026.** La prémisse « sans domaine, pas d'objet » est
> **caduque** : `rack-app.fr` est acheté et actif sur OVH. Le SMTP tiers **n'attend
> plus l'acquisition du domaine** — il attend la pose des enregistrements DNS
> (SPF/DKIM/DMARC), le câblage du dashboard Supabase et la preuve d'un e-mail signé
> reçu, désormais écrits pas-à-pas dans `docs/procedures/email-et-domaine.md` (volet de
> `P1-016`). L'arbitrage de ce ticket reste vrai — le lot n'était pas joué **ici** — mais
> son objet existe maintenant, et le travail a bien migré dans `P1-016`.

## Critères d'acceptation

- [x] `select version()` sur le projet hébergé commence par `PostgreSQL 17` —
      lu, pas déduit : **17.6**
- [x] Toutes les migrations du dépôt sont appliquées, et `pnpm test:db` **contre
      le projet hébergé** rend le même vert qu'en local (30 fichiers, 583 tests,
      via le pooler `--db-url`) — **et il a acheté deux vrais défauts**, verts en
      local et rouges sur l'hébergé, corrigés dans `20260911100900` (voir Note de
      réalisation). C'est la preuve « qu'il tourne », pas « qu'on l'a copié »
- [x] `pg_cron` est actif ; le job de `P1-002` (`rack-maintain-class-occurrences`)
      et trois autres apparaissent dans `cron.job` (4 jobs actifs)
- [ ] `pg_net` actif ; `pg_cron` **accepte la planification sous-minute** (le
      balayage `'30 seconds'` exige pg_cron ≥ 1.5, sinon la migration du transport
      échoue à l'application) ; `rack-push-emitter` déployé et **joignable SANS
      en-tête d'auth** — `curl -i <url>` **sans `apikey` rend 200**, preuve que
      `verify_jwt = false` est honoré au déploiement. Sinon Kong exige un JWT, le
      `net.http_post` sans en-tête prend 401, `kick_push_emitter` **avale
      l'exception**, et la ligne reste `pending` **pour toujours** (jamais
      `failed`) — le piège « conclu cassé ». La table `app_runtime_config`
      (clé `push_emitter_url`) pointe l'URL complète
      `…/functions/v1/rack-push-emitter`, et le drain fonctionne de bout en bout —
      c'est l'unique chemin, **il n'y a pas de repli SQL**. **Vérifié le 11 sept.
      2026** : `curl` sans apikey → `200` ✅ ; le balayage `pg_cron` frappe la
      fonction (huit `200` dans `net._http_response`) ✅ ; un enfilage réel est
      **claimé, envoyé à exp.host et marqué en 441 ms** ✅. Le **`sent` terminal**
      lui-même reste `[ ]` : exp.host renvoie `DeviceNotRegistered` pour tout
      jeton synthétique — seul un **vrai appareil** (§ 5 nonies) le produit
- [x] Le back-office répond sur son adresse publique — ✅ `rack-web-rack8.vercel.app`
      en `200`, la page rend (protection de déploiement Vercel désactivée). La
      connexion par lien **avec un vrai e-mail reçu** (pas Mailpit) est **prouvée le
      12 sept. 2026** : magic link signé reçu en boîte, `SPF/DKIM/DMARC = pass`
      (`d=rack-app.fr`, sélecteur `brevo2`), expéditeur `Rack <bonjour@rack-app.fr>`,
      code à 6 chiffres, `mail-tester` 7,9/10
      (`docs/procedures/email-et-domaine.md`, volet `P1-016`)
- [x] Le SMTP tiers est en place — **prouvé le 12 sept. 2026** : Brevo signé sur
      `rack-app.fr` (DNS OVH posés, dashboard Supabase câblé, plafond horaire à 100),
      magic link reçu `SPF/DKIM/DMARC = pass`. L'arbitrage « pourquoi il attendait »
      reste écrit ci-dessus pour mémoire ; il n'attend plus rien. Détail dans le
      runbook du volet `P1-016` (`docs/procedures/email-et-domaine.md`)
- [ ] `docs/procedures/` porte la liste de ce qui vit hors du dépôt
- [ ] Aucun secret dans un commit — vérifié par `git log -p` sur la branche,
      pas supposé

## Estimation

| Lot | j·h |
| --- | ---: |
| Projet Supabase hébergé, migrations, `pg_cron`, major 17, `test:db` distant | 0,75 |
| **Émetteur push : `pg_net`, `functions deploy`, `push_emitter_url` — débloque § 5 nonies de `P1-007`** | 0,25 |
| Déploiement web, variables, adresse, premier lien de connexion réel | 0,5 |

**1,5 j·h.** Le web et le projet hébergé (1,25) sont sortis de `P1-016`, qui passe
de 3 à 1,75 — ceux-là ne bougent pas le total. **L'émetteur (+0,25) est neuf** :
c'est le lot qui prouve la chaîne de notification hors de la semaine de la box,
exactement la raison pour laquelle ces lots sont sortis de `P1-016`. **① : 113,75
→ 114.** Le SMTP tiers est compté dans le premier lot ; s'il attend le domaine, le
lot se ferme avec l'arbitrage écrit et le temps non consommé reste dans `P1-016`.

## Note de réalisation — 11 septembre 2026

Le projet hébergé existe (`llakbulflemibnfagnyh`, `eu-west-3`). Ce qui est
**fait et vérifié en base, pas déduit** :

- `select version()` → **PostgreSQL 17.6** ; 39 migrations appliquées ; 26 tables.
- `pg_cron 1.6.4`, `pg_net 0.20.4`, `supabase_vault 0.3.1` **activés par
  `create extension` dans les migrations** — aucun réglage de tableau de bord.
  Le prérequis « pg_cron à activer au tableau de bord » était une prudence
  inutile.
- Les quatre jobs `cron.job` sont présents et actifs ; le balayage
  **`'30 seconds'` a été accepté** (pg_cron ≥ 1.5, confirmé).
- Émetteur déployé ; **`curl -i` sans apikey → `200`** : `verify_jwt = false`
  honoré au premier déploiement, sans `--no-verify-jwt`. *(Piège de redéploiement
  à retenir, documenté dans `docs/procedures/` : un bug connu du CLI peut ne pas
  ré-appliquer `verify_jwt = false` sur une mise à jour ; re-vérifier le bouton,
  ou passer `--no-verify-jwt`, à chaque redéploiement de l'émetteur.)*
- **Le GUC est mort sur l'hébergé, et c'est la trouvaille de ce lot.** `postgres`
  n'y est pas superutilisateur et `supautils` lui refuse tout `ALTER
  DATABASE|ROLE SET` de paramètre personnalisé (préfixe réservé `app.settings.*`
  **comme** libre `rack.*`). Le réglage `push_emitter_url` passe donc par une
  **table de configuration** (`app_runtime_config`, migration `20260911100800`,
  `rls-auditor` : SAFE) — arbitré contre Vault (l'URL n'est pas un secret ;
  ADR 0001 réversibilité ; parité local/hébergé). Détail dans la migration.
- **Chaîne prouvée de bout en bout** : URL en table → `net.http_post` → fonction
  déployée → `claim` → **exp.host réel** → `mark`, en **441 ms** ; huit `200`
  dans `net._http_response` du balayage.

**Ce que la mise en production anticipée a acheté — deux vrais défauts,** verts
en local et rouges sur l'hébergé, trouvés par `test:db` contre l'hébergé (30
fichiers, 583 tests) et corrigés dans `20260911100900` :

1. **Aucun membre ne pouvait modifier son profil sur l'hébergé.**
   `forbid_email_change()` (gel de l'e-mail) lit `auth.users` en `SECURITY
   INVOKER` ; `authenticated` n'a pas SELECT sur `auth.users` sur l'hébergé →
   toute édition (`first_name`, …) échouait en `42501`. **Ce défaut serait tombé
   le jour 1 de la box pilote, sur les 80 membres à la fois** — c'est l'argument,
   chiffré, de la découpe qui a sorti `P1-017` de `P1-016`. Fix : `SECURITY DEFINER`.
2. **Créer une série avec date de fin échouait sur l'hébergé.**
   `pilot_weekly_rrule_until`, dans un CHECK de `class_schedules` (donc évalué
   sous l'appelant), n'était pas accordée à `authenticated` — la sœur oubliée de
   `pilot_weekly_rrule_valid`. Fix : le `grant` manquant.

**Le vrai livrable, c'est pourquoi le local ne les voyait pas.**
`auto_expose_new_tables` valait `true` en local (défaut) et `false` sur l'hébergé
(choix de création) : le local auto-accordait des droits que l'hébergé refuse.
`config.toml` passe à `false` — le local exécute désormais le **même** modèle de
droits que l'hébergé, et `test:db` mord sur un grant oublié au lieu de le laisser
filer en production. Vérifié : avec le réglage, `test:db:fresh` confirme le
correctif, et une sœur non nécessaire (`_days`, definer-only) reste bien refusée
à `authenticated`. (Le défaut n°1 reste invisible en local — `auth.users` y est
permissif quel que soit ce réglage ; il est prouvé corrigé **sur l'hébergé**, où
la re-passe de `test:db` est verte.)

**pgTAP est sur l'hébergé, et ce n'est pas une anomalie** : il vient de
`20260830143104:17` (`create extension if not exists pgtap`), donc posé par
`db push`. Mais c'est de l'**outillage de test en production** — à conditionner :
`D-026`. Ne pas le retirer à la main (une reconstruction le recrée).

Ce qui **reste `[ ]`** (et pourquoi) :

- **La purge vers schéma seul** — le seed de démo est encore sur l'hébergé (il a
  servi à la re-passe de `test:db`). `supabase db reset --linked --no-seed` est
  l'outil propre, mais bloqué par le classifieur de sécurité (opération distante
  destructrice), et je ne contourne pas les gardes append-only par `TRUNCATE`
  (piège 5). À lancer par la commanditaire, puis je re-pose `push_emitter_url`.
- **Le `sent` terminal** — exp.host rend `DeviceNotRegistered` pour tout jeton
  synthétique ; seul un **vrai appareil** le produit, à la passe § 5 nonies.
- **À vérifier en § 5 nonies** : un `DeviceNotRegistered` réel doit **révoquer**
  le jeton (`revoke_device`) ; un enfilage de test avec jeton synthétique a rendu
  `revoked:0` là où `interpretExpoResponse` devrait révoquer — soit un artefact
  transitoire d'Expo (repli « no ticket »), soit un vrai trou à confirmer avec un
  jeton réel.
- **Le déploiement web** — ✅ **fait** : `rack8/rack-web` (Next.js), déployé
  **depuis la racine** du dépôt (rootDirectory `apps/web` posé par l'API — le
  `link` non interactif le laisse `null`), protection de déploiement Vercel
  **désactivée** (sinon SSO d'équipe = back-office injoignable pour la box ; il a
  sa propre auth), adresses publiques `rack-web-rack8.vercel.app` /
  `rack-web-eight.vercel.app` en **`200`**, la page rend (i18n FR/EN).
  `docs/procedures/deploiement-heberge.md` renseigné (build hébergé, prebuilt
  inutilisable sous Windows — `EPERM` symlink, pose de la valeur des deux côtés,
  décommissionnement du montage temporaire).
- **Défaut relevé, hors périmètre infra** : erreur React #418 (décalage
  d'hydratation) sur l'accueil web — la page se rétablit côté client ; à traiter
  séparément (accueil `apps/web`, probablement langue/thème SSR ≠ client).

## Notes

**Ce ticket est le premier où le dépôt cesse d'être tout le produit.** Jusqu'ici,
`git clone` + `supabase start` donnait Rack en entier. Après lui, une partie vit
dans deux tableaux de bord — et c'est pour ça que la procédure est un livrable,
pas une note : le jour où il faut recréer le projet, personne ne doit avoir à se
souvenir.
