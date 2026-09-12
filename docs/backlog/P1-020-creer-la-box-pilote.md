# `P1-020` — Créer la box pilote (l'appelant minimal de `create_tenant`)

**Phase** `P1` · **Estimation** `1` j·h *(à ratifier)* · **Dépend de** `P1-021` (une première connexion web qui aboutit) · **Spec** §2.6, §13.4 (M3) · **Origine** répétition de la mise en service, 12 septembre 2026 — règle 8

## Objectif

Le jour de la configuration, la box pilote **existe** sans que quiconque ouvre
l'éditeur SQL de production. Aujourd'hui, elle ne peut pas.

## La découverte (règle 7, enfin payée)

`create_tenant(name, slug)` existe depuis `20260830143106`, elle est **testée** — et
**rien ne l'appelle** : ni écran, ni action serveur. `CLAUDE.md` (règle 7) la cite
depuis P0 comme « livrée sans appelant ». En répétant la mise en service le 12 sept.
2026, il a fallu l'invoquer depuis l'éditeur SQL de l'hébergé **en se forgeant un
jeton** (`set_config('request.jwt.claims', …)`) parce qu'elle exige `auth.uid()`.

**C'est le plus gros trou des cinq trouvés ce jour-là**, et la spec en fait un MUST
du MVP (M3 : « sans self-onboarding, chaque client coûte 3 h de votre temps »). En
l'état, **la box pilote ne peut pas naître le lundi matin autrement qu'à la main dans
la prod.**

## Ce que ce ticket suppose et qui doit exister

*Vérifié dans le dépôt, le 12 septembre 2026.*

| Prérequis | Où il vit | État |
| --- | --- | --- |
| `create_tenant(name, slug)`, sécurisée, testée | `20260830143106`, pgTAP | ✅ **c'est l'appelé** ; il ne manque que l'appelant |
| Un **utilisateur authentifié** (le futur OWNER) | Supabase Auth | ⚠️ suppose `P1-021` : sans première connexion web qui aboutit, l'appelant n'a pas d'`auth.uid()` |
| Un écran / une action back-office où loger l'appel | `apps/web` | ❌ **à créer** — c'est ce ticket |

## Périmètre — **minimal**, pas le self-onboarding complet

- Une **action serveur** (ou un écran minimal `/box/nouvelle`) qui appelle
  `create_tenant(name, slug)` sous la session de l'utilisateur connecté, qui en
  devient OWNER. Zod côté serveur, `tenant_id` jamais fourni par le client.
- De quoi que la **personne d'accompagnement** crée la box pilote elle-même, en
  visio, sans SQL.

## Hors périmètre — c'est là que vit `P2-004`

- **Le self-onboarding complet** (M3 : parcours d'inscription public, choix de
  formule, mise en route guidée) reste **`P2-004` — Dashboard box et mise en
  route** (4 j·h, ②). Ce ticket-ci est le **strict nécessaire du pilote** : une box,
  créée une fois, par nous, avec la box. Il **débloque** enfin l'appelant de
  `create_tenant` que règle 7 réclame depuis P0, sans écrire P2-004 en avance.
- Le quota de boxes, la facturation, les invitations d'équipe (déjà `P1-001c`).

## Critères d'acceptation

- [x] Un utilisateur connecté crée une box (nom, slug) **sans SQL**, et en est OWNER
      (ligne `memberships` OWNER, vérifiable) — **prouvé en local** (voir Réalisation).
- [x] `tenant_id` est dérivé de la fonction, jamais d'un champ client — `create_tenant`
      insère `tenants` puis lit l'id ; l'action ne passe que `name`/`slug`.
- [x] Slug en conflit → erreur i18n claire, pas un 500 — `unique_violation` (23505)
      → `box_new.slug_taken`.
- [ ] **appareil / mise en service** : la box pilote réelle est créée par ce chemin,
      pas par l'éditeur SQL (après recopie dashboard de `P1-021` + redéploiement).

## Réalisation — 12 septembre 2026

Chemin : page **`/creer-une-box`** (hors `/box/**`, donc hors du garde middleware —
la page vérifie la session et renvoie vers `/login?next=/creer-une-box` si personne
n'est connecté), action serveur **`createBox`** (Zod `NewBoxSchema`, session fait foi),
wrapper core **`createTenant`** (`packages/core/src/supabase/tenant.ts`). Minimal :
nom + slug ; le reste (fuseau, devise, langue) prend les défauts de la table et se
règle dans les réglages (`P1-001b`). Succès → **redirection vers `/box/[slug]`**.

**Prouvé de bout en bout en local** (session réelle, aucun SQL) : connecté comme
OWNER, `/creer-une-box` → « Box Pilote Test » / `box-pilote-test` → `POST 303` →
`GET /box/box-pilote-test 200`. En base : `tenants` (1), `tenant_settings` (1),
`themes` (1), et `memberships` = **OWNER** pour le compte connecté. **Règle 7 enfin
soldée** : `create_tenant` a un appelant.

**Entrée depuis l'accueil** : elle vient avec `P1-022` (l'accueil qui mène quelque
part et proposera « créer une box » à qui n'en a pas). D'ici là, `/creer-une-box`
est atteignable par son URL — suffisant pour le pilote.

## Notes

À faire entrer dans ① (règle 8 : un travail réel dans aucun chiffre finit nulle
part). **Bloquant pour la mise en service** : sans lui, `P1-016` commence par un
contournement en prod.
