# `P1-024` — L'invitation en attente s'accepte sur mobile

**Phase** `P1` · **Estimation** `1` j·h · **Dépend de** `P1-001d` ✅ (`accept_pending_invitation`), `P1-018` ✅ (émetteur) · **Spec** §6.1, §8 · **Origine** test de bout en bout du 12 septembre 2026 (soir), sur l'hébergé

## Objectif

Un membre importé par sa box installe l'app, se connecte **avec son adresse**, et
**voit sa box** — au lieu de l'état vide « Aucune box pour l'instant ». C'est le
dernier chaînon du parcours des 80 invitations : sans lui, tout ce que `P1-018`
envoie mène à un cul-de-sac.

## La découverte qui ouvre ce ticket (règle 7, encore)

Tout le récit écrit dans `P1-018` et `P1-016` — « la personne demande son code
dans l'app et `accept_pending_invitation()` l'apparie » — suppose un appelant
qui **n'existe pas sur mobile**. Vérifié dans le dépôt le 13 septembre 2026 :

- le seul appelant d'`acceptPendingInvitation()` est
  `apps/web/app/invitations/actions.ts:28` — le **web**, où un membre n'a rien
  à faire ;
- sur mobile, `auth.tsx` n'accepte que le flux à **jeton** (QR, lien D-005) ;
- `P1-009` a mis ce parcours **hors de son périmètre** en le renvoyant à
  P0-005a/P1-001d, qui ne l'ont livré que côté SQL et web ;
- un connecté sans appartenance atterrit sur l'`EmptyState` de
  `apps/mobile/app/(app)/index.tsx` — aucune sortie.

Le tableau de prérequis de `P1-018` disait « ✅ existent et testés » : vrai des
fonctions SQL, faux de l'appelant mobile. C'est le motif `create_tenant()` —
une fonction sans appelant n'est pas faite, et aucun test ne voit ce qui manque.

## La décision de périmètre qu'il applique

**Pilote iOS-seul, tranché le 12 septembre 2026** (`P1-018`, `P1-016`,
`email-et-domaine.md`) : le membre s'inscrit **par le mobile**, jamais par le
web. `/login` web reste la porte de **reconnexion** de l'espace box ; la porte
d'inscription cachée `?inscription=1` reste cachée — aucun lot web n'est ouvert.
L'alternative « vraie porte d'inscription web » a été chiffrée (~0,5 j·h) et
**écartée** : elle livrerait un membre dans un back-office où il n'a aucun
droit.

## Ce que ce ticket suppose et qui doit exister

*Chaque état vérifié dans le dépôt, le 13 septembre 2026.*

| Prérequis | Où il vit | État |
| --- | --- | --- |
| La première connexion mobile **crée** le compte | `apps/mobile/app/(auth)/auth.tsx:60`, `shouldCreateUser: true` | ✅ existe |
| `pending_invitations_for_me()` — sans paramètre, adresse du JWT | `20260902110000_invitation_claim_and_dedup.sql:320`, testée (`member_import_test.sql`) | ✅ existe |
| `accept_pending_invitation()` — même claim que le jeton | `20260902110000:278`, testée | ✅ existe |
| Les wrappers TypeScript + schéma Zod | `packages/core/src/supabase/tenant.ts:160,174` | ✅ existent |
| `reload()` de session après acceptation | `apps/mobile/lib/session.tsx:150` | ✅ existe — écrit pour ça |
| Relecture au retour d'écran (l'accueil ne remonte jamais, D-016) | `apps/mobile/lib/use-relire-au-retour.ts` | ✅ existe |
| Composants natifs (`Banner`, `Button`, `Skeleton`, `EmptyState`) | `@rack/ui/native` | ✅ existent |
| Clés i18n (`pending.title`, `pending.intro`, `pending.join`, `invitation.role_*`) | `packages/core/src/i18n/locales/` | ✅ existent — posées par le web, réutilisées telles quelles |
| Le lien TestFlight vers lequel `RACK_INVITE_URL` pointera | *hors dépôt* | ❌ **`P1-016`** (build TestFlight) — bloque l'envoi des 80, pas ce code |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| L'appelant mobile d'`acceptPendingInvitation()` | le membre importé, à sa première connexion | celui-ci |
| La liste des invitations en attente sur l'accueil sans box | idem | celui-ci |

## Périmètre

- Un composant `InvitationsEnAttente` (`apps/mobile/components/`), affiché par
  l'accueil **à la place** de l'état vide quand `memberships.length === 0` et
  qu'au moins une invitation attend : nom de la box, rôle, bouton « Rejoindre ».
- Lecture au montage **et au retour d'écran** (`useRelireAuRetour`) : l'accueil
  est la racine de la pile et ne remonte jamais (D-016) — une invitation envoyée
  pendant que l'écran vide est affiché doit apparaître au retour dans l'app.
- Accepter → `reload()` : l'appartenance, le thème et le fuseau de la box
  arrivent sans redémarrage.
- Les erreurs (`INVITATION_EXPIRED`, réseau) sortent par `errorMessageKeyOf()`,
  en clé i18n.
- Sans invitation en attente, l'état vide actuel reste tel quel.

## Hors périmètre

- Le flux à **jeton** (QR, lien) — déjà livré, inchangé.
- Le sélecteur multi-box — **`P1-009`**.
- Toute porte web pour le membre — **écartée** par la décision de périmètre.
- Le build TestFlight et `RACK_INVITE_URL` — **`P1-016`**.

## Critères d'acceptation

- [x] Un compte neuf dont l'adresse porte une invitation `PENDING` voit sur
      l'accueil la box qui l'a inscrit, son rôle traduit, et « Rejoindre » —
      **harnais, 13 sept. 2026** : `nouveau@example.com` (compte créé par le
      code à 6 chiffres) voit « Ta box t'attend — CrossFit Rueil — membre », et
      le bouton s'annonce « Rejoindre CrossFit Rueil » dans l'arbre
      d'accessibilité
- [x] Rejoindre crée l'appartenance et l'accueil affiche la box — thème et nom
      compris — sans redémarrer l'app — **harnais, 13 sept.** : l'accueil passe
      à « CF Rueil », orange de la box (pas le graphite plateforme), planning
      visible
- [x] Sans invitation en attente, l'état vide « Aucune box pour l'instant »
      demeure, inchangé — **harnais, 13 sept.** : `personne@example.com`, aucune
      invitation
- [x] Une invitation créée **pendant** que l'écran vide est affiché apparaît au
      retour dans l'app, sans redémarrage (D-016) — **harnais, 13 sept.** :
      insérée en base pendant l'affichage, visible après un aller-retour d'écran
- [x] Une acceptation qui échoue affiche sa clé i18n et laisse l'écran
      utilisable — **harnais, 13 sept.** : invitation expirée entre l'affichage
      et le tap → « Cette invitation a expiré… » en bannière, liste relue
      (l'expirée disparaît), écran vivant. **Un défaut trouvé et corrigé par ce
      geste** : la relecture silencieuse effaçait la bannière — une lecture
      silencieuse ne touche plus l'erreur affichée
- [x] `pnpm i18n:check` vert — aucune clé nouvelle, le web les avait posées
- [~] **appareil** : installer par TestFlight, code à 6 chiffres, box visible —
      la preuve du **vrai** parcours attend le build TestFlight (`P1-016`).
      En attendant, le parcours est prouvé **au harnais** sur le bundle web
      (`pnpm --filter @rack/mobile web`), moteur navigateur, pas Hermes — le
      harnais dit le comportement, pas l'appareil

## Notes

- **Aucune nouvelle fonction SQL, aucune migration** : les deux fonctions sont
  testées en pgTAP depuis P1-001d (`member_import_test.sql`), et aucune règle
  métier 1–6 n'entre en jeu — pas de test-avant-code exigé ; la preuve est
  comportementale, au harnais.
- Ne pas gonfler : pas de compte d'invitations en badge, pas de refus
  d'invitation (une invitation ignorée expire), pas d'écran dédié — c'est une
  branche de l'accueil.
- **Deux défauts préexistants du harnais web, vus pendant la preuve** (notés
  règle 11, à transformer en ticket au prochain lot doc — hors périmètre ici) :
  ① `lib/push.ts:114` appelle `ExpoNotifications.getLastNotificationResponseAsync`
  au montage, indisponible sur web → overlay d'erreur à chaque chargement du
  harnais (l'app marche derrière) ; ② « Se déconnecter » est **inopérant au
  harnais web** — un rejet non rattrapé dans la chaîne (`ExpoSecureStore.
  getValueWithKeyAsync is not a function`) arrête `signOut()` avant
  `auth.signOut()`. Tous deux datent du lot mobile de `P1-007` ; aucun ne touche
  l'appareil, où les modules natifs existent.
