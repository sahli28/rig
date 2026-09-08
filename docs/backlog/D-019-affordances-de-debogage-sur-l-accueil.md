# `D-019` — Trois affordances de débogage sur l'accueil d'un membre

**Phase** `dette` · **Estimation** `0,5` j·h · **Dépend de** — · **Spec** §12.1 (principes 1 et 2) · **Origine** relecture du 8 septembre 2026

## Objectif

L'accueil montre à un membre ce qui le concerne, et **rien qui n'existe que pour
nous**.

## Le constat

`apps/mobile/app/(app)/index.tsx` ne contient **aucun `__DEV__`**, et porte trois
affordances qui n'ont pas de raison d'être sur l'écran d'accueil d'un membre :

| Ligne | Affordance | Pourquoi elle est là |
| --- | --- | --- |
| `:287` | Le **sélecteur de langue** (`SegmentedControl` FR/EN) | Posé par `P0-003` pour éprouver l'i18n. Un commentaire promet depuis ce jour-là qu'il « rejoindra les réglages » |
| `:281` | La ligne **« Connexion : {email} »** | Utile pour savoir qui est connecté pendant une passe. Un membre, lui, le sait |
| `:319` | Le bouton **« Voir le système de design »** | Une galerie de composants, en **variante primaire** (le défaut de `Button`) |

**C'est la règle 9 de `CLAUDE.md` prise par un autre bout.** Une affordance de
débogage est une sonde : elle porte `__DEV__` dès sa première ligne, ou elle vit
dans un écran où un membre a une raison d'aller. Celles-ci sont plus tenaces
qu'un `console.log`, et pour une raison qui vaut d'être écrite : **elles ont
l'air d'une fonctionnalité.** Personne ne les retire parce que personne ne les
lit comme temporaires — cinq jours pour dix `console.log` en `D-018`, et le
sélecteur de langue est là depuis `P0-003`.

## Ce que ça coûte à la spec, et ce que ça ne coûte pas

**Principe 2 — une seule action primaire par écran (§12.1).** Rompu.
`Button` a `variant = 'primary'` par défaut, et « Voir le système de design » ne
passe pas de variante : l'accueil porte donc **deux boutons pleins**, « Voir le
planning » et une galerie de composants. La spec est explicite : « Si vous
hésitez entre deux actions primaires, l'écran a un problème. »

**Principe 1 — la réservation en deux taps.** ✅ **Tenu, contrairement à ce
qu'une lecture rapide suggère.** La carte « Ton prochain cours » **est**
actionnable — `index.tsx:159`, `<Card onPress={() => router.push('/class/…')}>`
avec son `accessibilityLabel`. Tap 1 : le cours. Tap 2 : réserver. Écrit ici
parce que la question s'est posée le 8 septembre 2026 et qu'elle se reposera :
la réponse est oui, et le doute venait de ce que la carte n'a pas l'apparence
d'un bouton.

**Ce qui reste ouvert et n'appartient pas à ce ticket** : la carte ne se *voit*
pas comme actionnable. C'est une question de design, pas de dette ; si elle doit
être tranchée, c'est dans un ticket qui regarde l'écran, pas dans celui-ci.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Un écran de réglages membre | `apps/mobile/app/(app)/preferences.tsx` | ✅ existe, atteint depuis l'accueil (`:311`) — c'est là que le sélecteur de langue doit aller |
| `setLocale` et la persistance du choix | `@rack/ui/i18n`, consommé par `index.tsx:286` | ✅ existe |
| `__DEV__` | Global React Native, déjà employé (`class/[id].tsx:285`) | ✅ existe |
| Les variantes de `Button` | `packages/ui/src/native/button.tsx:28` — défaut `primary` | ✅ existent (`primary`, `secondary`, `ghost`) |

## Périmètre

- **Le sélecteur de langue déménage dans `preferences.tsx`.** Il n'est pas
  supprimé : changer de langue est une vraie fonction, elle est simplement au
  mauvais endroit depuis `P0-003`. Le commentaire qui le promettait disparaît
  avec lui.
- **La ligne « Connexion : … » passe sous `__DEV__`**, ou disparaît. À trancher
  en le faisant : elle sert aux passes, et une passe se joue en `__DEV__`.
- **Le bouton « Voir le système de design » passe sous `__DEV__`.** La galerie
  reste, l'écran d'accueil d'un membre n'y mène plus en production.
- Vérifier après coup qu'il **ne reste qu'une action primaire** sur l'accueil.

## Hors périmètre

- Refondre l'accueil. Ce ticket retire, il ne redessine pas.
- L'apparence actionnable de la carte du prochain cours (voir plus haut).
- Les autres écrans. **Mais l'inventaire fait partie du ticket** : la règle des
  sœurs veut qu'on cherche les mêmes affordances ailleurs avant de refermer, et
  ce qui est trouvé se note ici même s'il n'est pas corrigé.

## Critères d'acceptation

- [ ] `grep -rn "SegmentedControl\|signed_in_as\|design_system" apps/mobile/app/(app)/index.tsx`
      ne rend plus rien hors d'un bloc `__DEV__`
- [ ] L'accueil ne porte **qu'un seul bouton primaire**
- [ ] Changer de langue reste possible, depuis les réglages, et le choix survit
      au redémarrage de l'app
- [ ] La galerie du système de design reste atteignable en développement
- [ ] **appareil** — l'accueil, vu par un membre sur un build de production, ne
      montre rien qui n'existe que pour nous. Le seul geste que le harnais ne
      peut pas jouer : il tourne en `__DEV__`

## Notes

**Pourquoi 0,5 j·h.** Trois déplacements et une variante de bouton. Ce qui prend
le temps est l'inventaire des sœurs, et la vérification que le choix de langue
survit vraiment au déménagement — c'est la seule des trois qui porte une
fonction.
