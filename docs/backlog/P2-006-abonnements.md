# P2-006 — Abonnements : la première fois que de l'argent entre

**Phase** P2 · **Estimation** 7 j·h · **Dépend de** P2-005, P1-003 · **Spec** §4-P4 (RM4.1, RM4.2, RM4.5, RM4.7, RM4.8), §7.3

## Objectif

Un membre souscrit, paie par Payment Sheet, et **ses droits de réservation
s'ouvrent quand le webhook le dit** — pas quand l'app revient de Stripe.

C'est le ticket le plus dangereux du backlog. Pas le plus long : le plus
dangereux. Une erreur ici se voit sur un relevé bancaire.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| Compte connecté opérationnel, `tenant_can_sell()` | P2-001 | ❌ **à créer par P2-001** |
| Couche webhook signée et dédupliquée | P2-001 | ❌ **à créer par P2-001** — sans elle, ce ticket la construirait sous pression |
| `plans` avec `stripe_price_id` | P2-005 | ❌ **à créer par P2-005** |
| `ledger_entries` append-only | `..._compliance_and_ledger.sql` | ✅ existe depuis P0-004, **sans aucun écrivain**. Ce ticket est le premier — règle 7 de `CLAUDE.md`, cinquième occurrence |
| **La fonction de réservation, pour y brancher le contrôle de droits** | P1-003 | ❌ **à créer par P1-003.** C'est le prérequis qui décide de l'ordre : ce ticket **doit** venir après, sinon il écrit un contrôle qui ne s'insère nulle part |
| `@stripe/stripe-react-native` (Payment Sheet mobile) | `apps/mobile` | ❌ dépendance à ajouter, à justifier |
| `@stripe/stripe-js` + Elements, si l'achat existe aussi sur le web | `apps/web` | ⚠️ **à trancher dans le plan.** Un membre achète depuis le mobile ; le web sert le staff. Faire les deux double la surface de test pour un usage non démontré |
| **Un canal e-mail** pour la facture et l'échec de paiement | — | ❌ **à créer par P2-015.** La spec §4-P4 exige « facture PDF par e-mail » : sans P2-015, ce critère n'est pas tenable |
| Fenêtre de réservation, statut du membre | `tenant_settings` (P1-001b) | ✅ existe |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `subscriptions` + machine à états | l'écran « Ma formule », le contrôle de droits | celui-ci |
| `member_has_booking_right(membership, at)` | la réservation | **P1-003 doit l'appeler** — si P1-003 est déjà fusionné, ce ticket modifie sa fonction, et son test |
| `write_ledger()` — la porte d'écriture unique du ledger | abonnements, packs, remboursements, dunning | celui-ci, puis P2-007, P2-008 |
| `invoice.paid`, `invoice.payment_failed`, `customer.subscription.*` | Stripe | celui-ci |

## Périmètre

- Table `subscriptions` : `tenant_id`, `membership_id`, `plan_id`,
  `stripe_subscription_id`, `status`, `current_period_end`, `cancel_at`,
  `created_at`. Index `(status, current_period_end)`.
- Souscription : Server Action idempotente (`Idempotency-Key`, règle 4), création
  du `Customer` **sur le compte connecté**, `client_secret` retourné au client,
  Payment Sheet côté mobile.
- **Les droits ne s'activent que sur `invoice.paid`** (RM4.8). Le retour client
  affiche « on attend la confirmation », jamais « c'est bon ».
- `write_ledger()` : la seule fonction autorisée à insérer dans
  `ledger_entries`. Deux écritures par facture — l'encaissement de la box et la
  commission de la plateforme — pour que le rapprochement de P2-016 soit
  possible sans reconstituer quoi que ce soit.
- `member_has_booking_right()` : abonnement actif dont `current_period_end`
  couvre **la date du cours** (RM2.8), ou portefeuille suffisant (P2-007), ou
  drop-in. Une seule fonction, appelée par la réservation, testée en pgTAP.
- Résiliation en self-service : `cancel_at_period_end`, avec la date de fin de
  droits affichée en toutes lettres (RM4.5 et §12).
- Écran membre « Ma formule » : formule, prochaine échéance, bouton de
  résiliation, historique de factures (liens Stripe hébergés — **on ne génère pas
  de PDF**).

### Ce que `interval_count` change ici, et qui n'est pas rien

P2-005 a été amendé le 5 septembre 2026 : une formule porte `interval` **et**
`interval_count`, parce qu'une box vend des illimités de 1, 3 ou 6 mois. Trois
conséquences, toutes sur cet écran plutôt que sur le modèle :

1. **`current_period_end` ne bouge pas de forme, mais change d'ordre de
   grandeur.** Il vient de l'objet Stripe et reste la borne des droits ; ce qui
   change est qu'il peut être à six mois. Toute phrase du type « jusqu'à la fin
   du mois » devient fausse : la date s'affiche **en toutes lettres**, ce que
   RM4.5 demandait déjà et qui cesse d'être une préférence de style ;
2. **« résilier à échéance » peut laisser six mois de droits.** C'est correct —
   la période est payée — mais c'est surprenant si l'écran ne le dit pas.
   Le bouton doit annoncer la conséquence **avant** le clic : « ton abonnement
   s'arrête le 4 mars 2027 ; tu réserves jusque-là. » Une confirmation qui
   n'énonce pas la date laisse croire à une coupure immédiate ;
3. **la « prochaine échéance » n'est pas la « prochaine facture » pour un
   trimestriel** — c'est la même date, mais l'intuition du membre est mensuelle.
   Le libellé porte la périodicité : « 267 € tous les 3 mois · prochaine
   échéance le 4 mars ».

**Ce qui ne change pas** : `member_has_booking_right()` compare toujours
`current_period_end` à la date du cours. Une période plus longue ne demande
aucune arithmétique de calendrier de notre côté — Stripe la calcule, nous la
lisons. C'est précisément ce que la forme Stripe achète.

## Ce qui n'est pas négociable

1. **Le webhook fait foi.** Le retour de Payment Sheet est une information
   d'interface, pas un fait comptable.
2. **`ledger_entries` reste append-only.** Un remboursement est une
   contre-écriture, jamais un `UPDATE`. Les triggers de P0-004 l'imposent déjà —
   ce ticket est le premier à s'y heurter pour de vrai.
3. **Aucune donnée de carte ne traverse le produit.** Payment Sheet et Elements,
   rien d'autre. Un champ carte codé à la main est un bug bloquant.
4. **Une souscription est idempotente.** Un double tap ne crée pas deux
   abonnements. Le test le vérifie en rejouant la même clé.

## Hors périmètre

- Packs de crédits et portefeuille (P2-007) — même écran de catalogue, autre
  machine à états.
- Dunning et suspension après trois échecs (P2-008). Ce ticket **enregistre**
  `invoice.payment_failed` et affiche une bannière ; il n'orchestre pas les
  relances.
- Reporting et rapprochement (P2-016).
- Facture PDF générée par nous : Stripe en héberge une, avec les mentions légales
  de la box. En produire une seconde serait s'exposer à ce qu'elles divergent.

## Critères d'acceptation

- [ ] Une souscription ouvre les droits **après** `invoice.paid`, et pas avant —
      vérifié en retardant volontairement le webhook
- [ ] Rejouer `invoice.paid` n'écrit pas deux fois dans le ledger
- [ ] Un double tap sur « Souscrire » ne crée qu'un abonnement (même
      `Idempotency-Key`)
- [ ] Une réservation est refusée si l'abonnement expire **avant la date du
      cours**, pas avant celle de la réservation (RM2.8) — test pgTAP
- [ ] Une résiliation affiche la date de fin de droits, et le membre réserve
      jusque-là
- [ ] **Sur un illimité 3 mois**, la résiliation à échéance annonce la date
      exacte **avant** le clic, et le membre réserve jusqu'à elle — le cas qui
      distingue « à la fin du mois » d'une vraie fin de période
- [ ] L'écran « Ma formule » porte la périodicité : « tous les 3 mois », jamais
      un montant nu qu'on lira comme mensuel
- [ ] `invoice.payment_failed` affiche une bannière et **ne coupe rien** (RM4.6)
- [ ] La commission plateforme apparaît dans le ledger de la box, du bon signe
- [ ] Un `UPDATE` sur `ledger_entries` lève, y compris depuis cette fonction

## Notes

**Sur `apps/web` comme second parcours d'achat** : à trancher au plan, pas en
cours de route. La spec ne le demande pas ; le mobile suffit au critère de sortie
de la Phase 2. Si on le fait, c'est un ticket.

`money-reviewer` **et** `spec-keeper` avant tout commit. Les scénarios Gherkin de
la spec §4-P4 sont les critères, mot pour mot.
