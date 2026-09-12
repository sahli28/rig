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

- [x] Un compte neuf, **jamais confirmé**, se connecte par le web **sans SQL** —
      **prouvé en local le 12 sept. 2026** (voir Réalisation) : `/login?inscription=1`,
      e-mail neuf → e-mail de confirmation avec **lien** → clic → session établie.
- [ ] Le correctif est posé **dans le dépôt et dans le dashboard** (les deux, sinon
      l'hébergé diverge) — **dépôt fait ; dashboard = action pour la commanditaire**,
      contenu exact ci-dessous. **Reste ouvert tant que le dashboard n'est pas mis à jour.**
- [ ] **appareil / mise en service** : la première connexion réelle du staff de la
      box aboutit (après recopie dashboard + redéploiement).

## Réalisation — 12 septembre 2026

**Voie (1) retenue et jouée** : le gabarit « Confirm sign up » (`confirmation.html`)
gagne le **bloc lien** (`{{ .ConfirmationURL }}`) qu'avait déjà `magic-link.html` — le
web suit le lien, aucun champ code à ajouter côté web. Deux petits défauts d'e-mail
**absorbés ici** (ils vivaient dans les mêmes fichiers) :

- **« Lien envoyé » ↔ e-mail à code.** L'écran disait « Lien envoyé » alors que
  l'e-mail met le **code** en gros et le lien en petit. Copie corrigée
  (`login.sent_title`/`sent_body`, FR+EN) : « E-mail envoyé — ouvre le message et
  **clique le lien**… (il montre aussi un code, pour l'app mobile) ». *(C'était le
  D-0xx « Lien envoyé / code affiché » décalé du lot doc — traité ici, pas rouvert.)*
- **Même objet → Gmail empile.** Les deux gabarits partageaient l'objet, donc un
  membre qui redemande un code voyait des messages identiques et pouvait recopier un
  code périmé. L'objet porte désormais **le code** : `Ton code Rack {{ .Token }} /
  Your Rack code` — **unique à chaque envoi** (vérifié : Supabase rend `{{ .Token }}`
  dans l'objet, testé en local via Mailpit), le plus récent en tête, code visible.

**Prouvé en local (Mailpit + harnais web)** : objet rendu `Ton code Rack 278384 /
Your Rack code` ; l'e-mail de confirmation porte un lien `/auth/v1/verify?token=…`
rendu (aucun `{{ … }}` résiduel) ; le clic aboutit à une **session cookie
`sb-…-auth-token` avec `access_token`** pour l'adresse neuve. Le parcours **aboutit**.

### Action pour la commanditaire — recopier dans le dashboard hébergé (sinon oublié)

Les gabarits **et les objets** ne sont pas versionnés côté hébergé
(`email-et-domaine.md`). Dans **Supabase → Authentication → Emails** :

1. **Confirm sign up → Subject** : `Ton code Rack {{ .Token }} / Your Rack code`
2. **Magic Link (or OTP) → Subject** : `Ton code Rack {{ .Token }} / Your Rack code`
3. **Confirm sign up → Message body** : coller **exactement** le contenu de
   `supabase/templates/confirmation.html` de ce lot — soit :

```html
<h2>Rack</h2>

<p>Bienvenue. Ton code de connexion / Welcome. Your sign-in code:</p>

<p style="font-size: 28px; letter-spacing: 6px; font-weight: 700">{{ .Token }}</p>

<p>
  Il expire dans une heure. Si tu n'as rien demandé, ignore cet e-mail.<br />
  It expires in one hour. If you didn't ask for it, ignore this email.
</p>

<p style="color: #5b6472; font-size: 12px">
  Tu peux aussi te connecter depuis un navigateur :
  <a href="{{ .ConfirmationURL }}">ouvrir le lien</a>.<br />
  You can also sign in from a browser: <a href="{{ .ConfirmationURL }}">open the link</a>.
</p>
```

*(Le body de « Magic Link » est déjà bon côté hébergé — seul son **objet** change.)*

## Notes

À faire entrer dans ①. **Bloquant** : sans lui, l'OWNER de la box ne peut pas entrer
dans le back-office à sa première connexion — et donc pas créer sa box (`P1-020`).
