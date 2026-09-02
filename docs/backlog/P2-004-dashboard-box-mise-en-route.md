# P2-004 — Dashboard box et mise en route

**Phase** P2 · **Estimation** 4 j·h · **Dépend de** P1-001b, P1-001c, P1-003 · **Spec** §6.2, §12.5

## Pourquoi ce ticket existe

Il recueille **deux critères orphelins** de P1-001, qui pointaient vers un écran
lui-même orphelin — le mot « dashboard » n'apparaissait dans aucun ticket du
backlog, alors que la spec §6.2 en fait le premier écran du back-office.

- « Une box se configure entièrement en moins de 45 minutes sans aide »
- « Une checklist de mise en route persiste sur le dashboard avec son taux de
  complétion »

## Pourquoi en P2, et pas avant le pilote

L'assistant en cinq étapes sert la **vente en self-service** : il remplace la
personne qui accompagne. Au pilote, cette personne est la développeuse, assise à
côté du propriétaire. Même raisonnement que pour P2-002 (droits RGPD en
self-service) : l'obligation est réelle, le préalable ne l'est pas.

Ce qui suppose que les réglages soient atteignables **sans** assistant — c'est
exactement ce que P1-001b livre : un écran à cinq sections, pas un tunnel.

## Ce ticket porte le seul appelant manquant de `create_tenant()`

`create_tenant()` existe depuis P0-004, avec son quota, ses tests et ses gardes.
**Aucun écran ne l'appelle** : une box ne se crée aujourd'hui qu'en SQL. C'est le
quatrième cas du motif que `CLAUDE.md` §7 nomme désormais — une fonction sans
appelant n'est pas « faite », elle est en attente.

L'écran de création de box appartient à ce ticket : c'est la première étape de la
mise en route, avant les cinq autres.

## Ce que ce ticket suppose et qui doit exister

Section ajoutée le 2 septembre 2026 (règle 8 de `CLAUDE.md`), rétroactivement.
Ce ticket en avait plus besoin que les autres : **son KPI le plus vendeur
n'avait aucune source de données.**

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `create_tenant()`, avec son quota et ses gardes | P0-004 | ✅ existe, **sans aucun appelant** depuis P0-004. Ce ticket est celui qui la rend « faite » |
| Écran de réglages en cinq sections | P1-001b | ✅ existe — l'assistant les enchaîne, il ne les réécrit pas |
| `locations`, `rooms`, `class_types`, `opening_hours` | P1-001b | ✅ existent — la checklist se dérive de leur **présence réelle**, pas d'un drapeau |
| Invitations et annuaire des membres | P1-001c, D-001 | ✅ existent |
| Marque de la box | P1-001e | ✅ existe |
| **`classes` et `bookings`** (« taux de remplissage ») | P1-002, P1-003 | ❌ **à créer par P1-002 et P1-003** |
| **`checkins`** (« présences ») | P1-008 | ❌ **à créer par P1-008.** Sans lui, « présences » voudrait dire « réservations » — ce n'est pas la même chose et il ne faut pas l'étiqueter ainsi |
| **`ledger_entries` avec des écritures** (« CA du mois ») | table depuis P0-004, écrivains depuis P2-006 | ❌ **c'était le trou.** Le KPI le plus vendeur de l'écran n'avait aucune source, et le ticket ne le disait pas. `revenue_report()` est livré par **P2-016** — d'où l'ordre P2-004 → P2-016, et un état vide honnête tant que P2-016 n'est pas là |
| **Un composant graphique** (« graphique 30 jours ») | `packages/ui` | ❌ **à créer, ou à éviter.** Même arbitrage qu'en P2-016 : un tableau juste vaut mieux qu'une courbe approximative, et ajouter une bibliothèque de graphiques se justifie dans le message de commit |
| Tests de rendu des composants | D-002 (dette ouverte) | ⚠️ **absente** |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| L'écran de création de box | la personne qui s'inscrit | celui-ci — **c'est l'appelant manquant de `create_tenant()`**, nommé par la règle 7 |
| La checklist dérivée de l'état réel | le dashboard | celui-ci |
| Le bloc « CA du mois » | — | il **consomme** `revenue_report()`, livré par **P2-016** |

## Périmètre

- Box Dashboard : KPI (CA, membres actifs, taux de remplissage, churn), alertes,
  graphique 30 jours.
- Checklist de mise en route, **dérivée de l'état réel** (des salles ? des types
  de cours ? des horaires ? un plan tarifaire ? un premier membre ?) plutôt que
  stockée — un drapeau `onboarding_step` se désynchronise le jour où quelqu'un
  supprime la donnée qu'il prétendait valider.
- **Création de la box** (`create_tenant()`), première étape de l'assistant.
- Assistant en cinq étapes qui enchaîne les sections de l'écran Réglages :
  infos, horaires, salles, types de cours, règles de réservation.

## Critères d'acceptation

- [ ] Une box se configure entièrement en moins de 45 minutes sans aide
- [ ] La checklist reflète l'état réel de la base, y compris après suppression
      d'une donnée déjà cochée
- [ ] Le dashboard ne montre aucun KPI faux quand la box n'a encore rien : un
      état vide qui explique quoi faire, pas des zéros
