# P0-005a — Se connecter

**Phase** P0 · **Estimation** 6 j·h · **Dépend de** P0-004, P0-002, P0-003 · **Spec** §4-P1, §7.6a

## Objectif

Rendre le socle utilisable. Un membre reçoit un lien d'invitation, s'inscrit par
magic link, accepte les conditions, et atterrit sur un accueil aux couleurs de sa
box. C'est le premier ticket où le produit fait quelque chose pour quelqu'un.

## Périmètre

- Clients Supabase : mobile (`@supabase/supabase-js` + `expo-secure-store`) et
  web (`@supabase/ssr`, session en cookies pour le rendu serveur).
- Magic link, session, rafraîchissement silencieux du jeton.
- Fonction `public.me()` → profil, memberships, tenant courant avec thème et
  règles de réservation, `required_actions`.
- Profil public de la box **avant connexion** (`tenant_public_profile`, déjà livré).
- Acceptation d'invitation (`accept_invitation`, déjà livré).
- Écrans : Welcome brandé, Auth, Profile Setup, Consents, accueil.
- Consentements écrits dans `consents` avec version de politique et horodatage.

## Décision d'architecture

**Aucune route handler dans ce ticket.** Les trois opérations sont déjà des
fonctions Postgres livrées par P0-004, appelées en RPC depuis le client. Ajouter
une couche de transport sans logique coûterait trois jours-homme pour rien.

La couche API se construira quand une opération l'exigera réellement : P1-003
(`Idempotency-Key` persistée, réponse rejouée), puis P2 (webhooks Stripe, secrets).

Corollaire : la règle du **tenant actif** de `.claude/rules/api.md` vaut aussi
pour les appels directs. Elle vit dans un helper de `packages/core` que tout accès
aux données traverse, plutôt que dans la discipline de chaque appelant.

## Hors périmètre

Google (P0-005b), Apple (P2-003), export et suppression RGPD (P2-002),
**Box Switcher** (une box pilote est une box ; le multi-box part avec le réseau
inter-box), gestion des invitations côté OWNER (P1-001 avec les réglages).

## Critères d'acceptation

- [x] Un lien d'invitation ouvre un écran de bienvenue **aux couleurs de la box,
      avant toute connexion** — passe sur appareil du **4 septembre 2026** — iPhone 12 Pro Max, Expo Go, Expo SDK 57.

      **Ce critère a été coché une semaine trop tôt, et c'est instructif.** Il
      l'était sur la foi de `tenant_public_profile` répondant en clé `anon` :
      vrai, vérifié, et **au mauvais niveau**. Dans le produit, le lien ne
      portait pas de slug mais un jeton, l'écran ne savait résoudre qu'un slug,
      et l'URL du produit n'avait aucune route côté mobile. Trois maillons
      cassés sous une fonction SQL qui marchait.

      Vérifier une brique n'est pas vérifier le parcours. Un critère écrit du
      point de vue de la personne — « un lien ouvre un écran » — ne se coche pas
      depuis une console SQL.
- [x] **Mobile** : le code à six chiffres arrive dans Mailpit et connecte —
      vérifié de bout en bout par appels HTTP réels (gabarits `supabase/templates/`)
- [x] **Web** : le **lien** du même e-mail connecte aussi — vérifié de bout en
      bout dans le navigateur lors de P1-001a, qui a livré l'écran manquant.
      Deux chemins, deux vérifications : c'est exactement ce que cette ligne
      devait empêcher d'oublier, et elle a servi — le chemin web était cassé
      par un `additional_redirect_urls` en `https` que rien n'exerçait
- [x] Le jeton d'accès expire en 15 min et se rafraîchit sans déconnexion
      visible — `jwt_expiry = 900`, `expires_in: 900` relevé sur la réponse
- [x] `me()` retourne le tenant courant, son thème et ses règles en un
      aller-retour — vérifié, schéma Zod aligné
- [x] Refuser les notifications n'interrompt pas l'inscription — le refus s'écrit
      comme ligne `granted = false`, il ne bloque rien
- [x] Un lien d'invitation expiré donne un message clair, jamais une erreur brute
      — `INVITATION_EXPIRED` → `errors.invitation_expired`
- [x] Un `slug` inconnu ne divulgue rien — la fonction rend `[]`, l'écran ne
      distingue pas « inconnue » de « fermée »
- [x] Les quatre consentements sont des cases distinctes, sans dark pattern
- [x] Le parcours complet tient sous 3 minutes, montre en main
      — passe sur appareil du **3 septembre 2026** — iPhone 12 Pro Max, Expo Go,
      Expo SDK 57, base locale servie sur le réseau. **Toute la chaîne tient** :
      Expo Go → réseau local → Supabase → code à six chiffres → session →
      lecture filtrée par RLS.

      Deux choses que cette passe prouve et qu'aucun test ne pouvait prouver :

      1. **La session survit à la fermeture complète de l'app.** `chunkedStore`
         sur `expo-secure-store` écrit dans un vrai trousseau iOS — le
         découpage était testé en pur, la liaison ne l'était pas ;
      2. `signInWithOtp` fonctionne sous Hermes **sans** `react-native-url-polyfill`,
         qui avait été volontairement laissé de côté en attendant de savoir.

      Deux défauts trouvés au passage, tous deux sur la **langue**, et sortis
      dans leur propre ticket : **D-004**.

## Notes

Le deferred deep link (ouvrir une invitation sans l'app installée, retrouver le
contexte après installation) est reporté : **D-008**.

Écart assumé avec le titre du ticket : la connexion mobile se fait au **code à
six chiffres**, pas au lien. Le lien impose du deep linking dont la configuration
diffère entre Expo Go et un build de développement, et six chiffres se tapent
plus vite à l'accueil d'une box qu'un aller-retour entre l'app mail et l'app. Le
lien reste sur le web.

`.env.local` est créé **par la développeuse**, jamais par Claude : il est couvert
par `.gitignore` et par la règle `deny` de `settings.json`.
