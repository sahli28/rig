# `P1-023` — Un signal quand l'hébergé décroche

**Phase** `P1` · **Estimation** `0,5` j·h *(à ratifier)* · **Dépend de** rien · **Spec** §18.4 · **Origine** répétition de la mise en service, 12 septembre 2026 — règle 8

## Objectif

Les écarts entre le dépôt et l'hébergé se **voient** au lieu de se découvrir en
butant dessus, un par un.

## La découverte

Le 12 sept. 2026, trois écarts hébergés ont été trouvés **en tombant dedans** (détail
dans `deploiement-heberge.md`, « Rien n'est automatique côté hébergé ») :

- le web servait un build périmé (une fusion ne redéploie pas) ;
- la base avait **sept migrations de retard** (deux tickets) ;
- la Site URL de Supabase Auth était restée sur `localhost:3000`.

**Aucun n'a émis de signal.** La checklist de mise en service (posée dans le runbook)
couvre le cas **manuel** ; ce ticket ajoute le **contrôle qui rougit tout seul**.

## Ce que ce ticket suppose et qui doit exister

*Vérifié dans le dépôt, le 12 septembre 2026.*

| Prérequis | Où il vit | État |
| --- | --- | --- |
| L'accès SQL/CLI à l'hébergé | `supabase link`, pooler (`deploiement-heberge.md`) | ✅ |
| La liste des migrations attendues | `supabase/migrations/` | ✅ |
| La checklist manuelle | `deploiement-heberge.md` | ✅ posée ce jour — ce ticket l'**automatise** en partie |

## Périmètre — minimal, un contrôle qui rougit

- Un **script** (lançable à la main, et candidat CI) qui compare l'hébergé au dépôt
  et **rougit** sur un écart : migrations manquantes (hébergé vs
  `supabase/migrations/`), et — si atteignable simplement — la Site URL ≠ l'adresse
  publique attendue. Il **regarde le résultat**, pas l'intention (même esprit que
  `pnpm migrations:immuables`, D-014).
- Il **rend deux issues nommées, jamais une impression** (forme de
  `scripts/test-db.mjs`, règle 10).

## Hors périmètre

- Une supervision continue / alerting externe (Sentry, uptime) — hors pilote.
- Le redéploiement automatique du web (rebrancher Vercel sur GitHub est une piste,
  notée dans `deploiement-heberge.md`, mais c'est une autre démarche).

## Critères d'acceptation

- [x] Le script signale une base hébergée en retard de migrations (testé en le
      mettant volontairement en retard) — **testé contre la vraie base hébergée**,
      voir Réalisation : une migration temporaire non poussée → `DÉRIVE… EN RETARD
      de 1 migration(s)`, exit 1.
- [x] Sortie : issues nommées, pas un « ça a l'air bon » — trois issues, `À JOUR`
      (avec le compte), `DÉRIVE` (la liste, par sens), `ILLISIBLE` (exit 2, jamais
      un vert par défaut).
- [x] Documenté dans `deploiement-heberge.md` à côté de la checklist (dont la
      première ligne passe par lui), et dans les commandes de `CLAUDE.md`.

## Réalisation — 12 septembre 2026

**`pnpm heberge:derive`** (`scripts/heberge-derive.mjs`). Il enveloppe
`supabase migration list --linked --output-format json` — **lecture seule**, le mot
de passe vit dans le trousseau du `link`, aucun credential dans le script — et
compare **dans les deux sens** : dépôt sans hébergé (**en retard** → `db push`),
hébergé sans dépôt (**inconnue du dépôt** — pire, à élucider avant tout push).

Deux gardes hérités de D-014/règle 10 :

- **auto-recoupement** : ce que le CLI dit du local doit recouper exactement
  `supabase/migrations/` ; sinon le contrôle ne voit plus ce qu'il contrôle →
  `ILLISIBLE`, exit 2, **jamais un vert** ;
- le vert **nomme sa portée** : « ne couvre que les migrations » — le build web
  périmé et la Site URL restent sur la checklist manuelle, et le message le dit
  pour que le vert ne soit pas sur-lu.

**Prouvé contre la vraie base hébergée** (deux issues jouées, pas déduites) :
`À JOUR — 48 migrations` (exit 0) ; puis une migration temporaire
`20990101000000_test_derive.sql`, jamais commitée → `DÉRIVE… EN RETARD de
1 migration(s) : 20990101000000` + le correctif (exit 1) ; fichier supprimé, retour
au propre. En CI : possible avec un secret `SUPABASE_DB_PASSWORD`, **non câblé** —
le contrôle est un geste, du même statut que le `db push` dont il vérifie l'oubli.

## Notes

À faire entrer dans ①. **Non bloquant** pour la mise en service (la checklist manuelle
couvre le jour J) — mais le premier écart silencieux a coûté une session de
diagnostic, et il y en aura d'autres. Le plus petit filet qui rende le silence
visible.
