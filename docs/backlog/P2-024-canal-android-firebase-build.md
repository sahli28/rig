# `P2-024` — Canal Android : Firebase, build, preuve push

**Phase** `P2` · **Estimation** `2,5` j·h · **Dépend de** `P1-007` (chaîne push, émetteur Expo) · **Spec** §14, §16.4 · **Origine** demande commanditaire, 16 septembre 2026 — **prioritaire**

## Objectif

L'app tourne sur Android et **reçoit le push** : un membre sur Android installe,
se connecte, et la notification de promotion de liste d'attente arrive. Le `[~]`
Android laissé ouvert par `P1-007` se ferme ici.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Config Android de l'app (package, icônes adaptatives) | `apps/mobile/app.json` → `android.package = app.rack.mobile` | ✅ existe — l'app est prête côté manifeste |
| Un profil de build **Android** | `apps/mobile/eas.json` | ❌ **à créer** : aucun des trois profils (`development`, `preview`, `production`) ne porte de bloc `android`. À ajouter, **avec `env`** (les variables Supabase, comme le correctif `D-031` l'a fait pour iOS/preview) |
| Code push plateforme-agnostique | `apps/mobile/lib/push.ts` (`getExpoPushTokenAsync({ projectId })`) | ✅ Expo Push route vers FCM sur Android — rien à réécrire |
| Émetteur Expo Push déployé et servi | `rack-push-emitter` (`P1-007`/`P1-017`) | ✅ le même émetteur sert les deux plateformes |
| **Projet Firebase + identifiants FCM** (`google-services.json` / clé FCM V1) | Firebase | ❌ **prérequis administratif** — geste commanditaire : créer le projet Firebase, charger les identifiants sur EAS (`eas credentials`). Ne se rattrape pas en codant |
| **Un appareil Android de test** | — | ❌ **prérequis physique** — la preuve du push exige un vrai téléphone Android (Expo Go ouvre en `exp://`, pas `rack://`) |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --- | --- | --- |
| Un binaire Android installable | la soumission Play Store | `P2-025` |
| La preuve du push Android | le critère `[~]` Android de `P1-007` | celui-ci ferme ce `[~]` |

## Périmètre

- Profil de build Android dans `eas.json`, avec `env` (parité avec iOS/preview).
- Configuration des identifiants FCM sur EAS (à partir du projet Firebase).
- Premier build Android (`eas build -p android --profile preview` — APK sideloadable, pas le défaut AAB), installé sur un appareil réel.
- Preuve : réception d'un push sur Android + ouverture du schéma `rack://` (deep
  link) depuis la notification.

## Hors périmètre

- La soumission au Play Store → `P2-025`.
- iOS — déjà prouvé (`P1-007`, dev build du 11 sept.).

## Critères d'acceptation

- [x] Un profil `android` existe dans `eas.json`, avec les variables d'environnement
      — `preview.android.buildType = apk`, `env` déjà au niveau du profil ; gardé
      par `apps/mobile/eas-env.test.ts` (deux assertions P2-024)
- [ ] Un build Android s'installe et démarre sans écran blanc (les variables sont
      chargées — même piège que `D-031` sur iOS)
- [~] **Appareil** : push reçu sur un téléphone Android, et `rack://` ouvre le bon
      écran — exerçable dès que le projet Firebase et l'appareil existent
      (prérequis administratif + physique ci-dessus)

## Notes

Priorité relevée par la commanditaire le 16 sept. 2026 : Android n'attend plus la
mise en service (`P1-016`), il entre dans la ② avec sa fiche. Le code est prêt ;
ce qui manque est de la configuration et deux gates (Firebase, un appareil).

## Journal

**18 sept. 2026 — la configuration, faite ; le build et l'appareil restent.**
Livré sur `feat/P2-024-canal-android-firebase-build` (un commit) :

- `apps/mobile/eas.json` : `preview.android.buildType = apk` — c'est le profil
  qu'on installe sur le téléphone (distribution interne, `env` déjà présent au
  niveau du profil, donc parité D-031 tenue). Gardé par deux assertions P2-024
  dans `eas-env.test.ts` (un profil `android` existe ; `preview` porte `android`
  **et** ses `EXPO_PUBLIC_*`) — écrites rouges d'abord, vertes après.
- `apps/mobile/app.json` : `android.googleServicesFile = "./google-services.json"`.
  Le `package` du fichier est `app.rack.mobile`, il coïncide avec `app.json` ;
  `project_id` = `rack-b6a4a`, cohérent avec le nom de la clé de compte de service.
- `apps/mobile/google-services.json` : **committé**, pas gitignoré. Décision prise
  avec la commanditaire, cohérente avec `D-031` : c'est de la config **publique
  par construction** (clé client restreinte par package + SHA, elle part dans
  chaque APK), donc versionnée et diffable plutôt qu'un état hors dépôt qui dérive
  (`D-029`). *Et surtout* : un build EAS **cloud** n'embarque pas les fichiers
  gitignorés — un `google-services.json` gitignoré + chemin statique aurait fait
  échouer `eas build`. `.prettierignore` le laisse tel que Firebase le rend.

**Ce qui reste — gestes commanditaire, hors dépôt :**

1. **Clé de compte de service FCM V1** (`rack-b6a4a-firebase-adminsdk-*.json`,
   dans `imys data`, **jamais** dans le dépôt) → `eas credentials` → Android →
   *FCM V1 service account key*. C'est ce qui autorise Expo Push à émettre vers
   FCM. **Secret — ne se colle nulle part en clair.**
2. **Build** : `eas build -p android --profile preview` (APK sideloadable), puis
   installation sur le téléphone Android de test.
3. **Preuve appareil** (`[~]`) : un push reçu sur Android, et `rack://` qui ouvre
   le bon écran depuis la notification. Ferme le `[~]` Android de `P1-007`.

Le critère de code (profil `android` + `env`) est `[x]`. Les deux critères
d'appareil restent ouverts jusqu'à la passe — convention règle 5 de `CLAUDE.md`
(fusionné ≠ clos tant que l'appareil n'a pas parlé).
