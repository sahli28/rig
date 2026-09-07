# `D-014` — Deux filets dont on connaît le trou

**Phase** `dette` · **Estimation** `0,5` j·h · **Origine** P1-003b, 5 septembre 2026 · **Non bloquant**

## Objectif

Les deux trous ci-dessous cessent d'exister **ou** cessent d'être invisibles. Ce
ticket accepte les deux issues : un garde qui ne peut pas tout voir et qui le
dit vaut mieux qu'un garde qu'on croit étanche. Ce qu'il refuse, c'est l'état
actuel — **un trou connu qui ne vit que dans un message de commit, donc nulle
part**.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| Le garde de migrations | `.claude/hooks/guard-migrations.mjs` | ✅ existe, et son message dit déjà sa portée depuis le 5 sept. |
| Les sondes de lint, comme précédent de « vérifier qu'un garde mord » | `scripts/eslint-sondes.mjs` | ✅ existent (D-012) |
| Les tests pgTAP concernés | `supabase/tests/booking_test.sql` | ✅ existent, verts |

## 1. Le garde de migrations ne voit qu'un chemin sur deux

`guard-migrations.mjs` s'exécute sur `PreToolUse(Edit|Write)`. **Un script Node
lancé en Bash écrit le même fichier sans qu'il le voie** : c'est ce qui s'est
passé au renommage `D-013`, où une migration versionnée a été modifiée sans que
rien ne bronche. Le hook n'a pas échoué — il n'était pas sur le chemin.

C'est la règle des sœurs appliquée à l'outillage : un chemin gardé, son jumeau
oublié. Et c'est la forme la plus coûteuse du défaut, parce qu'un garde muet
**inspire confiance**.

Trois issues, et la troisième est probablement la bonne :

- **élargir le hook à `Bash`** : possible, mais il faudrait analyser une ligne de
  commande pour savoir quels fichiers elle écrira — indécidable en général, et
  un garde qui se trompe est pire que pas de garde ;
- **ne rien faire de plus** : le message dit désormais sa portée, ce qui suffit
  peut-être ;
- **déplacer le contrôle là où il est décidable** — un contrôle CI qui compare
  les migrations versionnées du diff à celles de `main` et échoue si une
  migration **déjà présente dans `main`** a changé. Il ne dépend d'aucun outil,
  voit toutes les écritures quel qu'en soit l'auteur, et la règle 13 lui donne
  son exception : tant qu'aucune base de production n'existe, il **avertit** ;
  après, il bloque.

À trancher en faisant. Ce qui n'est pas négociable, c'est que le trou soit écrit
quelque part que quelqu'un relira.

## 2. Des tests pgTAP affirment des comptes globaux

`booking_test.sql` affirme « Julie n'a **aucune** réservation ». C'est une
affirmation sur le **seed** autant que sur `book_class()`, et elle a rendu deux
tests rouges le jour où une fixture a inscrit Julie quelque part (P1-003b,
5 septembre 2026, trouvé en une exécution).

Le défaut n'est pas la fixture, c'est l'assertion : ce que le test veut prouver
est « **cet appel refusé** n'a rien écrit », pas « cette personne n'a jamais rien
réservé ». La première se borne au cours ou à la clé d'idempotence de l'appel ;
la seconde parle de tout le dépôt.

- **Recenser** les assertions de ce genre — `count(*)` sur une table métier sans
  borne autre qu'une appartenance ;
- **les borner** à ce que l'appel testé a fait : `class_id`, ou
  `idempotency_key`, qui est unique à la tentative ;
- **ne pas les supprimer** : elles attrapent quelque chose de réel, elles le
  disent seulement trop largement.

Le commentaire déjà posé dans `supabase/seed.sql` prévient la prochaine fixture.
Il ne corrige pas les tests, et c'est pour ça que ce ticket existe.

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| Un contrôle de migrations qui voit toutes les écritures | la CI | celui-ci |
| Des assertions pgTAP bornées à l'appel testé | toute fixture future | celui-ci |

## Hors périmètre

Réécrire le garde en analyseur de lignes de commande. Et toute réorganisation
des tests au-delà des assertions visées : le reste de `booking_test.sql` est bon.

## Critères d'acceptation

- [x] Une migration déjà présente dans `main` qui change dans un diff est
      **signalée**, quel que soit l'outil qui l'a écrite — y compris un script
      Bash. `scripts/migrations-immuables.mjs`, en CI et lançable à la main.
      Contrôle négatif joué le 8 septembre 2026, et **la modification a été faite
      par `echo >>` en Bash** : exactement le chemin que le hook ne voit pas. Le
      signalement nomme le fichier ; le décor a été annulé ensuite
- [x] La bascule de la règle 13 est dans ce contrôle : avertissement tant
      qu'aucune base de production n'existe, blocage après. **Les deux moitiés
      sont prouvées** — constante à `false`, code de sortie `0` avec le message
      d'avertissement ; à `true`, code de sortie `1` et « BLOQUÉ ». Le mode est
      imprimé à chaque exécution, y compris quand il n'y a rien à signaler
- [x] Aucune assertion pgTAP ne compte des lignes sur la seule base d'une
      appartenance. **Vérifié en ajoutant une fixture bidon au seed : 437 tests
      verts.** La recension est plus bas
- [x] Le trou du hook est écrit là où on le relira — le message du hook nomme
      désormais son complément, et `.claude/rules/database.md` porte les deux

## Ce que la fixture bidon a trouvé, et la méthode qui l'a trouvé

**Lire les 107 assertions de comptage une à une aurait été long et peu fiable.**
Le critère du ticket est lui-même la meilleure méthode : on ajoute du bruit au
décor, et on regarde qui rougit. Trois bruits, appliqués **un par un** — c'est
ce qui distingue une assertion trop large d'un test dont le sujet a réellement
changé :

| Bruit ajouté au seed | Test rouge | Nature |
| --- | --- | --- |
| Julie réserve un cours de Rueil | `booking_test` « ni aucune réservation fantôme » | ❌ **trop large** — comptait *toutes* les réservations de Julie |
| idem | `booking_test` « la première réservation à venir passe » | ⚠️ **autre nature** — le test *suppose* que Julie part de zéro |
| Un type de cours de plus chez Rueil | `box_settings` « un MEMBER lit le catalogue » | ❌ **trop large** — comptait tout le catalogue de la box |
| Un consentement de plus pour Léa | `append_only` « la preuve est toujours là » | ❌ **trop large** — comptait la table entière |

**La deuxième ligne est la plus instructive.** Ce n'est pas une assertion trop
large : c'est un bloc qui pose `max_upcoming_bookings = 1` en supposant que Julie
n'a aucune réservation à venir. Une fixture qui l'inscrit ailleurs fait alors
échouer **la première** réservation — celle qui doit passer — et le test rougit
en accusant la règle qu'il vérifie. Le correctif n'est pas de borner un compte,
c'est de **calculer le plafond depuis son état réel** : `1 + ce qu'elle a`. Il
prouve exactement la même chose sans rien supposer.

Les trois autres sont bornées à ce que l'appel testé a fait : le cours refusé,
les trois types du seed nommés par leur identifiant, et l'état des consentements
de Léa mesuré **avant** les deux ordres refusés plutôt que supposé.

**Et le compte de la table est remplacé par deux assertions, pas une.**
`count(*) from consents = 2` prétendait couvrir un `delete` et un `update`
refusés d'un seul chiffre. Ce sont deux propriétés différentes : rien n'a été
effacé, rien n'a été réécrit. Séparées, elles disent laquelle a cédé.

## Ce qui n'a pas été touché, et pourquoi

Deux familles ressemblent au défaut sans en être :

- **`class_roster_test`, `role_isolation_test`** — `count(*)` sans borne, mais
  sous un rôle dont la RLS **est** la borne, et dont la valeur attendue est zéro.
  « Un membre de Nanterre ne lit aucune feuille de Rueil » : le compte global est
  le sujet, pas un effet de bord du seed ;
- **`audit_trail_test`** — `count(*) from audit_logs where diff ~ '<empreinte>'`
  = 0. Volontairement global : la question est « nulle part dans le journal », et
  la borner la viderait de son sens.

Les distinguer demandait de savoir ce que chaque assertion **veut dire**. C'est
la raison pour laquelle ce ticket ne pouvait pas être un `sed`.

## Notes

**Pourquoi 0,5 j·h et pas plus.** Les deux corrections sont petites ; ce qui
prend du temps est de décider laquelle des trois issues du point 1 est la bonne,
et ça se décide en essayant la troisième pendant vingt minutes.

**Pourquoi ce ticket existe alors que les deux trous sont déjà commentés.** Un
commentaire dans un seed prévient qui l'ouvre ; un message de commit ne prévient
personne. Les deux points ci-dessus étaient dans cet état, et c'est exactement la
forme des quatre cas qui ont établi la règle 7 : quelque chose de connu, écrit
nulle part où on le relira.
