# `P1-007` — Notifications push (re-fusionné, passe iPhone en attente)

**Phase** `P1` · **Estimation** `6` j·h *(4 → 6 ; la frontière a/b reposait sur un appareil Android qui n'existe pas)* · **Dépend de** `P0-005` ✅ · **Spec** §5.3, §12.3 · **État** : lots 1–3 livrés sur `feat/P1-007-push`, **passe iPhone en attente**

## Objectif

Une place se libère à 19 h : la personne suivante l'apprend sur son téléphone,
pas en rouvrant l'app le lendemain. Le même canal porte le **rappel J-1** et
l'**annulation de cours** — par une chaîne d'envoi plateforme-agnostique (Expo
Push route vers APNs ou FCM sans que le code le sache).

## La découpe `a`/`b` est révolue — pourquoi

Le 10 septembre, `P1-007` avait été découpé en `P1-007a` (l'émetteur et tout ce
qui ne dépend pas d'Apple) + `P1-007b` (le transport iOS). La frontière reposait
sur : « Android permet de coder **et de prouver** l'émetteur sans compte Apple. »
Deux faits l'ont invalidée :

1. le **compte Apple est actif depuis le 8 septembre** — « sans Apple » n'était
   donc plus le sujet ;
2. **il n'existe aucun appareil Android de test.** Le critère « push Android
   < 30 s » n'a rien pour l'exercer, et **un critère qu'on ne peut pas jouer
   n'est pas un critère** (règle 10 de `CLAUDE.md`). La preuve `a` reposait sur
   un appareil fantôme.

La preuve se fait donc sur **un seul *development build* iOS**, qui ferme quatre
critères de quatre tickets : l'émetteur (ce ticket), le push iOS, le reliquat
`rack://` de `D-013`, et le `[~]` resté ouvert de `P1-003b`. **On re-fusionne
`a` + `b` en un seul `P1-007`.**

Le canal Android n'est pas annulé, il est **re-daté** : il devient un prérequis
de `P1-016` (projet Firebase + un appareil de test, qui existera à la box). Le
code livré ici est déjà plateforme-agnostique ; **seule la preuve Android est
reportée**, pas le code.

## Réestimation — un seul nombre : **4 → 6 j·h**

`P1-007` valait 4 j·h « à recompter », de l'aveu même du ticket (l'émetteur, le
journal d'envoi et EAS n'y étaient pas). Recompté sur le périmètre **entier**,
`a` et `b` réunis :

| Poste | j·h |
| --- | --- |
| Couche décision (timezone, catégories, journal, préférences, éligibilité) + pgTAP + core/UI | ~2,75 |
| Émetteur (outbox, RPC, edge function Deno, pont `pg_net`) + `deno test` | ~1,75 |
| Mobile (jeton, fuseau, lien profond, EAS) | ~1 |
| Build iOS + APNs + passe appareil | ~0,5 |
| **Total** | **6** |

Le re-cadrage Android → iOS est **un wash** : Firebase + l'APK sortent, APNs +
provisioning + l'iPhone entrent ; le code décision/émetteur ne bouge pas.
**Total ① : 113,75** (111,75 − 4 + 6), restants 17,5 → 19,5.

## Ce que ce ticket suppose et qui doit exister

*États vérifiés dans le dépôt le 11 septembre 2026.*

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Table `devices` (jeton, plateforme, `last_seen_at`) | `20260830143108_compliance_and_ledger.sql` | ✅ globale (un membre dans deux boxes = un appareil), `platform in ('ios','android','web')`, index unique `push_token` |
| Policy et droits sur `devices` | `20260830143108`, `20260901140000` | ✅ `devices_self_write` + `grant …` |
| Consentement `PUSH` | `consents`, écran de consentement | ✅ recueilli ; **honoré par ce ticket** |
| Langue du membre | `users.locale` | ✅ le rendu i18n a sa source |
| `pg_cron` | activé (`20260902120000`) | ✅ le rappel J-1 et le balayage ont leur précédent |
| **Compte Expo/EAS + `eas init`** | — | ❌ **à toi** — écrit `extra.eas.projectId` dans `app.json`, requis par `getExpoPushTokenAsync()` même en build local (voir « chemin critique hors code » du README) |
| **Le premier *development build* iOS** | — | ❌ **l'événement** — `eas device:create`, `eas build -p ios --profile development` ; la clé APNs est auto-gérée par EAS. C'est lui qui prouve les critères appareil |
| Projet Firebase + `google-services.json` + appareil Android | — | ❌ **prérequis de `P1-016`**, pas ici |

## Les lots (livrés sur `feat/P1-007-push`)

1. **Couche décision — SQL, prouvée seule.** `users.timezone` (repli box),
   `notification_category` + classifieurs immuables, `notification_sends`
   (journal append-only, tenant-scopé), `notification_preferences` (opt-out par
   catégorie), `notification_eligibility` (consentement/catégorie/quiet-hours/
   plafond). Core (`MyPreferences`, `setNotificationPreference`) + UI réglages +
   i18n. pgTAP. — commit `0af8d2a`.
2. **L'émetteur.** `push_outbox` (outbox durable), RPC d'état
   (`claim`/`mark_sent`/`mark_failed`/`register_device`/`revoke_device`),
   `enqueue_push` (l'appelant d'`eligibility`, règle 7), transport `pg_net` +
   balayage, producteurs (`enqueue_class_reminders` J-1, `cancel_class_bookings`
   branché). Edge function Deno (`rack-push-emitter`) rendant l'i18n depuis le
   bundle partagé. pgTAP + `deno test`. — commit `b103ce6`.
3. **Le mobile.** `devices.ts`, `updateTimezone`, hook `useDeviceSync`
   (fuseau inconditionnel, jeton conditionné au consentement + permission,
   lien profond), révocation au `signOut`, `eas.json`, `app.json`. — commit
   `4e8e194`.
4. **Documents** — ce lot (re-fusion, README, chemin critique, `P1-016`, passe).

## Périmètre / hors périmètre

**Dans** : émetteur plateforme-agnostique, jeton (enregistrement + révocation),
`users.timezone` + quiet hours (sauf annulation imminente), journal + plafond
marketing (semaine glissante, marketing lui-même en P2), catégories (rappel J-1,
promotion de liste d'attente, annulation), réglages par catégorie, i18n FR/EN,
lien profond `rack://`, build iOS + passe.

**Hors** : le **marketing** lui-même (P2), le canal e-mail (`D-008`, bloqué par
le domaine), la **preuve Android** (→ `P1-016`), la **promotion de liste
d'attente** elle-même (`P1-006` — `cancel_booking` ne l'enfile pas, c'est
délibéré : son aval est `promote_waitlist`).

## Critères d'acceptation

- [x] *(harnais)* éligibilité (consentement / catégorie / quiet-hours / plafond),
      journal append-only tenant-scopé, `register_device` (téléphone partagé),
      `revoke_device`, `users.timezone` non écrivable hors grant — **pgTAP** ;
      rendu i18n + mapping de la réponse Expo — **`deno test`**
- [ ] **iOS < 30 s** — **passe iPhone, après ton dev build**
- [ ] **toucher la notif ouvre l'écran via `rack://`** (ferme `D-013` + `P1-003b`)
      — **passe iPhone**
- Android < 30 s → **prérequis de `P1-016`**, pas coché ici

## Ce dont j'ai besoin de toi (une seule fois)

1. **Compte Expo/EAS** + `eas init` dans `apps/mobile` (écrit `extra.eas.projectId`
   dans `app.json`, ou donne-moi le projectId).
2. **Le *development build* iOS** : `eas device:create` (enregistre ton iPhone),
   `eas build -p ios --profile development`, installer. C'est ce build qui prouve
   les critères appareil.

Rien de secret pour l'émetteur : l'API Expo Push est sans clé, la `service_role`
est injectée dans l'edge runtime.

## Notes

La première vraie brique serveur du produit est ici — pas la couche API qu'ADR
0004 annonçait pour `P1-003` (résolue en base, jamais construite en
`apps/web/app/api/`). ADR 0004 est amendé. `P1-006` (liste d'attente) attend
l'émetteur : satisfaite dès la fusion de ce ticket, sa garantie « la promotion
part en < 30 s » se prouvera avec la passe iPhone.
