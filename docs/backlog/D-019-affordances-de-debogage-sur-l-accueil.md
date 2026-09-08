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

## L'inventaire des sœurs — fait le 8 septembre 2026

Trois recherches sur `apps/` : le sélecteur de langue, la galerie de
composants, l'identité affichée.

| Où | Quoi | Verdict |
| --- | --- | --- |
| `apps/mobile`, hors `index.tsx` | — | ✅ **rien**. Les trois affordances étaient concentrées sur l'accueil |
| `apps/web/app/page.tsx` | Un `LanguageSwitcher` **et** un lien vers le système de design | ⚠️ **la même famille, sur la racine web** — mais cette page se déclare elle-même écran de remplissage (`home.placeholder_web`), et elle sera remplacée par la page publique de la box. Noté, **pas corrigé** : retirer des affordances d'une page qui doit disparaître serait du travail à jeter |
| `apps/web/app/box/[slug]/**` | — | ✅ rien. Le back-office n'en porte aucune |

**Ce que l'inventaire dit de plus que le ticket** : le défaut n'était pas une
habitude répandue, c'était **un écran qui a servi de banc d'essai** et qu'on n'a
jamais nettoyé. C'est cohérent avec sa date — `P0-003`, quand l'accueil était le
seul écran qui existait.

## Critères d'acceptation

- [x] Le sélecteur de langue a quitté l'accueil, et les deux autres affordances
      sont sous `__DEV__` — vérifié au harnais le 8 septembre 2026 : l'accueil
      n'affiche plus « Français / English »
- [x] L'accueil ne porte **qu'un seul bouton primaire**. Mesuré plutôt que lu :
      un seul élément porte l'orange de la box (`rgb(228, 87, 46)`), « Voir le
      planning ». « Voir le système de design » est passé `ghost` — **même en
      développement**, parce qu'une seule action primaire est une règle d'écran,
      pas une règle de build
- [x] Changer de langue reste possible, depuis les réglages, et le choix survit
      au redémarrage — bascule FR → EN instantanée sans redémarrage (le critère
      de `P0-003`, préservé), et l'anglais tient après un rechargement complet
- [x] La galerie du système de design reste atteignable en développement
- [x] L'arbre d'accessibilité des réglages reste juste : le groupe s'annonce
      « Langue », chaque option par son nom, l'ordre suit la lecture
- [x] **`__DEV__` mord réellement** — et c'est le contrôle qui manquait, parce
      qu'un `__DEV__` mal placé est invisible en développement. Sur l'export de
      production (`pnpm --filter @rack/mobile build:web`, où `__DEV__` vaut
      `false`) : **zéro appel** à `home.design_system_cta` et
      `home.signed_in_as`. Les deux clés n'y subsistent que comme _valeurs_ dans
      les dictionnaires FR et EN, ce qui est normal — les traductions
      embarquent, les branches mortes non
- [ ] **appareil** — l'accueil vu par un membre sur l'app iOS. L'export web
      prouve que la garde mord ; il ne prouve pas ce que voit quelqu'un sur son
      téléphone. Rattaché à la passe groupée, où il coûte un regard

## Notes

**Pourquoi 0,5 j·h.** Trois déplacements et une variante de bouton. Ce qui prend
le temps est l'inventaire des sœurs, et la vérification que le choix de langue
survit vraiment au déménagement — c'est la seule des trois qui porte une
fonction.
