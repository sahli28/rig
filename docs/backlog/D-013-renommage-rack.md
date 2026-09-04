# `D-013` — RIG devient Rack, d'un seul geste

**Phase** `dette` · **Estimation** `0,5` j·h · **✅ fait le 4 septembre 2026** · **Décision produit** spec §20 q. 6

## Objectif

Le dépôt ne porte plus qu'un seul nom. RIG était un nom de travail ; **Rack** est
le nom du produit, arrêté le 4 septembre 2026, recherche d'antériorité faite —
aucun « RACK » en vigueur en France ni dans l'UE en classes 9, 41 et 42.

## Pourquoi maintenant, et pas après P1-003b

Trois fenêtres se referment, et deux ne se rouvrent jamais :

1. **`bundleIdentifier` est définitif après la première soumission à l'App
   Store.** `app.rig.mobile` aurait été le nom du produit pour toujours, dans
   l'endroit le moins modifiable de la chaîne ;
2. **les clés de stockage locales n'ont aujourd'hui aucune installation à
   déconnecter.** Renommer `rig.session` et `rig.schedule.` est gratuit tant que
   personne n'a l'app ; après la box pilote, c'est soixante membres déconnectés
   ou un code de migration de clés à écrire et à porter ;
3. **P1-003b touche les mêmes fichiers.** Un renommage sur un diff en cours coûte
   le double : les conflits ne portent pas sur ce qu'on a écrit, mais sur ce
   qu'on a déplacé sous ce qu'on écrivait.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| La décision du nom, datée | spec §20 q. 6 | ✅ inscrite par ce ticket |
| Recherche d'antériorité INPI / EUIPO | hors dépôt | ✅ faite — classes 9, 41, 42 |
| Un nom de domaine | — | ❌ **pas acheté.** Les URLs d'exemple restent en `rig.app` : inventer un domaine aurait été pire que le laisser visible. Bloque P2-015, D-008 et le retour d'Apple — voir « Chemin critique hors code » |
| Aucune installation de l'app en circulation | — | ✅ vérifié : Expo Go seulement, sur l'appareil de la développeuse |
| Aucune base de production | — | ✅ d'où l'édition des migrations en place (règle 13 de `CLAUDE.md`, écrite ici) |

## Périmètre

Remplacement **scripté et ancré**, jamais un `rig` nu — ce qui aurait cassé
`rigueur`, `rigide`, `trigger`, `original` et `ORIGIN`, qui contient `RIG` sans
être le produit :

| Motif | Devient | Occurrences |
| --- | --- | --: |
| `@rig/` | `@rack/` | 227 |
| `--rig-` | `--rack-` | 398 |
| `\bRIG\b` | `Rack` | 59 |
| `RigClient` / `createRigClient` | `RackClient` / `createRackClient` | 50 |
| `'rig.` (clés de stockage) | `'rack.` | 12 |
| `rig-maintain-class-occurrences` | `rack-…` | 4 |
| `app.rig.mobile` | `app.rack.mobile` | 2 |

Puis, hors motifs, ce que la relecture d'un `grep -i rig` nu a trouvé — et c'est
elle qui a rattrapé le seul défaut réel du lot :

- **`packages/ui/src/theme/css-vars.ts` : `const PREFIX = '--rig'`**, sans tiret
  final, donc invisible au motif `--rig-`. Le CSS aurait dit `--rack-` pendant
  que le thème émettait `--rig-` : **toutes les couleurs du back-office
  tombaient.** `css-vars.test.ts` l'aurait attrapé au premier `pnpm test` — le
  filet a fonctionné, mais c'est le grep qui l'a vu en premier ;
- `'__rig_chunks__:'`, le préfixe des morceaux de session dans le trousseau ;
- `"name": "rig"` à la racine du dépôt ;
- les `application_name` du harnais de concurrence et son marqueur `RIG_PEAK` ;
- `app.json` : `name`, `slug`, `scheme`, `bundleIdentifier`, `package` ;
- `docs/spec/RIG-spec-produit-technique.md` → **`docs/spec/spec-produit-technique.md`**
  (`git mv`, 20 renvois mis à jour). Le nom du produit vit dans le **titre** du
  document, pas dans son chemin : ce fichier ne se renommera plus jamais.

## Hors périmètre

- **Les URLs d'exemple `rig.app`** — six occurrences, spec et ADR 0002. Le
  domaine n'existe pas ; elles seront réécrites quand il existera ;
- **le dépôt GitHub lui-même**, qui se renomme dans les réglages du dépôt, pas
  ici. Le commentaire de `booking-concurrency.mjs` qui mentionne
  `supabase_db_rig` décrit ce qu'un runner **a observé** : le corriger d'avance
  en ferait un souvenir faux ;
- **`errors.test.ts`**, où `(slug)=(rig)` est le slug d'une box dans un message
  d'erreur Postgres synthétique — une donnée de test, pas le nom du produit ;
- tout le reste. Ce commit doit se relire comme « uniquement un renommage ».

## Critères d'acceptation

- [x] Les motifs ancrés rendent **zéro occurrence** — vérifié par `git grep`
- [x] Un `grep -i rig` nu ne rend plus que des mots français (`rigueur`,
      `rigoureuse`, `origin`, `trigger`, `right`), les URLs `rig.app` laissées
      volontairement, l'anecdote du runner et le slug de test — chacun nommé
      ci-dessus
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm lint:sondes`, `pnpm test`,
      `pnpm i18n:check`, `pnpm format:check` verts
- [x] `pnpm test:db` vert : la migration du job `pg_cron` a été **éditée en
      place**, la base reconstruite par `db reset`
- [ ] **Sur appareil** : l'app s'installe sous son nouveau `scheme` et le lien
      d'invitation `rack://` ouvre l'app. Non vérifié ici — **à la prochaine
      passe**, et noté au journal de `docs/passe-mobile-iphone.md`

## Notes

**Ce que ce ticket a coûté en vrai** : une demi-journée, dont l'essentiel en
vérification et non en remplacement. Le remplacement lui-même tient en un script
de trente lignes ; ce qui prend du temps, c'est de démontrer qu'il est complet.

**La règle 13 de `CLAUDE.md` est née ici** : une migration appliquée s'édite tant
qu'aucune base de production n'existe, et plus jamais après. Écrite maintenant
pour que la prochaine fois la réponse soit l'inverse sans qu'on ait à
re-délibérer.
