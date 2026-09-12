# `P1-022` — L'accueil web mène à sa box

**Phase** `P1` · **Estimation** `0,5` j·h *(à ratifier)* · **Dépend de** `P1-021` (pour se connecter) · **Spec** §2.6 · **Origine** répétition de la mise en service, 12 septembre 2026 — règle 8

## Objectif

Une fois connecté, on **arrive dans sa box**. Aujourd'hui, on arrive sur un
cul-de-sac.

## La découverte

En répétant la mise en service le 12 sept. 2026 : une fois connectée, on atterrit sur
**« Socle en place. Le back-office arrive en P1. »** — un sélecteur de langue et un
lien vers le système de design. **Rien ne renvoie vers sa box, rien n'indique qu'on
est connecté.** Et c'est aussi **la page que désigne la Site URL** de Supabase (voir
`deploiement-heberge.md`), donc la page d'arrivée **après chaque connexion**.

## Ce que ce ticket suppose et qui doit exister

*Vérifié dans le dépôt, le 12 septembre 2026.*

| Prérequis | Où il vit | État |
| --- | --- | --- |
| L'accueil web | `apps/web/app/page.tsx` | ✅ existe — c'est le placeholder à remplacer par une redirection |
| La session web + les appartenances | `lib/session`, `fetchMe`, `findMembershipBySlug` | ✅ existent (utilisés par `/box/[slug]`) |
| Les écrans de box | `apps/web/app/box/[slug]/…` | ✅ existent |

## Périmètre

- L'accueil, **si l'utilisateur est connecté**, redirige vers **sa box**
  (`/box/[slug]`) ; s'il en a plusieurs, un **sélecteur minimal** (le seed a Julie
  dans deux — même besoin que `P1-009` côté mobile).
- S'il n'est pas connecté, l'accueil mène à **`/login`** (pas au système de design).
- Le lien « système de design » repasse sous `__DEV__` ou dans un écran de réglages
  (règle 9 : une affordance de debug dans l'accueil d'un membre **est** une sonde ;
  c'est déjà la leçon de `D-019`).

## Hors périmètre

- Le contenu riche du back-office (existe déjà sous `/box/[slug]`).
- Le sélecteur de box mobile complet (`P1-009`).

## Critères d'acceptation

- [ ] Connecté à une box → l'accueil redirige vers `/box/[slug]`.
- [ ] Connecté à plusieurs → un choix, sans passer par la déconnexion.
- [ ] Non connecté → l'accueil mène à `/login`, pas au système de design.
- [ ] L'accueil ne porte plus d'affordance de debug hors `__DEV__` (règle 9).
- [ ] **appareil / mise en service** : l'OWNER de la box, après connexion, voit sa box.

## Notes

À faire entrer dans ①. **Semi-bloquant** : l'accès existe par l'URL `/box/[slug]`,
mais un OWNER qui se connecte et tombe sur un placeholder croira que « ça ne marche
pas ». La Site URL pointe cette page — c'est la première impression du back-office.
