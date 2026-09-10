# `P1-007a` — Notifications push : l'émetteur, et tout ce qui ne dépend pas d'Apple

**Phase** `P1` · **Estimation** `3` j·h *(à recompter à l'ouverture — l'émetteur, le journal et EAS n'étaient pas dans les 4 j·h d'origine ; première lecture ~+1,25)* · **Dépend de** `P0-005` ✅ · **Spec** §5.3, §12.3 · **Découpé de `P1-007` le 10 septembre 2026**

## Objectif

Une place se libère à 19 h : la personne suivante l'apprend sur son téléphone,
pas en rouvrant l'app le lendemain — **sur Android d'abord, et par une chaîne
d'envoi qui vaut pour les deux plateformes.**

## Pourquoi cette découpe, et où passe la frontière

`P1-007` supposait « quatre j·h et un compte Apple ». Sa section règle 8 (ci-dessous)
a montré que **le compte Apple n'était pas le sujet** : le gros du ticket est un
**émetteur** qui n'existe nulle part, un **journal d'envoi** sans lequel le
plafond marketing n'est pas un plafond, et un **fuseau du membre** que le schéma
ne porte pas. **Aucun de ces trois n'attend Apple** — ils se codent et se testent
sur Android (Expo Push proxifie FCM, gratuit).

Ce qui attend Apple, c'est **le transport iOS** : une clé APNs, un
*development build* iOS, et le deep link `rack://` qu'Expo Go ne sait pas
exercer. C'est `P1-007b`, et c'est tout ce qu'il est — **aucune logique neuve,
seulement un canal et une vérification sur appareil.**

> La frontière, en une phrase : **l'émetteur route déjà vers APNs ou FCM sans le
> savoir** (c'est l'API Expo Push qui tranche). Donc l'émetteur, le token, le
> journal, le fuseau, les quiet hours, les réglages par catégorie et l'i18n
> vivent **ici** ; `P1-007b` n'ajoute que la clé APNs et le `rack://`.

## Ce que ce ticket suppose et qui doit exister

*Chaque état est vérifié dans le dépôt, le 10 septembre 2026.*

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Table `devices` (jeton, plateforme, `last_seen_at`) | `20260830143108_compliance_and_ledger.sql:66` | ✅ existe — **globale, sans `tenant_id`** (un membre dans deux boxes garde un seul appareil), `push_token` + `platform in ('ios','android','web')`, index unique sur `push_token`. **La plateforme `ios` est déjà admise** : `P1-007b` n'y touchera pas |
| Policy et droits sur `devices` | `20260830143108:242`, `20260901140000:85` | ✅ `devices_self_write` (`for all`, propriétaire) + `grant select,insert,update,delete`. Le mobile écrit son jeton par `upsert on conflict (push_token)`, borné par RLS |
| Consentement `PUSH` | `20260830143108:7`, écran de consentement, clé `consents.push` | ✅ **déjà cochable**, recueilli sans que rien ne l'honore. Ce ticket l'honore |
| Langue du membre | `users.locale` (`20260830143106:59`), `fr`/`en` | ✅ le critère « dans la langue du membre » a sa source |
| Un ordonnanceur de fond | `pg_cron`, activé (`20260902120000:389`), deux jobs déjà en service | ✅ le rappel J-1 a son précédent |
| **Un émetteur** — ce qui appelle l'API Expo Push | *rien* : pas de `supabase/functions/`, pas de `[functions]` dans `config.toml`, ni `pg_net` ni `http` (une fonction SQL **ne peut pas** émettre) | ❌ **à créer ici — une edge function Supabase.** C'est le plus gros morceau. ADR 0004 amendé en conséquence |
| **`expo-notifications`** | *absent de `apps/mobile/package.json`* | ❌ à ajouter, justifié au commit ; **absent de tout le code** aujourd'hui |
| **`eas.json`** | *inexistant* | ❌ à créer — pour le dev build Android APK (côté iOS, `P1-007b`) |
| **Fuseau horaire du membre** | `tenants.timezone` existe ; **`users` n'a pas de fuseau** | ❌ **à créer ici — tranché : colonne `users.timezone`** (voir ci-dessous) |
| **Journal d'envoi** (plafond marketing) | *aucune table* | ❌ **à créer ici** — un plafond sans compteur n'est pas un plafond |
| Schéma d'URL `rack://` | `apps/mobile/app.json:5` | ⚠️ déclaré, jamais exercé — **son épreuve est `P1-007b`** (dev build), pas ici |

### Trois décisions prises à la découpe, pour qu'elles ne se reprennent pas en route

1. **Le fuseau du membre est une colonne `users.timezone`**, pas un repli sur la
   box. « Heure locale du membre » est littéral (spec §5.3) : Julie s'entraîne à
   Rueil et voyage. L'app l'écrit depuis le fuseau de l'appareil
   (`expo-localization`, identique Android/iOS), avec **repli sur
   `tenants.timezone` si `null`**. **Piège à ne pas rater** : l'ajouter aux
   **deux** listes de grant de colonne (`20260831103203:25` et
   `20260901140000:71`) — sinon `42501` — et l'exposer dans `me()`
   (`20260831133636:144`). Sœur exacte de ce que `default_visitor_capacity`
   n'a **pas** fait (il n'est pas dans `me()`) : ici il faut qu'il y soit, le
   client lit le fuseau au démarrage.

2. **Le journal d'envoi est append-only et tenant-scopé.** Une notification part
   d'une box : la table porte `tenant_id not null`, RLS standard (pas de nouvelle
   exemption anti-fuite), le trigger `forbid_mutation()` déjà outillé
   (`20260830143108:148`, comme `audit_logs`/`ledger_entries`), une **catégorie**
   (`transactional` | `marketing`) et un `sent_at` pour la fenêtre glissante de
   7 jours. **Écriture réservée à l'émetteur** (pas de policy d'écriture client),
   lecture éventuelle du membre.

3. **Ce qui compte dans le plafond, et ce qui passe toujours.** Le plafond de
   2/semaine vise le **marketing** (campagnes, opt-in e-privacy — spec §15.3).
   Les catégories de ce ticket — **promotion de liste d'attente, annulation de
   cours, rappel J-1 — sont transactionnelles** : elles partent toujours, quiet
   hours comprises pour l'annulation imminente, et **ne comptent pas** dans le
   plafond. Le marketing lui-même est P2 ; le journal et le compteur existent
   dès maintenant pour que le premier envoi marketing trouve un plafond qui
   marche, pas à construire dans l'urgence.

> ### La question ouverte, laissée au plan mode de l'ouverture : **comment le SQL
> atteint l'émetteur**
>
> `pg_cron` et les fonctions SQL **ne peuvent pas** appeler l'API Expo Push :
> ni `pg_net` ni `http` ne sont activés (vérifié). Or la promotion de liste
> d'attente (`P1-006`) naît **dans la transaction d'annulation**, en SQL, et doit
> partir en moins de 30 s. Il faut donc un pont SQL → edge function. Trois
> formes, à trancher à l'ouverture avec l'écran de l'implémentation sous les
> yeux — **ne pas la trancher ici, elle dépend de détails de déploiement** :
> une **table outbox** que l'edge function draine (déclenchée par un *database
> webhook* Supabase à l'insertion), `pg_net` activé pour un `POST` direct, ou un
> `pg_cron` court qui appelle l'edge function. La recommandation de départ est
> l'**outbox + webhook** : elle survit à un émetteur momentanément indisponible
> (la ligne reste), ce qu'un `POST` direct depuis la transaction ne fait pas.

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --- | --- | --- |
| L'émetteur (edge function → Expo Push) | la promotion de liste d'attente | `P1-006` — **sa dépendance ; satisfaite pour Android dès ce ticket**, la garantie iOS des « 30 s » attend `P1-007b` |
| Notification d'annulation de cours | l'écran d'annulation du back-office | `P1-004` ✅, **et il attend déjà** : `planning.cancel_no_notification` dit « le canal n'existe pas encore ». Cette microcopie disparaît ici |
| Rappel de cours J-1 | un job `pg_cron` | celui-ci |
| Enregistrement / révocation de jeton | l'app au démarrage | celui-ci |
| La colonne `users.timezone` | les quiet hours, puis tout affichage « heure locale du membre » | celui-ci |

## Périmètre

- `expo-notifications`, enregistrement du jeton au démarrage, `upsert` dans
  `devices`, révocation au premier échec d'envoi.
- **L'émetteur** : une edge function Supabase appelant l'API Expo Push, avec ses
  erreurs et sa suppression de jeton invalide. **Expo Push proxifie FCM → Android
  fonctionne sans Apple.**
- Le pont SQL → émetteur (voir la question ouverte), pour que `P1-006` s'y branche.
- `users.timezone` + les quiet hours 21 h–7 h, sauf annulation imminente.
- Le journal d'envoi + le compteur du plafond marketing (semaine glissante).
- Catégories : rappel J-1 18 h, promotion de liste d'attente, annulation d'un
  cours ; réglages granulaires par catégorie ; transactionnelles toujours en
  e-mail même push coupé.
- Contenus FR + EN, dans le même commit.
- Le *development build* **Android** (APK + FCM) et la passe correspondante.

## Hors périmètre

- **Tout ce qui exige Apple** → `P1-007b` : clé APNs, dev build iOS, deep link
  `rack://`, et les deux critères iOS.
- Les catégories P2 (WOD publié, paiement en échec) et le **marketing** lui-même.
- Le canal e-mail (`D-008`, bloqué par le nom de domaine).

## Critères d'acceptation

- [ ] **Android** — une notification arrive en moins de 30 secondes (dev build
      APK + FCM, sans compte Apple)
- [ ] Un token invalide est supprimé automatiquement au premier échec d'envoi
- [ ] Les quiet hours sont respectées **en heure locale du membre**
      (`users.timezone`, repli box), sauf pour l'annulation d'un cours imminent
- [ ] Désactiver une catégorie n'affecte pas les autres
- [ ] Le contenu s'affiche dans la langue du membre
- [ ] Le plafond marketing tient sur une semaine glissante, journal à l'appui —
      et une notification **transactionnelle** (promotion, annulation, rappel)
      passe même le plafond atteint
- [ ] pgTAP : le journal est append-only, tenant-scopé, non écrivable par un
      membre ; `users.timezone` non écrivable hors des colonnes accordées
- [ ] **appareil (Android)** — la notification arrive, la toucher ouvre l'app ;
      geste à écrire dans `docs/passe-mobile-iphone.md` (ou une passe Android)

## Estimation

`P1-007` valait 4 j·h « à recompter », aveu compris (l'émetteur, le journal et EAS
n'y étaient pas). À la découpe, **3 j·h restent ici** et 1 part dans `P1-007b`,
total inchangé — mais **la vraie réestimation se fait à l'ouverture** : première
lecture, l'émetteur (edge function + pont SQL) et le journal poussent au-dessus
de 3, **+1,25 pressenti**, à tenir par qui ouvre le ticket.

## Notes

Sans push, le taux d'usage de l'app s'effondre, et `P1-006` (liste d'attente)
attend l'émetteur. **La première vraie brique serveur du produit est ici** — pas
la couche API qu'ADR 0004 annonçait pour `P1-003`, qui a résolu son idempotence
en base et n'a jamais construit `apps/web/app/api/v1/`. L'ADR est amendé dans ce
sens.
