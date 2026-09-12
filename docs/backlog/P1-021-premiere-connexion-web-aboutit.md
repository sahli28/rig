# `P1-021` — La première connexion par le web aboutit

**Phase** `P1` · **Estimation** `0,5` j·h *(à ratifier)* · **Dépend de** rien · **Spec** §16.4 · **Origine** répétition de la mise en service, 12 septembre 2026 — règle 8

## Objectif

Un compte **jamais confirmé** peut se connecter par le web. Aujourd'hui, c'est un
cul-de-sac.

## La découverte

En répétant la mise en service le 12 sept. 2026 : impossible de faire une première
connexion web sans SQL. Deux moitiés d'un même mur :

- le gabarit **« Confirm sign up »** ne porte **que le code** (pas de
  `{{ .ConfirmationURL }}`) — voir `email-et-domaine.md`, gabarits recopiés à la main ;
- l'écran **`/login`** n'a **aucun champ pour saisir un code** : il ne propose que
  « Recevoir le lien ».

Tant que l'adresse n'est pas confirmée, Supabase renvoie **ce gabarit-là** : ni lien
à cliquer, ni code à saisir. Il a fallu `update auth.users set email_confirmed_at =
now()` pour en sortir. **Le coach de la box pilote heurtera le même mur** à sa
première connexion au back-office.

## Ce que ce ticket suppose et qui doit exister

*Vérifié dans le dépôt, le 12 septembre 2026.*

| Prérequis | Où il vit | État |
| --- | --- | --- |
| L'écran `/login` web | `apps/web/app/login/` | ✅ existe — il ne gère que le **lien**, pas le **code** |
| Les gabarits d'e-mail hébergés | dashboard Supabase (recopiés) | ⚠️ « Confirm sign up » ne porte que le code |
| Le flux OTP/magic link | Supabase Auth | ✅ — c'est la jonction écran ↔ gabarit qui manque |

## Périmètre — trancher **une** des deux voies, et la tenir des deux côtés

1. **Ajouter `{{ .ConfirmationURL }}`** au gabarit « Confirm sign up » (dépôt
   `supabase/templates/` **et** dashboard) — la première connexion se fait par un
   lien cliquable, comme la connexion courante web. *Le plus petit correctif.*
2. **ou** ajouter un **champ de saisie de code** à `/login` web, en parité avec le
   mobile.

**Décision proposée : (1)** — le web vit déjà du lien (`emailRedirectTo`) ; lui
donner le lien de confirmation ferme le trou sans nouvel écran. **À ratifier.**
Quelle que soit la voie, elle vaut **côté dépôt et côté dashboard** (les gabarits ne
sont pas versionnés sur l'hébergé — `email-et-domaine.md`).

## Hors périmètre

- Le parcours mobile (il saisit déjà un code).
- Le SSO (`P0-005b`, non programmé).

## Critères d'acceptation

- [ ] Un compte neuf, **jamais confirmé**, se connecte par le web **sans SQL**.
- [ ] Le correctif est posé **dans le dépôt et dans le dashboard** (les deux, sinon
      l'hébergé diverge).
- [ ] **appareil / mise en service** : la première connexion réelle du staff de la
      box aboutit.

## Notes

À faire entrer dans ①. **Bloquant** : sans lui, l'OWNER de la box ne peut pas entrer
dans le back-office à sa première connexion — et donc pas créer sa box (`P1-020`).
