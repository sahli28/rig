# `D-038` — L'en-tête du planning déborde en français

**Phase** `dette` · **Estimation** `0,5` j·h · **Dépend de** `P1-002` · **Spec** §12.4 · **Origine** test appareil Android de `P2-024`, 18 septembre 2026

## Objectif

L'en-tête du planning (jour précédent · date · jour suivant) reste lisible en
français comme en anglais — la date ne se casse plus **syllabe par syllabe**.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| La rangée d'en-tête | `apps/mobile/app/(app)/planning.tsx:424-447` | ⚠️ **la cause** : deux `Button` texte (« Jour précédent » / « Jour suivant ») encadrent un `Text` date `flex:1`. Les libellés **FR** sont plus longs qu'en EN → ils mangent la largeur, la date au centre est écrasée et se casse caractère par caractère. Correct en EN (libellés plus courts) |
| L'intention déjà écrite | commentaire `:422` — « ‹ » et « › » comme flèches (§12.4) | ✅ prévue, **non appliquée** |
| `IconButton` | kit de composants (galerie) | ✅ existe |

## Périmètre

- Remplacer les deux boutons texte par des **flèches ‹ / ›** (`IconButton`) avec
  `accessibilityLabel` = « Jour précédent » / « Jour suivant » (§12.4) → la
  largeur est libérée pour la date, dans les deux langues.
- Vérifier le rendu **FR et EN**.

## Hors périmètre

- La grille du mois (fonctionne).
- La passe design globale `P2-021`.

## Critères d'acceptation

- [ ] En FR, « vendredi 18 septembre 2026 » tient dans l'en-tête sans casse
      syllabique ; en EN, inchangé
- [ ] Les flèches gardent leur libellé accessible (le lecteur d'écran annonce
      « Jour précédent » / « Jour suivant »)
- [~] Rendu appareil (FR + EN)

## Notes

Révélé en test le 18 sept. 2026. Le correctif est exactement celui que le
commentaire du code suggérait déjà.

## Journal

**18 sept. 2026 — corrigé sur `fix/D-038-entete-planning-deborde-fr` (un commit).**
Les deux `Button` texte de la rangée d'en-tête sont remplacés par des `IconButton`
portant les flèches `‹` / `›` (`apps/mobile/app/(app)/planning.tsx`). Chaque
`IconButton` garde le libellé accessible via la **même clé i18n** qu'avant —
`t('planning.previous_day')` / `t('planning.next_day')` (existantes FR+EN) — donc
le lecteur d'écran annonce toujours « Jour précédent » / « Jour suivant » (§12.4).
La date centrale `flex:1` récupère la largeur que les libellés mangeaient : plus
de casse syllabique en français. Aucune couleur ni chaîne en dur (glyphes via
`theme`, sens porté par le libellé accessible).

`/check` vert : typecheck, format, lint, 18 sondes, `test`. `test:db` non exercé
(aucun diff `supabase/`).

**Vérification visuelle FR/EN — bloquée dans le harnais web, pas par ce correctif.**
Le bundle web est propre (l'écran de bienvenue s'affiche), mais **tout écran
authentifié plante sur le web** : `useDeviceSync` (monté à la racine,
`app/_layout.tsx:84`) exécute `Notifications.getLastNotificationResponseAsync()`
(effet 3 de `push.ts`, ajouté par `P1-007`) qui **n'existe pas sur le web** et
n'est pas gardé par `Platform.OS`. Pré-existant, hors périmètre de `D-038`. La
lecture de l'arbre d'accessibilité sur le web (étape de livraison, `ui.md`) est
donc indisponible pour les écrans authentifiés → **candidat dette `D-039`** (garder
les appels `Notifications` derrière `Platform.OS !== 'web'`). Le rendu FR/EN de
l'en-tête se vérifie ici à l'appareil (`[~]`).

Critères 1 et 2 : satisfaits par construction (libellés préservés, largeur
libérée), confirmés à la re-passe. Ils restent `[ ]`/`[~]` jusque-là.
