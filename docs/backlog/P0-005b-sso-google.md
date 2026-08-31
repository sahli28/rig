# P0-005b — SSO Google et linking d'identités

**Phase** P0 · **Estimation** 4 j·h · **Dépend de** P0-005a

## Objectif

Faire passer l'inscription sous la minute, et surtout **régler maintenant** le cas
que la migration de durcissement de P0-004 a rendu strict : une adresse déjà prise.

## Pourquoi maintenant et pas plus tard

`handle_new_user` refuse un e-mail déjà utilisé. Sans SSO câblé, ce comportement
n'est jamais exercé : on le découvrirait au mois 6, sur une vraie adhérente, avec
une erreur GoTrue opaque. Avec deux fournisseurs, on le découvre ici, base fraîche
et contexte en tête.

## Périmètre

- Google sur les **trois** plateformes : trois `client_id` distincts (web pour le
  callback Supabase, iOS, Android). Un seul ne suffit pas.
- URI de redirection autorisée **exactement** `http://127.0.0.1:55321/auth/v1/callback`
  en local. Google exige la correspondance au caractère près, et `localhost` n'est
  pas `127.0.0.1` pour lui. C'est l'après-midi perdue classique.
- Dans `supabase/config.toml`, référencer `env(GOOGLE_CLIENT_ID)` — **jamais** la
  valeur littérale : le fichier est versionné.
- Linking d'identités côté GoTrue, ou mapping explicite de l'erreur.

## Critères d'acceptation

- [ ] Connexion Google fonctionnelle sur iOS et Android
- [ ] **Un compte créé par magic link puis reconnecté via Google avec la même
      adresse vérifiée aboutit à une seule identité — ou échoue avec
      `EMAIL_ALREADY_LINKED_TO_OTHER_PROVIDER`, jamais avec une 500 GoTrue.**
- [ ] Le sens inverse (Google puis magic link) se comporte identiquement
- [ ] Aucune valeur littérale d'identifiant dans un fichier versionné

## Conséquence à assumer

Câbler un SSO engage sur **Sign in with Apple avant la soumission App Store**
(guideline 4.8 : une option de connexion équivalente respectueuse de la vie privée
est exigée dès qu'une connexion tierce est proposée). Avec magic link seul, la
règle ne se déclenche pas. Le choix est fait — voir P2-003 — mais il est à
revérifier dans la version en vigueur des guidelines au moment de soumettre.
