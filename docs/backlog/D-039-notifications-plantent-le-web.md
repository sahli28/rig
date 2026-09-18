# `D-039` — Les appels `Notifications` plantent l'app sur le web

**Phase** `dette` · **Estimation** `0,25` j·h · **Dépend de** `P1-007` · **Spec** §12 (harnais web), `ui.md` · **Origine** trouvée pendant `D-038`, 18 septembre 2026

## Objectif

Les écrans **authentifiés** s'affichent sur le harnais web — les appels
`expo-notifications` ne s'exécutent plus sur une plateforme qui ne les fournit
pas, donc plus de plantage.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| `useDeviceSync`, monté à la racine | `apps/mobile/app/_layout.tsx:84` | ✅ existe |
| Effet 3 (lien profond) | `apps/mobile/lib/push.ts:114` — `Notifications.getLastNotificationResponseAsync()` + `addNotificationResponseReceivedListener` | ⚠️ **la cause** : non gardés par `Platform.OS` → plantent sur le web (`expo-notifications` absent), et **tout écran authentifié** tombe avec |
| `currentPlatform()` sait déjà dire `'web'` | `push.ts:41-42` | ✅ existe — l'effet ne s'en sert simplement pas pour se garder |
| `setNotificationHandler` (au chargement du module) et l'effet 2 (`getExpoPushTokenAsync`) | `push.ts` | ⚠️ à vérifier dans le même passage : tout appel `Notifications` doit être neutre sur web |

## Périmètre

- Garder **tous** les appels `expo-notifications` derrière `Platform.OS !== 'web'`
  (effet 3 en premier, puis vérifier l'effet 2 et `setNotificationHandler`). Sur
  le web : pas de push, **pas de plantage**.

## Hors périmètre

- Le push **sur le web** (non prévu — le web est le back-office, pas la cible push).

## Critères d'acceptation

- [x] Un écran authentifié s'affiche sur le harnais web sans planter — l'arbre
      d'accessibilité redevient lisible (étape de livraison de `ui.md`). **Vérifié
      le 18 sept. 2026** : connexion OTP (`julie@example.com`, code lu dans
      Mailpit), puis consentements → accueil → accueil de box → **planning** →
      préférences, tous rendus sans plantage, `read_page` lisible à chaque écran
- [x] Aucun changement de comportement sur iOS / Android (push inchangé) — **par
      construction** : la garde est `Platform.OS !== 'web'`, donc sur natif
      `PUSH_SUPPORTED` vaut `true` et chaque bloc gardé s'exécute exactement comme
      avant (handler, effet 2, effet 3). Le court-circuit ne mord que sur web

## Notes

Pré-existant (`P1-007`), révélé pendant `D-038` en voulant lire le rendu FR/EN sur
le harnais web (le bundle lui-même est propre : l'accueil s'affiche). Débloque la
vérification web — celle de `D-038` comme celle des futures passes design web
(`P2-022`).

## Journal

**18 sept. 2026 — corrigé sur `fix/D-039-notifications-plantent-le-web` (un commit).**
Une constante module `PUSH_SUPPORTED = Platform.OS !== 'web'` garde **les trois**
sites `expo-notifications` de `push.ts` : `setNotificationHandler` (chargement du
module), l'effet 2 (`getPermissionsAsync`/`getExpoPushTokenAsync`) et l'effet 3
(`getLastNotificationResponseAsync` + `addNotificationResponseReceivedListener`).
Sur web : aucun appel, aucun crash. Sur natif : inchangé.

**Débloqué, et utilisé dans la foulée** : avec cette branche + le `planning.tsx`
de `D-038` posé en local (non committé), le rendu **FR et EN** de l'en-tête du
planning a enfin pu être lu sur le web — `‹ vendredi 18 septembre 2026 ›` et
`‹ Friday, 18 September 2026 ›`, la date tient sur une ligne dans les deux
langues, et les flèches s'annoncent « Jour précédent » / « Jour suivant » dans
l'arbre. C'est la vérification que `D-038` devait à l'appareil ; elle est
désormais faisable sur le harnais.

**À la fusion** : `D-039` et `D-037` modifient tous deux l'effet 2 de `push.ts`.
Cette branche part de `main` (l'effet inline), `D-037` le remplace par un appel à
`ensurePushDeviceRegistered`. Fusionner l'une puis l'autre lèvera un conflit sur
l'effet 2 — la résolution juste met la garde `Platform.OS !== 'web'` **dans**
`ensurePushDeviceRegistered`. À signaler pour ne pas la découvrir au merge.

`/check` vert : typecheck, format, lint, 18 sondes, `test`. `test:db` non exercé
(aucun diff `supabase/`).
