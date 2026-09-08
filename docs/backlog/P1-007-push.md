# `P1-007` — Notifications push

**Phase** `P1` · **Estimation** `4` j·h *(à recompter — voir les prérequis)* · **Dépend de** `P0-005` ✅ · **Spec** §5.3, §12.3 · **✅ Débloqué le 8 septembre 2026** — le compte Apple est actif

## Objectif

Une place se libère à 19 h : la personne suivante l'apprend sur son téléphone,
pas en rouvrant l'app le lendemain.

> ## ✅ Le blocage administratif est levé — 8 septembre 2026
>
> Le compte développeur Apple est actif (jusqu'au 8 sept. 2027), App Store
> Connect est ouvert. Un *development build* iOS est donc possible : **les deux
> critères `[~]` ci-dessous redeviennent exerçables**, et ils passent `[ ]`.
>
> **Ce qui reste devant ce ticket n'est plus administratif, c'est du code** — et
> c'est sa section de prérequis qui le nomme : aucun émetteur, aucun journal
> d'envoi, `users` sans fuseau. La section ci-dessous est conservée telle
> quelle : elle explique pourquoi le ticket a attendu, et un blocage effacé une
> fois levé se re-suspecte.

## ⛔ Ce qui bloquait, et ce que ça a changé pour l'ordre du jalon

*Écrit le 6 septembre 2026, en ouvrant le ticket. Il date d'avant la règle 8 et
n'avait pas sa section de prérequis ; c'est la troisième fois qu'elle aurait
payé avant le code.*

**Expo Go ne sait plus envoyer de push depuis le SDK 53.** Le dépôt est en
`~57.0.18` (`apps/mobile/package.json:21`). La documentation Expo est explicite :
tester le push demande un **development build**.

D'où une chaîne qui ne se résout pas en codant :

| Marche | Ce qu'elle demande | État |
| --- | --- | --- |
| Tester le push sur **iPhone** | un development build iOS | ❌ impossible aujourd'hui |
| Un development build iOS | EAS + enrôlement de l'appareil | ❌ **compte développeur Apple**, 99 $/an |
| Envoyer vers iOS | une clé APNs, un identifiant d'app | ❌ même compte |
| « Toucher la notification ouvre l'écran concerné » | le schéma `rack://` | ❌ Expo Go ouvre en `exp://` — déjà noté comme « à faire au premier build dédié » depuis P1-003b |
| Tester le push sur **Android** | un development build APK + FCM | ✅ **gratuit, exerçable dès maintenant** |

**Trois des six critères d'acceptation ne sont donc pas exerçables sur iOS**,
et aucun geste n'existe pour les tenter. Android, lui, est ouvert.

**Conséquence sur l'ordre du jalon, et c'est le point qui compte** : le README
ordonnait `P1-007 → P1-006 → P1-008a`, soit **17 des 21,75 j·h restants**, et `P1-006`
dépend de `P1-007` pour la promotion de liste d'attente. Le chemin critique
administratif ne bloque donc plus un ticket lointain : **il bloque le prochain.**

> **Ce paragraphe est au passé depuis le 8 septembre 2026.** L'ordre est devenu
> `P1-015 → P1-008a → P1-007 → P1-006`, sur le retour de la box pilote : le coach
> demande la programmation, et sans elle il garde Hustle Up pendant tout le
> pilote. `P1-007` reste devant `P1-006`, il n'est simplement plus le prochain.
> Conservé tel quel parce qu'il explique pourquoi le compte Apple avait été
> promu au premier rang — et un raisonnement effacé une fois dépassé se refait.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Table `devices` (jeton, plateforme, `last_seen_at`) | `20260830143108_compliance_and_ledger.sql:66` | ✅ existe — **globale, sans `tenant_id`**, assumé : un membre inscrit dans deux boxes garde un seul appareil |
| Policy et droits sur `devices` | `20260830143108:242`, `20260901140000:85` | ✅ `devices_self_write` (`for all`, propriétaire) et les grants |
| Consentement `PUSH` | `20260830143108:7` (`consent_purpose`), écran de consentement, clé `consents.push` | ✅ existe, et **la case est déjà cochable par un membre** — donc déjà recueilli sans que rien ne l'honore |
| Langue du membre | `users.locale` (`20260830143106:59`), `fr`/`en` contraints | ✅ existe — le critère « dans la langue du membre » a sa source |
| Un ordonnanceur de fond | `pg_cron`, activé et déjà employé (`20260902120000:389`) | ✅ existe — le rappel J-1 a son précédent, il n'y a pas de mécanisme à inventer |
| Schéma d'URL `rack://` | `apps/mobile/app.json:5` | ⚠️ **déclaré, jamais exercé** — Expo Go ouvre en `exp://` |
| **Un émetteur** — ce qui appelle réellement l'API Expo Push | *rien* : aucune edge function (`supabase/functions` n'existe pas), aucun route handler (ADR 0004) | ❌ **à créer par ce ticket.** C'est le plus gros morceau et il n'était nulle part dans le périmètre |
| **`expo-notifications`** | *absent de `apps/mobile/package.json`* | ❌ à ajouter, avec sa justification au commit |
| **Configuration EAS** | *aucun `eas.json`* | ❌ à créer — et elle ne sert à rien sans le compte Apple, côté iOS |
| **Compte développeur Apple** | — | ❌ **démarche administrative**, chemin critique du README |
| **Clé APNs / identifiants** | — | ❌ même compte |
| **Fuseau horaire du membre** | `tenants.timezone` existe (`20260830143106:34`) ; **`users` n'a pas de fuseau** | ❌ **le périmètre dit « quiet hours 21 h–7 h heure locale du membre » et cette donnée n'existe pas.** À trancher : colonne sur `users`, ou repli sur le fuseau de la box |
| **Journal d'envoi** (plafond de 2 marketing / semaine / membre) | *aucune table* | ❌ à créer — un plafond sans compteur n'est pas un plafond |

**Deux `❌` ne nomment aucun ticket, et c'est volontaire** : l'émetteur et le
journal d'envoi appartiennent à celui-ci. Les autres sont administratifs et ne se
rattrapent pas en codant plus vite.

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --- | --- | --- |
| L'émetteur (API Expo Push) | la promotion de liste d'attente | `P1-006` — **c'est sa dépendance, et la raison de l'ordre** |
| Notification d'annulation de cours | l'écran d'annulation du back-office | `P1-004` ✅, **et il attend déjà** : `planning.cancel_no_notification` dit aux membres « le canal de notification n'existe pas encore. Préviens-les autrement. » Cette microcopie disparaît avec ce ticket |
| Rappel de cours J-1 | un job `pg_cron` | celui-ci |
| Enregistrement / révocation de jeton | l'app au démarrage | celui-ci |

**Un appelant existant qui attend est la meilleure preuve qu'un ticket sert.**
`P1-004` a livré une phrase d'excuse à la place d'une notification ; c'est elle
qu'on retire ici.

## Périmètre

- `expo-notifications`, enregistrement du jeton au démarrage, écriture dans
  `devices`, révocation au premier échec d'envoi.
- **L'émetteur** : une edge function Supabase qui appelle l'API Expo Push, avec
  ses erreurs et sa suppression de jeton invalide.
- Catégories : rappel de cours J-1 18 h, promotion de liste d'attente, annulation
  d'un cours. *(WOD publié et paiement en échec sont P2.)*
- Réglages granulaires par catégorie côté membre ; les notifications
  transactionnelles restent en e-mail même push désactivé.
- Quiet hours 21 h–7 h, sauf annulation d'un cours imminent — **dans le fuseau
  qu'on aura tranché** (voir les prérequis).
- Plafond de 2 notifications marketing par semaine et par membre, avec le journal
  qui le rend vérifiable.
- Contenus en FR et EN, dans le même commit.

## Hors périmètre

- Les catégories P2 (WOD publié, paiement en échec).
- Le canal e-mail lui-même (`D-008`, bloqué par le nom de domaine).

## Critères d'acceptation

- [ ] **Android** — une notification arrive en moins de 30 secondes
- [ ] **iOS** — une notification arrive en moins de 30 secondes. *(Était `[~]`
      jusqu'au 8 sept. 2026 : Expo Go ne fait plus de push depuis le SDK 53.
      Le compte Apple étant actif, le development build lève le blocage.)*
- [ ] Un token invalide est supprimé automatiquement au premier échec d'envoi
- [ ] Les quiet hours sont respectées, sauf pour l'annulation d'un cours imminent
- [ ] Désactiver une catégorie n'affecte pas les autres
- [ ] Le contenu s'affiche dans la langue du membre
- [ ] Toucher la notification ouvre l'écran concerné (deep link), pas l'accueil.
      *(Était `[~]` : Expo Go ouvre en `exp://`. Le development build donne
      `rack://`, et débloque du même coup le critère resté ouvert de
      `P1-003b` — les deux attendaient la même démarche.)*
- [ ] Le plafond marketing tient sur une semaine glissante, journal à l'appui

## Notes

Sans push, le taux d'usage de l'app s'effondre. Ce ticket précède `P1-006`, qui
en dépend.

**L'estimation de 4 j·h date d'avant cette section et ne couvre ni l'émetteur, ni
le journal d'envoi, ni la configuration EAS.** Elle est à recompter au moment de
lancer le ticket, pas maintenant : ce qu'il coûtera dépend de la réponse à la
question d'ordre ci-dessus.
