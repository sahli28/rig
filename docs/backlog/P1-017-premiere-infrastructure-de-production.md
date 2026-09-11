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
  `supabase functions deploy rack-push-emitter`, **`pg_net` activé** (comme
  `pg_cron`, dans le tableau de bord), et **`app.settings.push_emitter_url` posé**
  sur l'URL de la fonction hébergée. C'est ce qui **sert l'émetteur pour de vrai**,
  et rend la passe § 5 nonies de `P1-007` jouable — donc ferme ses deux `[ ]`
  d'appareil, sur la chaîne réelle et non un montage local.
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

## Critères d'acceptation

- [ ] `select version()` sur le projet hébergé commence par `PostgreSQL 17` —
      lu, pas déduit du tableau de bord
- [ ] Toutes les migrations du dépôt sont appliquées, et `pnpm test:db` **contre
      le projet hébergé** rend le même vert qu'en local. Sans ça, on a copié un
      schéma, pas prouvé qu'il tourne
- [ ] `pg_cron` est actif et le job de `P1-002` apparaît dans `cron.job`
- [ ] `pg_net` actif ; `pg_cron` **accepte la planification sous-minute** (le
      balayage `'30 seconds'` exige pg_cron ≥ 1.5, sinon la migration du transport
      échoue à l'application) ; `rack-push-emitter` déployé et **joignable SANS
      en-tête d'auth** — `curl -i <url>` **sans `apikey` rend 200**, preuve que
      `verify_jwt = false` est honoré au déploiement. Sinon Kong exige un JWT, le
      `net.http_post` sans en-tête prend 401, `kick_push_emitter` **avale
      l'exception**, et la ligne reste `pending` **pour toujours** (jamais
      `failed`) — le piège « conclu cassé ». `app.settings.push_emitter_url`
      pointe l'URL complète `…/functions/v1/rack-push-emitter`, et **un enfilage
      de test passe `pending` → `sent` par le vrai coup de sonnette** : c'est
      l'unique chemin de drain, **il n'y a pas de repli SQL**
- [ ] Le back-office répond sur son adresse publique, la connexion par lien
      fonctionne **avec un vrai e-mail reçu** — pas Mailpit
- [ ] Le SMTP tiers est en place, ou l'arbitrage écrit dit pourquoi pas encore
      et jusqu'à quand
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

## Notes

**Ce ticket est le premier où le dépôt cesse d'être tout le produit.** Jusqu'ici,
`git clone` + `supabase start` donnait Rack en entier. Après lui, une partie vit
dans deux tableaux de bord — et c'est pour ça que la procédure est un livrable,
pas une note : le jour où il faut recréer le projet, personne ne doit avoir à se
souvenir.
