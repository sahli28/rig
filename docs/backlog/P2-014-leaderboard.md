# P2-014 — Leaderboard par WOD

**Phase** P2 · **Estimation** 4 j·h · **Dépend de** P2-013 · **Spec** §2.2 (M15), §4-P5 (RM5.4), §7.5

## Objectif

Un membre voit où il se situe sur la séance du jour, filtré par niveau, sexe et
catégorie d'âge. « Moteur social et viral, coût faible une fois M14 fait » (M15) —
la seconde moitié de la phrase n'est vraie que si on ne se trompe pas de trois
façons, énumérées ci-dessous.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `scores` avec `level` non nul | P2-013 | ❌ **à créer par P2-013** |
| `movements.measured_by` (sens du classement) | P2-009 | ❌ **à créer par P2-009** |
| `users.gender`, `users.birthdate` | P0-004 | ✅ existent, **facultatifs** — voir le point 2 |
| Consentement d'affichage dans un classement | `consent_purpose` = `LEADERBOARD` (`..._compliance_and_ledger.sql:8`) | ✅ **la valeur existe depuis P0-004** — mais **aucun écran ne la recueille**. Le ticket qui l'écrit est P2-002 (RGPD self-service) ou celui-ci : à trancher au plan |
| Écran WOD du jour où loger l'onglet | P2-012 | ❌ **à créer par P2-012** |
| Pagination par curseur | convention §7.4 | ⚠️ aucun écran ne l'a encore implémentée ; premier usage réel |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `session_leaderboard(session, block, filtres)` | l'onglet classement, l'écran TV plus tard | celui-ci, puis C8 (v2) |

## Les trois façons de se tromper

**1. Mélanger les niveaux.** RM5.4 est absolue : un score Rx et un score Scaled
ne sont jamais dans le même classement. Pas « avec un badge » — jamais. Le filtre
de niveau n'est donc pas un filtre, c'est une **partition** : le classement se
demande toujours pour un niveau, et l'interface n'offre pas « tous ».

**2. Traiter le sexe et l'âge comme obligatoires.** RM1.5 les rend facultatifs, et
dit qu'on doit expliquer à l'utilisateur qu'ils conditionnent le classement
catégorisé. Un membre qui ne les renseigne pas apparaît au **classement général**
et disparaît des classements catégorisés — il n'est pas exclu, il n'est pas
rangé dans une catégorie par défaut, et il n'y a pas d'erreur à l'écran.

**3. Le mettre en cache dans une vue matérialisée.** Le test anti-fuite en
interdit **toute** (`rls_leak_test.sql`, contrôle 7), et son commentaire nomme
précisément ce cas : « un cache de leaderboard en `matview` est très plausible…
et c'est le pire cas de tous », parce qu'une matview ne porte aucune policy et
matérialise donc les lignes de toutes les boxes dans un objet non protégé.
Le classement est une fonction, filtrée par les policies. Si elle est lente, on
indexe ; on ne matérialise pas.

## Périmètre

- `session_leaderboard()` : classement d'un bloc d'une séance, ordonné selon
  `measured_by` (temps croissant, charge décroissante, reps décroissantes,
  distance décroissante).
- Filtres : niveau (**obligatoire**), sexe, tranche d'âge. Pagination par
  curseur.
- Exclusions : scores hors fenêtre (RM5.3), scores de membres n'ayant pas
  consenti à l'affichage, membres supprimés ou anonymisés (RGPD).
- Affichage : rang, prénom + initiale du nom — **jamais l'e-mail**, jamais le nom
  complet. C'est déjà la règle du partage inter-box (RM7.3), elle vaut a fortiori
  dans la box.
- Ma position mise en évidence, même hors de la page affichée.
- Index à poser en connaissance de cause : `(session_id, block_id, level,
  value_num)`. Mesurer avant d'en ajouter d'autres.

## Hors périmètre

- Classements Hyrox, segmentés par division **et** format (RM6.6, v2).
- Leaderboard d'événement en temps réel (P3).
- Classements inter-box (réseau, P3) : ils supposent des règles de partage de
  données personnelles qui n'existent pas encore.
- Écran TV de salle (C8, v2) — mais la fonction est écrite pour qu'il l'appelle.

## Critères d'acceptation

- [ ] Aucun classement ne mélange deux niveaux — test pgTAP, sur données réelles
- [ ] Le sens du tri est correct pour les quatre `measured_by`
- [ ] Un membre sans sexe ni date de naissance apparaît au général, dans aucune
      catégorie, et **sans message d'erreur**
- [ ] Un membre d'une autre box n'apparaît jamais, quelle que soit la requête
- [ ] Un membre anonymisé (RGPD) disparaît du classement
- [ ] `rls_leak_test.sql` reste vert : **aucune vue matérialisée n'a été créée**
- [ ] Le classement d'une séance à 60 participants rend en moins de 300 ms

## Notes

Ce ticket est le seul du produit où l'on affiche publiquement le résultat d'une
personne. Passer `spec-keeper` **et** relire `.claude/rules/privacy.md` : ce qui
est affiché à 60 membres est effectivement public.
