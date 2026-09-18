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

- [ ] Un écran authentifié s'affiche sur le harnais web sans planter — l'arbre
      d'accessibilité redevient lisible (étape de livraison de `ui.md`)
- [ ] Aucun changement de comportement sur iOS / Android (push inchangé)

## Notes

Pré-existant (`P1-007`), révélé pendant `D-038` en voulant lire le rendu FR/EN sur
le harnais web (le bundle lui-même est propre : l'accueil s'affiche). Débloque la
vérification web — celle de `D-038` comme celle des futures passes design web
(`P2-022`).
