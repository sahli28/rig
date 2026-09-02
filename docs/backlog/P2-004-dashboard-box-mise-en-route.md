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
