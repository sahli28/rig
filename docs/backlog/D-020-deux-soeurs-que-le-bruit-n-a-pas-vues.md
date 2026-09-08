# `D-020` — Deux sœurs que la fixture bidon n'a pas vues

**Phase** `dette` · **Estimation** `0,25` j·h · **Dépend de** `D-014` (fait) · **Origine** échec observé le 8 septembre 2026, pendant `D-019` · **Non bloquant**

## Objectif

L'affirmation de `D-014` redevient vraie : **aucune assertion pgTAP ne se casse
parce qu'une autre donnée existe.**

## Ce qui s'est passé, et pourquoi c'est gênant

`D-014` a corrigé quatre assertions et a coché ce critère :

> Aucune assertion pgTAP ne compte des lignes sur la seule base d'une
> appartenance. **Vérifié en ajoutant une fixture bidon au seed : 437 tests
> verts.**

**C'était vrai de cette fixture-là, et trop large comme affirmation.** Deux jours
plus tard, une simple session au harnais — se connecter en `lea@example.com`,
accepter les consentements, réserver — fait rougir deux tests que la fixture
n'avait pas touchés :

| Test | Assertion | Ce qu'elle suppose |
| --- | --- | --- |
| `cancellation_test.sql:328` | `MAX_UPCOMING_BOOKINGS_REACHED` levé au mauvais moment | que **Léa** part sans réservation à venir |
| `me_test.sql`, test 9 | « un consentement manquant est signalé » | que **Léa** n'a aucun consentement enregistré |

La première est **exactement** le défaut que `D-014` a corrigé dans
`booking_test.sql` — un plafond posé en dur qui suppose un état de départ — et
elle vit dans le fichier d'à côté. C'est la règle des sœurs prise en flagrant
délit **sur le ticket qui l'invoquait**.

## Pourquoi la fixture ne les a pas vues — et c'est la vraie leçon

La fixture de `D-014` ajoutait : une réservation pour **Julie**, un consentement
`MARKETING` pour **Léa**, un type de cours. Les deux assertions ci-dessus
portent sur les réservations **de Léa** et sur les consentements **que `me()`
réclame** — ni l'un ni l'autre n'était dans le bruit.

**Une fixture de bruit ne prouve que ce qu'elle touche.** Choisie à la main, elle
hérite des angles morts de celui qui l'écrit ; et le bruit le plus représentatif
n'est pas inventé, c'est **celui qu'une session réelle produit**.

> Et il y a pire, à écrire parce que c'est le genre de chose qu'on se cache :
> **le premier passage combiné de `D-014` avait montré `me_test` test 9 en
> rouge.** Il a été rangé dans « effets d'interaction, à ne pas chasser » au lieu
> d'être isolé comme les trois autres. Un rouge écarté sans être expliqué est un
> rouge qu'on reverra.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Les assertions à borner | `supabase/tests/cancellation_test.sql:328`, `supabase/tests/me_test.sql` (test 9) | ✅ existent, et **on a le rouge exact** |
| La forme du correctif | `booking_test.sql` — plafond calculé depuis l'état réel (`D-014`) | ✅ existe, à reprendre telle quelle |
| Un bruit plus représentatif | une session réelle : connexion, consentements, réservation | ✅ se produit toute seule à chaque passe au harnais |

## Périmètre

- **`cancellation_test.sql`** : le plafond se calcule depuis l'état réel du
  membre, comme dans `booking_test.sql`. Pas de borne à inventer, la forme
  existe.
- **`me_test.sql` test 9** : l'assertion doit poser son décor — un utilisateur
  **sans consentement**, créé ou nettoyé par le test — au lieu de compter sur
  celui du seed.
- **Rejouer le contrôle avec un bruit issu d'une session réelle**, pas d'une
  fixture écrite à la main. C'est la seule façon de ne pas refaire l'erreur
  d'angle mort.
- **Corriger l'affirmation de `D-014`** dans son ticket : elle a coché un
  critère plus large que ce qu'elle avait vérifié.

## Hors périmètre

Relire les 107 assertions. La méthode reste la bonne — ajouter du bruit et
regarder qui rougit — elle demande seulement un bruit qui ne vienne pas de la
même tête que les tests.

## Critères d'acceptation

- [ ] `cancellation_test.sql` et `me_test.sql` passent après une **session réelle
      au harnais** (connexion, consentements, réservation), sans `db:reset`
- [ ] Les deux corrections sont bornées à ce que l'appel testé fait, pas
      supprimées
- [ ] Le ticket `D-014` porte la correction de son affirmation, avec la raison —
      un critère coché trop large est un faux vert, et c'en était un

## Notes

**Pourquoi 0,25 et pas plus.** Les deux corrections sont connues et leur forme
est écrite. Ce qui prend le temps est de rejouer le contrôle proprement.

**Ce ticket ne rouvre pas `D-014`.** Le contrôle de migrations qu'il a livré est
bon et prouvé ; c'est le second volet, les assertions, qui était incomplet. Le
dire ici plutôt que d'y retoucher garde l'histoire lisible.
