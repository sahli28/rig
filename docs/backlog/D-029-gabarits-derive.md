# `D-029` — Les gabarits d'e-mail du dashboard rougissent tout seuls quand ils décrochent

**Phase** `dette` · **Estimation** `0,75` j·h · **Dépend de** `P1-017` ✅ (projet hébergé lié) · **Spec** — · **Origine** test de bout en bout du 12 septembre 2026 : **troisième** dérive gabarits dashboard ↔ dépôt

## Objectif

Un gabarit d'e-mail modifié dans le dépôt sans être reporté sur le dashboard
Supabase hébergé **se voit avant d'atteindre une boîte mail** — au lieu de se
découvrir sur un e-mail réel, chez un membre, comme les trois fois précédentes.

## Le constat qui le justifie

Trois dérives en dix jours, même cause : les gabarits vivent **deux fois** —
`supabase/templates/*.html` + objets dans `supabase/config.toml` côté dépôt,
et une recopie **manuelle** dans le dashboard côté hébergé. Le runbook
`email-et-domaine.md` dit « recopier à la main », et **rien ne vérifie** que ça
a été fait : ① gabarits jamais recopiés (P1-021), ② objets uniques absents,
③ le 12 septembre au soir, la première connexion propriétaire échouait jusqu'à
la recopie. `pnpm heberge:derive` (P1-023) fait exactement ce filet pour les
migrations ; les gabarits sont sa sœur oubliée — la forme exacte de la règle
des sœurs.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Les gabarits versionnés | `supabase/templates/confirmation.html`, `magic-link.html` + objets `supabase/config.toml:282-295` | ✅ existent |
| Le projet hébergé lié (`supabase link`) | trousseau de la machine, `deploiement-heberge.md` | ✅ fait |
| Un accès en lecture à la config Auth hébergée | API de gestion Supabase (`GET /v1/projects/{ref}/config/auth`) | ✅ **tranché au build (13 sept.)** : l'API de gestion, avec un **jeton d'accès personnel passé en `SUPABASE_ACCESS_TOKEN` au moment du geste** — jamais stocké dans le dépôt. Le jeton du `supabase login` vit dans le trousseau Windows, qu'un script n'a pas à fouiller. `supabase config push` est **exclu** : pas de `--dry-run` dans le CLI (v2.116 vérifié), et il écraserait la config entière — dont `site_url = localhost` — vers la prod |
| Le modèle de script à trois issues | `scripts/heberge-derive.mjs` (P1-023) | ✅ existe — même forme, même règle 10 |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `pnpm gabarits:derive` | la checklist de déploiement (`deploiement-heberge.md`), le même geste que `heberge:derive` | celui-ci |

## Périmètre

- Un script `scripts/gabarits-derive.mjs` qui compare corps **et objets** des
  gabarits du dépôt à ce que le projet hébergé lié sert réellement, en lecture
  seule.
- Trois issues nommées, jamais un vert par défaut : `À JOUR` / `DÉRIVE` (le
  gabarit et le champ en cause) / `ILLISIBLE` (ne rien conclure).
- La ligne correspondante dans la checklist de `deploiement-heberge.md`, et le
  runbook `email-et-domaine.md` qui cesse de dire « recopier à la main » sans
  filet.

## Hors périmètre

- Pousser automatiquement les gabarits vers l'hébergé (`config push` en CI) :
  un déploiement, pas un contrôle — et personne n'a encore mesuré ce que
  `config push` écrase d'autre. À arbitrer le jour où la dérive rougit trop
  souvent.
- Les e-mails applicatifs Brevo (P1-018) : leur gabarit vit dans le code
  déployé, il ne peut pas dériver.

## Critères d'acceptation

- [x] Un gabarit modifié dans le dépôt sans recopie → `DÉRIVE`, avec le champ en
      cause — **joué le 13 sept.** contre un simulateur local de l'API (le
      script exécuté tel quel, seule `SUPABASE_API_URL` change — la variable que
      le CLI honore) : objet ancien → « contenus différents (43 car. / 19
      car.) », corps vide → « l'hébergé sert le gabarit PAR DÉFAUT »
- [x] Dépôt et dashboard alignés → `À JOUR`, avec le compte de champs — **joué
      le 13 sept.** contre le simulateur, y compris avec du **CRLF et des
      espaces de bord** côté « hébergé » : une recopie à la main ne dérive que
      sur le contenu, pas sur les fins de ligne
- [x] L'API inaccessible → `ILLISIBLE`, exit 2, aucun verdict — **joué le 13
      sept. en réel** (jeton absent)
- [ ] Les **deux issues** jouées contre la **vraie** config hébergée — **geste
      commanditaire** : le jeton d'accès personnel est le tien
      (dashboard → Account → Access Tokens), puis
      `SUPABASE_ACCESS_TOKEN=sbp_… pnpm gabarits:derive`. Attendu aujourd'hui :
      `À JOUR` si la recopie du 12 sept. est fidèle — un `DÉRIVE` serait une
      **vraie trouvaille**, à corriger au dashboard puis re-vérifier

## Notes

Si la lecture de la config Auth hébergée s'avère impossible proprement (jeton
d'accès de gestion requis, non stocké), **le repli est une case cochable** dans
la checklist de déploiement — moins bien qu'un filet, mieux que le silence.
Le choix se fait au build, pas en cours de route, et il s'écrit dans le script
ou dans la checklist, jamais dans les deux.
