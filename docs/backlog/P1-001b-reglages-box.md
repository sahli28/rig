# P1-001b — Réglages de la box : types de cours, horaires, salles, règles

**Phase** P1 · **Estimation** 3 j·h · **Dépend de** P1-001a · **Spec** §6.2 (Box Settings), §7.3

## Objectif

Remplir `/box/[slug]/reglages`, qui affiche « bientôt disponible » depuis
P1-001a. C'est le **premier écran du produit qui écrit en base** depuis le socle.

Deux constats l'ont ouvert :

- `class_types` n'existe pas, alors que la spec §7.3 fait pointer
  `classes.class_type_id` dessus. P1-002 ne peut pas commencer sans.
- Rien ne stocke les horaires d'ouverture, dont P1-002 aura également besoin
  pour générer le planning récurrent.

## Périmètre

- Tables `class_types` et `opening_hours`, avec policies, droits de table et
  tests pgTAP — la liste complète de `.claude/rules/database.md`.
- Colonne `tenants.default_locale`, exposée par `me()`.
- Écran Réglages en cinq sections : identité, horaires d'ouverture, salles et
  adresses, règles de réservation, types de cours.
- Schémas Zod partagés et fonctions pures dans `packages/core`.

## Décision — la frontière OWNER / MANAGER se coupe par table

C'est la **troisième fois** que cette frontière se pose, et
`20260831095131_restrict_tenant_update_to_owner.sql` l'avait annoncée
textuellement : « à reconsidérer si un gestionnaire doit un jour éditer le nom ou
le fuseau ». Ce jour est arrivé avec cet écran. La réponse est non.

| Table | Qui écrit | Contenu |
| --- | --- | --- |
| `tenants` | **OWNER seul** | identité : nom, slug, fuseau, devise, langue par défaut |
| `tenant_settings`, `opening_hours`, `locations`, `rooms`, `class_types` | OWNER **et** MANAGER | l'opérationnel |

L'alternative était le droit au niveau colonne — `revoke update on tenants;
grant update (name, timezone)` — le bon outil Postgres pour borner des colonnes,
mais une surface à maintenir à chaque colonne ajoutée, et une seconde règle
d'autorisation à côté de la policy. Couper par table ne coûte rien : les réglages
qu'un gestionnaire doit réellement toucher vivent déjà dans une table où il écrit.

À l'écran, le bloc « identité » est en **lecture seule avec une phrase qui
l'explique** pour un gestionnaire, jamais un champ grisé sans raison.

## Décision — `opening_hours` est une table, pas un `jsonb`

Ces horaires ont un **consommateur SQL**, pas seulement un formulaire : P1-002
génère le planning récurrent à partir d'eux, l'open gym et le check-in les liront
ensuite. Une donnée qu'une fonction PLpgSQL doit joindre et contrôler dans une
transaction ne va pas dans un `jsonb`.

Trois précisions qui vivent dans la migration, parce qu'aucun test ne les
produira :

1. **`time` nu, jamais `timetz`**, interprété dans `tenants.timezone`. `timetz`
   porte un décalage fixe, pas un fuseau : il se trompe à chaque changement
   d'heure. Sans la mention, quelqu'un convertira ces heures en UTC en croyant
   bien faire, et la box ouvrira à 7 h en hiver et 8 h en été.
2. **Les dérogations datées sont nommées, pas construites.** « Fermé le
   25 décembre », « horaires d'août » : ce sera une table `opening_exceptions`,
   jamais une colonne `date` bricolée dans celle-ci.
3. **Le chevauchement de deux créneaux le même jour n'est pas garanti par la
   base.** L'empêcher demanderait `btree_gist` et un type intervalle sur des
   `time` que PostgreSQL ne fournit pas — un type maison pour une box qui a deux
   lignes par jour. La validation est côté Zod, et la limite est **écrite**
   plutôt que prétendue. Exception assumée à l'habitude du projet : ici la base
   ne peut pas tout tenir à un prix raisonnable, et le dire vaut mieux que le
   laisser croire.

## Décision — `default_locale` va sur `tenants`

`themes` porte la **marque** (`app_name`, `logo_url`, `primary_color`, `radius`,
`font`). La langue par défaut de la box est de même nature que `timezone` et
`currency`, déjà sur `tenants` : elle va à côté d'elles.

Elle est exposée par `me()` dans la foulée. Un champ éditable que personne ne lit
est exactement la moitié de chemin que ce projet passe son temps à rattraper. Son
premier consommateur réel sera la langue des notifications (P1-007) et celle des
pages publiques (D-003).

## Critères d'acceptation

- [x] Un OWNER modifie nom, fuseau, devise et langue par défaut de sa box ; un
      MANAGER lit ces champs et voit pourquoi il ne peut pas les modifier
- [x] Un MANAGER modifie horaires, salles, règles de réservation et types de cours
- [x] Un MEMBER n'atteint pas l'écran (garde de rôle de la coquille)
- [x] Un `class_type` ou un créneau créé avec le `tenant_id` d'une autre box est
      refusé par la base, pas seulement par l'écran
- [x] Deux créneaux qui se chevauchent le même jour sont refusés avec un message
- [x] Changer le slug redirige vers la nouvelle URL ; un slug déjà pris ressort
      traduit, pas en erreur brute
- [x] La devise ne peut plus changer dès qu'une écriture comptable existe
- [x] `pnpm test:db` vert, y compris le test anti-fuite sur les deux tables

## Ce que le ticket ne contient pas

Branding (P1-001e), assistant de mise en route et dashboard (P2-004), staff et
invitations (P1-001c), import CSV (P1-001d), planning et `classes` (P1-002).

**Si le ticket commence à parler de `classes` ou de RRULE, il a débordé.**
