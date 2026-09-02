# P2-008 — Impayés, relances et suspension des droits

**Phase** P2 · **Estimation** 5 j·h · **Dépend de** P2-006, P2-007, P2-015 · **Spec** §4-P4 (RM4.6), §7.5

## Objectif

Un prélèvement échoue. Le membre est prévenu, il peut mettre à jour sa carte, et
il **garde ses droits jusqu'à la troisième tentative**. La box voit ses impayés
et relance en un clic.

RM4.6 tient en une phrase : « la suspension ne survient qu'après la 3ᵉ tentative
et une notification claire, **jamais silencieusement** ». Tout ce ticket sert à
tenir cette phrase.

## Pourquoi ce n'est pas dans P2-006

P2-006 enregistre `invoice.payment_failed` et affiche une bannière. Il s'arrête
là volontairement : orchestrer trois relances, un compteur de tentatives et une
suspension réversible pendant qu'on branche la souscription, c'est empiler deux
machines à états dans une seule session. Celle-ci est la seule qui **retire**
quelque chose à quelqu'un — elle mérite d'être relue seule.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `subscriptions`, `invoice.payment_failed`, `write_ledger()` | P2-006 | ❌ **à créer par P2-006** |
| `member_has_booking_right()` | P2-006 | ❌ **à créer par P2-006** — la suspension s'y branche, elle ne crée pas un second contrôle |
| **Canal e-mail** | P2-015 | ❌ **à créer par P2-015.** Bloquant réel : une relance de paiement par push seul n'est pas une relance. Le membre a désinstallé l'app, c'est souvent pourquoi il ne paie plus |
| Canal push | P1-007 | ❌ **à créer par P1-007** — catégorie « paiement en échec » déjà prévue dans son périmètre |
| `memberships.status` et ses transitions | `..._identity_and_tenancy.sql` | ✅ existe — vérifier qu'un statut `SUSPENDED` y figure, sinon l'ajouter ici |
| `audit_logs` + `log_audit()` | P0-004, écrits depuis P1-001c | ✅ existe |
| Écran back-office où lister les impayés | `apps/web` | ❌ à créer ici — section de l'écran membres, pas un écran de plus |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `suspend_for_unpaid()` / `restore_after_payment()` | le webhook Stripe | celui-ci |
| Le compteur de tentatives | `member_has_booking_right()` | celui-ci **modifie** la fonction de P2-006 |
| La vue des impayés | l'écran membres du back-office | celui-ci |

## Périmètre

- Compteur de tentatives par abonnement : incrémenté par
  `invoice.payment_failed`, **remis à zéro par `invoice.paid`**. Stripe porte
  déjà `attempt_count` — on le lit, on ne le recalcule pas.
- Calendrier de relance J+1 / J+3 / J+5 : **c'est Stripe qui l'exécute**
  (Smart Retries, configuré côté tableau de bord). Le produit y greffe ses
  messages, il ne réimplémente pas un ordonnanceur. Une file de relances maison
  serait exactement le « service séparé avant un problème mesuré » que
  `CLAUDE.md` interdit.
- Notification à chaque échec : e-mail **et** push, avec un lien de mise à jour
  du moyen de paiement (portail Stripe hébergé du compte connecté).
- Suspension au troisième échec : `memberships.status = 'SUSPENDED'`, écriture
  au journal d'audit, notification qui dit ce qui se passe et comment sortir.
  **Les réservations déjà posées sont honorées** — on ne fait pas rentrer
  quelqu'un dans le cours et sortir un autre pour une carte expirée.
- Rétablissement automatique sur `invoice.paid` : statut restauré, audit écrit.
- Back-office : liste des impayés, montant, nombre de tentatives, date de
  suspension prévue, bouton « relancer » (déclenche un `invoice.pay` Stripe).
- Remboursement en monnaie par l'OWNER (`POST /v1/payments/{id}/refund`) :
  `charge.refunded` produit la **contre-écriture** au ledger. C'est le seul
  endroit du produit où de l'argent ressort.

## Hors périmètre

- Frais de retard, pénalités, recouvrement. Sujet juridique, pas technique.
- Frais de no-show (S5, P3), qui est une autre façon de facturer un membre et
  mérite son propre débat avec les propriétaires.
- Prélèvement SEPA et gestion des mandats (C7, v2).

## Critères d'acceptation

- [ ] Premier échec : e-mail + push + bannière, **droits intacts**
- [ ] Deuxième échec : idem, droits toujours intacts
- [ ] Troisième échec : suspension, notification explicite, ligne d'audit
- [ ] Un paiement réussi après suspension rétablit les droits **sans geste
      manuel**, et écrit l'audit
- [ ] Un membre suspendu **conserve** ses réservations déjà confirmées
- [ ] Un membre suspendu ne peut pas réserver, et voit « régularise ton
      paiement » avec le lien — jamais une erreur brute (RM2.7)
- [ ] Un remboursement produit une contre-écriture ; aucune ligne du ledger n'a
      été modifiée (test append-only)
- [ ] Rejouer `invoice.payment_failed` n'incrémente pas deux fois le compteur

## Notes

**Le pire scénario de ce ticket n'est pas de suspendre à tort, c'est de
suspendre en silence.** Une box qui découvre qu'un membre fidèle ne pouvait plus
réserver depuis deux semaines perd le membre et la confiance dans l'outil. Chaque
transition de statut envoie quelque chose à quelqu'un, sans exception.

`money-reviewer` avant commit.
