# `D-023` — Le consentement pointe vers un texte, et la constante en porte la date

**Phase** `P1` (dette) · **Estimation** `0,5` j·h · **Dépend de** la rédaction de la politique de confidentialité — **c'est son déclencheur d'ouverture** · **Bloque** `P1-016` · **Spec** §7.3, §15.1 · **Origine** `P1-016`, 9 septembre 2026

## Objectif

Un membre qui coche « J'ai lu la politique de confidentialité » peut la lire, et
la version enregistrée avec son consentement est celle du texte qu'il a lu.

## Ce que le dépôt fait aujourd'hui, et pourquoi c'est un consentement nul

`apps/mobile/app/(auth)/consents.tsx:113` fait cocher une phrase **sans pointer
vers rien** — ni lien, ni adresse. Le consentement est enregistré sous la
version que `current_policy_version()` retourne (`20260831133636_me_function.sql:16`,
`'2026-08-01'`), avec IP et user-agent. Et cette constante **conditionne
l'accès** : `me()` (`:135`) ne tient les consentements pour satisfaits que si
leur version est la sienne.

**Aucun texte ne porte cette version.** Le produit fait donc cocher, enregistre
une preuve horodatée, et ouvre l'accès — sur un document qui n'existe pas. Ce
n'est pas un document manquant, c'est un consentement qui n'est pas éclairé ; et
il a l'air conforme, ce qui est le pire cas.

**Avec une conséquence de séquence** : le jour où la constante passera à la
date réelle du texte, `me()` tiendra tous les consentements antérieurs pour
périmés. Avant les 80 membres de la box pilote, c'est invisible ; après, c'est
les faire tous recocher. **D'où « bloque `P1-016` »** — aucun import réel avant
que ce ticket soit fait.

## Ce que ce ticket suppose et qui doit exister

_Chaque état est vérifié dans le dépôt, le 9 septembre 2026._

| Prérequis | Où il vit | État |
| --- | --- | --- |
| **Le texte de la politique de confidentialité**, FR et EN | _rien_ | ❌ **hors périmètre, et c'est le point** : sa rédaction n'est pas du code et ne se sous-traite pas à un ticket. **Ce ticket s'ouvre quand le document existe** — pas avant, sinon on lie une constante à un texte vide |
| L'écran de consentement | `consents.tsx`, `Switch` de `@rack/ui/native` | ✅ existe — il manque un lien sous la case, pas un écran |
| Un endroit public où lire le texte | `apps/web/app/` — les pages publiques existent (`/`, `/invitation/[token]`) | ⚠️ **aucune page ne sert un document.** Une route publique à créer ici. Elle tombe sous `D-003` (SSR de l'i18n des pages publiques) : **ne pas le résoudre ici**, servir FR et EN comme les pages publiques le font aujourd'hui |
| La constante | `20260831133636_me_function.sql:16` | ✅ existe — **à aligner sur la date du texte**. Règle 13 : en place tant qu'aucune base de production n'existe, en migration ajoutée après `P1-017` |
| Le seed | `supabase/seed.sql:178-182`, quatre lignes de `consents` sous `'2026-08-01'` | ⚠️ **bouge avec la constante**, sinon `me()` demande `ACCEPT_CONSENTS` à Léa au premier `db:reset` |
| Un test qui lit les migrations depuis `packages/core` | `me.test.ts`, déclaré dans `turbo.json:4` | ✅ **la forme existe** — le test de ce ticket la reprend, et déclare le document dans `globalDependencies` **dans le même commit** (`CLAUDE.md`) |
| Un geste de passe iPhone pour l'écran de consentement | `docs/passe-mobile-iphone.md`, § 5, geste 4 | ⚠️ « Accepter, arriver sur l'accueil » — **rien ne vérifie qu'un lien s'ouvre**. À ajouter ici |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --- | --- | --- |
| Le lien depuis l'écran de consentement | chaque nouveau membre, à la première connexion | celui-ci |
| La page publique du texte | le lien, et **le DPA**, qui la cite | `P1-016` |
| Le test qui lie constante et texte | la CI — la constante cesse d'affirmer seule | celui-ci |

## Périmètre

- **Le lien** sous la case « J'ai lu la politique de confidentialité », vers la
  page publique. `Linking.openURL`, pas de WebView : Expo Go sait le faire, et
  un navigateur vaut mieux qu'une vue embarquée pour un texte qu'on doit
  pouvoir retrouver.
- **La page publique** qui sert le texte, FR et EN, **avec sa date de version
  visible** — c'est ce que le membre compare à ce qu'on lui a fait signer.
- **`current_policy_version()` alignée sur la date réelle du document**, et le
  seed avec elle.
- **Un test qui lie les deux** : il lit la date du document et la constante de
  la migration, et rougit si elles divergent. **C'est la règle 10 appliquée à
  une valeur** — une constante qui affirme seule quelque chose que rien ne
  vérifie est un faux vert qui attend. Le chemin du document entre dans
  `globalDependencies` **dans le même commit**.
- i18n FR + EN de la clé du lien. Le geste de passe.

## Hors périmètre

- **La rédaction de la politique.** Ce n'est pas du code ; c'est le
  déclencheur.
- **Le DPA et le registre** → `P1-016`, qui les date.
- **L'i18n SSR des pages publiques** → `D-003`. La page fait comme ses voisines.
- **Un historique de versions du texte.** Une seule version publiée à la fois ;
  le jour où il en faut deux, ce sera un ticket avec son cas d'usage.

## Critères d'acceptation

- [ ] Sur l'écran de consentement, un lien mène au texte, **et il s'ouvre** sur
      l'appareil
- [ ] La page publique affiche le texte et sa date de version, en FR et en EN
- [ ] `select public.current_policy_version()` retourne la date du texte publié
      — **prouvé par le test**, qui rougit quand on change l'une sans l'autre
- [ ] Un consentement enregistré après ce ticket porte cette date ; `pnpm
      db:reset` puis `me()` pour Léa ne redemande pas `ACCEPT_CONSENTS`
- [ ] `turbo run test --dry=json` montre que modifier le document change le
      hash — vérifié par une modification réelle, pas un `touch`
- [ ] Parité i18n
- [ ] **appareil** — le lien s'ouvre depuis Expo Go sur l'iPhone, et le texte
      est lisible à 200 %. Geste ajouté au § 5

## Estimation

| Lot | j·h |
| --- | ---: |
| Le lien, la clé i18n, le geste de passe | 0,1 |
| La page publique, FR + EN, date visible | 0,2 |
| La constante, le seed, le test et sa déclaration `turbo.json` | 0,2 |

**0,5 j·h**, **dans ①** : il bloque le jalon.

## Notes

**Ce ticket est écrit maintenant et s'ouvre plus tard** — quand le document
existe. Il est écrit maintenant pour une seule raison : que « rédiger la
politique » ait un endroit où être une échéance, et que `P1-016` ait quelque
chose de nommé à attendre. Un prérequis sans ticket en face est un prérequis
qu'on découvre le lundi matin.
