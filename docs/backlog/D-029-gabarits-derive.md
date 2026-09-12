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
| Un accès en lecture à la config Auth hébergée | API de gestion Supabase (`/v1/projects/{ref}/config/auth`) **ou** `supabase config push --dry-run` | ⚠️ **à vérifier au build** — le CLI évolue ; si aucune lecture fiable, replier sur la case de checklist (voir Notes) |
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

- [ ] Un gabarit modifié dans le dépôt sans recopie → `DÉRIVE`, avec le fichier
      et le champ en cause
- [ ] Dépôt et dashboard alignés → `À JOUR`, avec le compte de gabarits comparés
- [ ] L'API inaccessible → `ILLISIBLE`, exit 2, aucun verdict
- [ ] Les **deux issues** jouées contre la vraie base (comme P1-023), pas
      seulement lues dans le code

## Notes

Si la lecture de la config Auth hébergée s'avère impossible proprement (jeton
d'accès de gestion requis, non stocké), **le repli est une case cochable** dans
la checklist de déploiement — moins bien qu'un filet, mieux que le silence.
Le choix se fait au build, pas en cours de route, et il s'écrit dans le script
ou dans la checklist, jamais dans les deux.
