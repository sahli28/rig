# `D-031` — La build de production démarre sans `.env.local`

**Phase** `dette` · **Estimation** `0,25` j·h · **Dépend de** — · **Spec** — · **Origine** premier test TestFlight (13 septembre 2026) : **crash au lancement** de la build de production iOS

## Objectif

Une build EAS (preview ou production) démarre et parle au projet Supabase
hébergé — au lieu de crasher à l'init faute de variables d'environnement.

## Le défaut, tel qu'il s'est produit

La build vendable a crashé **au lancement**, sur l'iPhone, à la première
installation TestFlight. Chaîne exacte, vérifiée dans le dépôt :

- `apps/mobile/lib/supabase.ts` crée le client **au chargement du module** via
  `readSupabaseConfig({ url: process.env.EXPO_PUBLIC_SUPABASE_URL, … })` ;
- `readSupabaseConfig()` (`packages/core/src/supabase/client.ts`) **lève** si
  l'URL ou la clé manquent — un choix délibéré et bon : pas de repli silencieux
  (la même règle que la façade `crypto`) ;
- ces variables ne vivaient que dans `apps/mobile/.env.local` — **gitignoré**,
  donc jamais uploadé vers EAS ; le profil `production` d'`eas.json` n'avait
  **aucun bloc `env`** → `undefined` → throw synchrone → crash.

En local (web, Expo Go, dev build via Metro) tout marchait : `.env.local` est
là. C'est la famille « aucun de nos filets ne tourne sur le vrai chemin » —
le bundle EAS est produit **dans le cloud**, où seul ce qui est versionné ou
déclaré existe.

## La décision : bloc `env` dans `eas.json`, versionné

Deux options existaient ; le **bloc `env` versionné** est retenu, contre les
variables d'environnement EAS (dashboard), pour trois raisons :

1. **Ces valeurs sont publiques par construction** — la clé anon part dans le
   bundle et n'ouvre que ce que la RLS autorise (README, « Ce n'est pas un
   secret ») ; il n'y a rien à cacher, donc rien à gagner à les sortir du dépôt ;
2. **un état hors dépôt de plus est la classe de défaut qu'on vient de payer
   trois fois** (dérives dashboard ↔ dépôt, `D-029`) : dans `eas.json`, la
   config est diffable, revue en PR, et ne peut pas dériver en silence ;
3. **le garde-fou devient trivial** : un test lit le fichier ; des variables
   dashboard auraient exigé un appel API authentifié à chaque CI.

**La frontière, à ne jamais franchir : uniquement du `EXPO_PUBLIC_*`.** Aucun
vrai secret (`service_role`, SMTP, Brevo, jeton d'accès) n'entre dans
`eas.json` — et le garde-fou le vérifie mécaniquement (toute clé d'un bloc
`env` doit commencer par `EXPO_PUBLIC_`).

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Le client mobile qui lève sans config | `apps/mobile/lib/supabase.ts`, `packages/core/src/supabase/client.ts` | ✅ existe — comportement voulu, conservé |
| Les valeurs publiques du projet hébergé | URL du projet + clé `sb_publishable_…` (CLI `projects api-keys`) | ✅ lues le 13 sept. |
| La suite Vitest d'`apps/mobile` (`*.test.ts`) | `apps/mobile/vitest.config.ts` | ✅ existe — le garde-fou y entre |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| Blocs `env` des profils `preview` et `production` | chaque `eas build` cloud | celui-ci |
| `apps/mobile/eas-env.test.ts` (garde-fou) | `pnpm test`, en CI | celui-ci |

## Périmètre

- `eas.json` : `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  dans `preview` **et** `production` (la sœur : le trou existait dans les deux).
- Le garde-fou en test : les deux profils portent les deux variables, l'URL a
  la forme du projet hébergé, la clé la forme publishable — et **aucune clé
  non-`EXPO_PUBLIC_`** dans aucun bloc `env`.
- La dépendance documentée dans le README racine (section variables d'env).
- `app.json` : `version` passe à `1.0.0` (première build réelle) ; le
  `buildNumber` écrit par `autoIncrement` est committé tel quel.

## Hors périmètre

- Le profil `development` : son JavaScript vient de Metro sur la machine de
  dev, où `.env.local` existe — pas le même chemin.
- Toute variable de plus (push, analytics) : elles entreront par le même bloc,
  gardées par le même test.

## Critères d'acceptation

- [x] `eas.json` expose les deux `EXPO_PUBLIC_*` en `preview` et `production`
- [x] Le garde-fou rougit si une variable manque, si sa forme est fausse, ou si
      une clé non-`EXPO_PUBLIC_` entre dans un bloc `env` — assertions jouées
- [ ] **appareil** : la build de production suivante (`eas build` +
      `eas submit`) **se lance** sur l'iPhone TestFlight et atteint l'écran de
      bienvenue — geste commanditaire, c'est la re-passe du test qui a trouvé
      le crash

## Notes

Le crash n'a été possible que parce que **rien n'exerce le bundle EAS avant
l'appareil** — même famille que « Expo Go ne compile rien en natif »
(`environnement-local.md`). Le garde-fou ne teste pas le bundle : il fige la
**condition nécessaire** (les variables déclarées). La condition suffisante —
l'app qui se lance — reste un critère d'appareil, et c'est écrit ci-dessus.
