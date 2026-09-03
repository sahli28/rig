# D-004 — La langue : source de vérité, persistance, et repli

**Phase** dette · **Estimation** 2 j·h (était 1) · **Origine** P0-003, **élargi par la passe sur appareil du 3 septembre 2026** · **Dépend de** P0-005a ✅

> **Sur le chemin critique depuis le 3 septembre 2026.** P1-003b la rend
> bloquante : ses critères sont des critères de parcours, jugés à la main sur un
> appareil, et une app en anglais les fait juger sur les mauvais mots. Les 2 j·h
> ont quitté la dette hors totaux pour entrer dans le total du jalon pilote, et
> ce ticket **ouvre** la chaîne D-004 → P1-002b → P1-003b.

## Ce que la passe sur appareil a montré

iPhone 12 Pro Max, Expo Go, SDK 57. **L'app s'ouvre en anglais sur un téléphone
réglé en français**, alors que `users.locale` vaut `'fr'` pour ce compte dans le
seed.

Ce n'est pas un défaut mais **trois**, et les traiter séparément est la moitié du
travail.

### 1. `deviceLocale()` ne lit pas la langue de l'appareil

`apps/mobile/app/_layout.tsx` la calcule avec
`Intl.DateTimeFormat().resolvedOptions().locale`. Sous Hermes, cette valeur **ne
reflète pas les réglages du téléphone** : elle vaut `en-US` par défaut.
`localeFromTag` retombe donc sur `FALLBACK_LOCALE`, qui est `'en'`.

La fonction porte le nom de ce qu'elle voudrait faire, pas de ce qu'elle fait —
et le commentaire de `packages/core/src/i18n/types.ts` porte l'hypothèse fausse
noir sur blanc : « sur mobile comme sur le web,
`Intl.DateTimeFormat().resolvedOptions().locale` la donne ». Il faudra le
corriger en même temps que le code : un commentaire faux survit plus longtemps
qu'un code faux.

Correctif : `expo-localization`, `getLocales()[0].languageTag`. **Inclus dans
Expo Go**, aucun build natif nécessaire — c'est ce qui rend ce point peu coûteux.

### 2. Le choix ne survit pas au redémarrage

C'est D-004 d'origine, confirmé sur appareil. `I18nProvider` accepte un
adaptateur `LocaleStorage` ; le web lui en passe un, le mobile aucun. Un membre
qui bascule en anglais retrouve le français — ou plutôt l'anglais, vu le défaut 1
— au lancement suivant.

### 3. La vraie question : quelle est la source de vérité ?

Les deux premiers points sont des correctifs. Celui-ci est une **décision**, et
c'est pour elle que ce ticket existe séparément plutôt que d'être absorbé dans
P1-003.

## Recommandation

**Un ordre de priorité, du plus fort au plus faible :**

| Rang | Source | Pourquoi à ce rang |
| ---- | ------ | ------------------ |
| 1 | Préférence enregistrée sur l'appareil | Un choix explicite et récent l'emporte sur tout. C'est la seule source où quelqu'un a *dit* quelque chose |
| 2 | `users.locale` du profil serveur | Un choix explicite, fait ailleurs. C'est lui qui rend la langue **cohérente entre le web et le mobile** pour la même personne |
| 3 | Langue de l'appareil | Une préférence réelle, mais qui n'est pas à propos de ce produit |
| 4 | Repli | Voir ci-dessous |

**Le profil est déjà téléchargé par `useSession()` et n'est utilisé nulle part
pour ça.** C'est la donnée la plus juste du lot, elle est là, et personne ne la
lit. Le rang 2 ne coûte donc presque rien.

Un point de mécanique à ne pas rater : le rang 2 n'est disponible qu'**après**
l'authentification, alors que l'écran de connexion s'affiche avant. La langue
doit donc pouvoir changer une fois en cours de session, sans que ça clignote.
C'est le seul endroit délicat du ticket.

## `FALLBACK_LOCALE = 'en'` — un choix que personne n'a fait exprès

Le produit est vendu à des **boxes françaises**, ses écrans sont pensés en
français, et `types.ts` le dit lui-même en justifiant `en-GB` : « le marché est
européen ». `CLAUDE.md` annonce « France / UE ».

Un repli anglais est donc l'inverse du défaut attendu. Il vient probablement de
l'habitude, pas d'un arbitrage.

**Recommandation : `FALLBACK_LOCALE = 'fr'`.** Le repli ne s'applique qu'aux cas
où l'on ne sait rien — appareil dans une langue non gérée, aucune préférence,
aucun profil. Dans ces cas-là, servir la langue de la box plutôt qu'une troisième
langue est plus juste.

C'est une ligne, et elle change ce que voit une personne dont le téléphone est en
allemand ou en espagnol. À trancher explicitement, pas à subir.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `users.locale`, écrite à l'inscription | P0-005a | ✅ existe |
| `me()` rend le profil, et `useSession()` le télécharge | P0-005a | ✅ existe — **et personne ne lit `locale`** |
| `I18nProvider` avec son adaptateur `LocaleStorage` | `packages/ui` (P0-003) | ✅ existe, utilisé par le web seul |
| `expo-secure-store`, pour la préférence locale | `apps/mobile` | ✅ existe — `chunkedStore` s'en sert déjà pour la session, vérifié sur appareil |
| `expo-localization` | — | ❌ **dépendance à ajouter**, à justifier au commit. **Vérifié le 3 septembre 2026** : « Included in Expo Go » sur `docs.expo.dev/versions/latest/sdk/localization/` (SDK 57), version épinglée `~57.0.1`. Aucun development build, donc aucun compte Apple payant — installer avec `npx expo install` |
| Un appareil réel pour vérifier | — | ✅ disponible — iPhone 12 Pro Max, et c'est lui qui a trouvé le défaut |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `deviceLocale()` qui lit vraiment l'appareil | `_layout.tsx` | celui-ci |
| L'adaptateur `LocaleStorage` mobile | `I18nProvider` | celui-ci |
| La résolution à quatre rangs | le démarrage de l'app, et la reprise de session | celui-ci |
| `FALLBACK_LOCALE` tranché | tout le produit | celui-ci |

## Critères d'acceptation

- [ ] Un iPhone réglé en français ouvre l'app **en français**, avant toute
      connexion
- [ ] La langue choisie survit à la fermeture complète de l'app
- [ ] Elle suit le compte d'un appareil à l'autre : se connecter sur un second
      téléphone donne la langue du profil, pas celle de l'appareil
- [ ] Une préférence posée sur l'appareil l'emporte sur le profil, et **écrit le
      profil** — sinon les deux divergent en silence
- [ ] Le passage à la langue du profil, après connexion, ne fait pas clignoter
      l'écran
- [ ] Un appareil dans une langue non gérée (allemand) ouvre l'app dans le repli
      **tranché par ce ticket**, et le ticket dit lequel
- [ ] Le commentaire de `types.ts` ne prétend plus qu'`Intl` donne la langue de
      l'appareil sur mobile

## Notes

Ne pas coder dans P1-003 : la décision de source de vérité touche le web autant
que le mobile, et elle n'a rien à voir avec la réservation.

Le défaut 1 explique aussi pourquoi rien ne l'avait attrapé : `localeFromTag` est
testée, et ses tests passent — elle fait correctement ce qu'on lui demande. C'est
son **entrée** qui était fausse, et aucune suite unitaire ne pouvait le voir.
Il fallait un téléphone.
