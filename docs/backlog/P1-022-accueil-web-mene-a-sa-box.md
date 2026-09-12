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

- [x] Connecté à une box → l'accueil redirige vers `/box/[slug]` — **prouvé en
      local** : `GET / 307` → `GET /box/box-pilote-test 200`.
- [x] Connecté à plusieurs → un choix (liens nommés vers chaque box), sans passer
      par la déconnexion — rendu conditionnel, couvert par le typecheck.
- [x] Non connecté → l'accueil mène à `/login` — **prouvé en local** : vue publique
      (accroche + « Se connecter »), pas de placeholder.
- [x] L'accueil ne porte plus d'affordance de debug hors développement — le lien
      « système de design » est gardé par `process.env.NODE_ENV !== 'production'`
      (règle 9, l'équivalent web de `__DEV__`).
- [ ] **appareil / mise en service** : l'OWNER de la box, après connexion, voit sa box
      (sur l'hébergé, après recopie dashboard `P1-021` + redéploiement).

## Réalisation — 12 septembre 2026

`page.tsx` devient un **composant serveur** : `getUser` → si personne, vue publique ;
sinon `fetchMe`, on filtre les appartenances **ACTIVE**, et **une** box → `redirect`
avant tout rendu. Zéro, ou plusieurs → un composant client `HomeScreen` (le `t()`
vit côté client) rend le choix / la création / les invitations en attente
(`PendingBanner` réutilisé). Le placeholder « le back-office arrive en P1 » disparaît
(clé `home.placeholder_web` retirée) ; l'accroche, « Se connecter », « Créer une
box » et le choix réutilisent des clés `home.*` (dont celles déjà employées par
l'accueil mobile).

**Prouvé en local** : connecté à une box → l'accueil redirige dans `/box/[slug]` ;
déconnecté → la vue publique. Le lien système de design n'apparaît qu'en dev
(règle 9). L'entrée « Créer une box » (que `P1-020` attendait de ce lot) est en
place dans la branche « aucune box ».

## Notes

Dans ①. Ce lot **ferme le troisième des trois verrous** de mise en service
(`P1-021` → `P1-020` → `P1-022`) : l'OWNER se connecte, crée sa box, et l'accueil
l'y mène. **La preuve de bout en bout de `P1-018`** peut désormais se rejouer par le
vrai parcours, pas par du SQL.
