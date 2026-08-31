# P0-005 — Authentification et session

**Phase** P0 · **Estimation** 5 j·h · **Dépend de** P0-004, P0-002 · **Spec** §4-P1, §7.6a

## Objectif

Se connecter, résoudre son tenant, récupérer son thème. Fin du socle.

## Périmètre

- Supabase Auth : Sign in with Apple (**obligatoire pour publier sur l'App Store**
  dès qu'un autre SSO existe), Google, magic link e-mail.
- `POST /v1/auth/social`, `POST /v1/auth/magic-link`, `POST /v1/auth/refresh`,
  `POST /v1/auth/logout`.
- `GET /v1/me` → profil, memberships, tenant courant avec son thème et ses règles
  de réservation, plus `required_actions`.
- `GET /v1/tenants/{slug}/public` → branding avant connexion, pour que l'écran
  d'accueil soit déjà aux couleurs de la box.
- Invitations : génération de lien nominatif (30 j, usage unique) et QR d'affiliation
  permanent de la box.
- Écrans mobile : Welcome brandé, Auth, Profile Setup, Consents, Box Switcher.
- Consentements écrits dans `consents` avec version de politique et horodatage.
- `DELETE /v1/me` (suppression logique + anonymisation à J+30) et `GET /v1/me/export`.

## Critères d'acceptation

- [ ] Connexion Apple, Google et magic link fonctionnelles sur iOS et Android
- [ ] Le même e-mail dans deux boxes ne crée qu'un seul compte
- [ ] **Un compte créé avec Google qui se reconnecte avec Apple ne casse pas.**
      P0-004 a posé un trigger `handle_new_user` qui refuse un e-mail déjà pris,
      ce qui est défendable mais transfère la charge à la configuration Auth :
      sans **linking d'identités** activé côté GoTrue, la seconde connexion
      échoue en **500 GoTrue**, et non en `EMAIL_ALREADY_LINKED_TO_OTHER_PROVIDER`
      comme le promet l'exemple JSON de la spec §7.6a. Activer le linking, ou
      mapper l'erreur — mais ne pas le découvrir sur un vrai membre.
- [ ] L'écran de bienvenue affiche le logo et la couleur de la box **avant** connexion
- [ ] Un lien d'invitation expiré est refusé avec un message clair
- [ ] Refuser les notifications n'interrompt pas l'inscription
- [ ] La suppression de compte est atteignable en 3 taps depuis les réglages
- [ ] L'export RGPD produit une archive lisible en moins de 30 secondes
- [ ] Le token d'accès expire en 15 min et se rafraîchit sans déconnexion visible
- [ ] Un `X-Tenant-Id` sans membership correspondante renvoie `404`, pas `403`

## Notes

Le deferred deep link (ouvrir une invitation sans l'app installée, puis retrouver
le contexte après installation) peut être reporté si le temps manque — le noter
comme dette dans le commit.
