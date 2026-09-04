# `D-012` — La façade `crypto` et les sondes de lint *(rétroactif)*

**Phase** `dette` · **Estimation** `0,5` j·h · **✅ fait le 4 septembre 2026** · **Origine** revue de backlog du même jour

## Pourquoi un ticket écrit après coup

Le travail était fait, et il n'apparaissait dans **aucun total**. La revue de
backlog l'a repéré et a posé la bonne question : le demi-jour ajouté à P1-003b
le même jour le couvrait-il ?

**Non.** Ce demi-jour paie trois décisions prises dans le ticket — la réponse à
un cours complet, le libellé et l'annonce accessibles du bouton, le câblage
d'`expo-crypto` **à venir**. Il ne paie pas la façade, les sondes et la refonte
d'`eslint.config.mjs`, qui étaient déjà écrites quand il a été ajouté. Les deux
lots existent, ils sont distincts, et les compter une seule fois rendait le total
du jalon pilote faux de 0,5 j·h.

Un ticket rétroactif n'est pas de la bureaucratie ici : **37,5 j·h restants est
un chiffre sur lequel des décisions se prennent** — la date du jalon, l'ordre des
tickets, ce qu'on montre à une box pilote. Un total juste vaut plus qu'un total
flatteur.

## Ce qui a été livré

- **L'interdit ESLint étendu à `crypto`**, dans les quatre blocs
  `no-restricted-syntax`, avec les trois interdits transformés en constantes
  nommées pour que l'écrasement d'un bloc par le suivant devienne visible ;
- **la porte de derrière fermée** : `globalThis.Intl` et `globalThis.crypto`
  sont visés au même titre que `Intl.` et `crypto.` ;
- **l'interdit d'import d'`expo-crypto`** hors du fichier qui installe la source
  d'aléa — le jumeau non gardé, trouvé à la revue : `Crypto.randomUUID()` est un
  appel de module, qu'aucun interdit de global ne voit ;
- **la façade** `packages/core/src/crypto.ts` — `uuidV7()` (RFC 9562, même
  disposition d'octets que `public.uuid_generate_v7()`), la source d'aléa
  installable, et le refus de se rabattre sur `Math.random()` ;
- **le test d'amputation** `crypto.test.ts`, 11 cas, dont le verdict inverse de
  celui d'`Intl` : retirer `crypto` doit faire **lever** ;
- **`pnpm lint:sondes`**, 13 sondes qui vérifient que les interdits mordent,
  contrôle négatif fait à chaque ajout, **et en CI** juste après `pnpm lint`.

## Ce que ce ticket suppose et qui doit exister

Rétroactif : tout existait, puisque c'est fait. La section est conservée pour ne
pas créer de gabarit à deux vitesses.

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| La façade d'`Intl` comme précédent | `packages/core/src/i18n/intl.ts` | ✅ existait (PR #26) |
| Un moteur documenté | `docs/passe-mobile-iphone.md`, § « Ce que le moteur offre » | ✅ existait |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `uuidV7()` | la clé d'idempotence de l'écran de réservation | **P1-003b** |
| `installRandomBytesSource()` | `apps/mobile/app/_layout.tsx`, au démarrage | **P1-003b** |
| `pnpm lint:sondes` | la CI, et `/check` en 2bis | celui-ci |

**Les deux premières n'ont toujours aucun appelant** (règle 7). C'est écrit sur
les fonctions et dans P1-003b, qui les câblera.

## Critères d'acceptation

- [x] `crypto` interdit hors de la façade, et l'import d'`expo-crypto` hors du
      câblage — 13 sondes vertes, contrôle négatif fait dans les deux cas
- [x] La façade lève plutôt que de se dégrader en silence
- [x] `pnpm lint:sondes` tourne en CI, pas seulement dans `/check`
- [x] `uuidV7()` rend la même forme que `public.uuid_generate_v7()`

## Notes

**Ce ticket n'ajoute aucun reste à faire.** Il ajoute 0,5 j·h au total ① *et* aux
travaux faits : le nombre qui compte — 37,5 j·h restants — ne bouge pas.
