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

- [ ] Un lien d'invitation ouvre un écran de bienvenue **aux couleurs de la box,
      avant toute connexion**
- [ ] Le magic link arrive dans Mailpit et connecte
- [ ] Le jeton d'accès expire en 15 min et se rafraîchit sans déconnexion visible
- [ ] `me()` retourne le tenant courant, son thème et ses règles en un aller-retour
- [ ] Refuser les notifications n'interrompt pas l'inscription
- [ ] Un lien d'invitation expiré donne un message clair, jamais une erreur brute
- [ ] Un `slug` inconnu ne divulgue rien
- [ ] Les quatre consentements sont des cases distinctes, sans dark pattern
- [ ] Le parcours complet tient sous 3 minutes, montre en main

## Notes

Le deferred deep link (ouvrir une invitation sans l'app installée, retrouver le
contexte après installation) peut être reporté — le noter comme dette au commit.

`.env.local` est créé **par la développeuse**, jamais par Claude : il est couvert
par `.gitignore` et par la règle `deny` de `settings.json`.
