# P2-007 — Packs de crédits et portefeuille

**Phase** P2 · **Estimation** 6 j·h · **Dépend de** P2-006, P1-003, P1-004 · **Spec** §2.2 (M10), §4-P4 (RM4.3, RM4.4), §7.3

## Objectif

Un membre achète un pack de 10 séances, le solde se débite **dans la transaction
de réservation** et se recrédite **dans la transaction d'annulation**. Jamais
ailleurs, jamais en TypeScript.

La spec dit que les litiges de crédits sont la première source de tickets support
(M10). Ce n'est pas un problème de fonctionnalité, c'est un problème de
**traçabilité** : quelqu'un doit pouvoir répondre « voilà les onze mouvements de
votre portefeuille, avec leur cause ». C'est ce que ce ticket construit.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `plans` de type `CREDIT_PACK` | P2-005 | ❌ **à créer par P2-005** |
| Paiement à l'unité et `write_ledger()` | P2-006 | ❌ **à créer par P2-006** |
| **La fonction de réservation, avec son `SELECT … FOR UPDATE`** | P1-003 | ❌ **à créer par P1-003.** Ce ticket **modifie** cette fonction : le débit s'insère dans son verrou, il n'ouvre pas une seconde transaction |
| **La fonction d'annulation et sa fenêtre** | P1-004 | ❌ **à créer par P1-004.** Le remboursement dépend du côté de la fenêtre où l'on se trouve (RM2.4) |
| `pg_cron` pour l'expiration et les rappels J-14 / J-3 | `supabase/config.toml` | ⚠️ **prévu par P1-002** pour la matérialisation des occurrences. Si P1-002 ne l'a pas activé, ce ticket le fait — à vérifier avant de chiffrer |
| Canal push pour les rappels d'expiration | P1-007 | ❌ **à créer par P1-007** (avant le jalon pilote) |
| Canal e-mail pour les mêmes rappels | P2-015 | ❌ **à créer par P2-015** — RM4.3 exige de prévenir, pas de « notifier si l'app est installée » |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `debit_credit()` / `refund_credit()` | `book_class()` et `cancel_booking()` | **celui-ci les y insère** — pas de fonction orpheline |
| `credit_wallets`, `credit_transactions` | l'écran « Mon portefeuille », l'ajustement manuel OWNER | celui-ci |
| `expire_credits()` | job `pg_cron` quotidien | celui-ci |

## Périmètre

- `credit_wallets` : `tenant_id`, `membership_id` (unique), `balance int`,
  `updated_at`. Un portefeuille **par box** : les crédits d'une box ne
  s'utilisent pas ailleurs, et le contraire serait un cauchemar de règlement.
- `credit_transactions` : `wallet_id`, `delta int` (signé), `reason`
  (`PURCHASE` | `BOOKING` | `CANCELLATION` | `EXPIRY` | `MANUAL_ADJUSTMENT` |
  `REFUND`), `booking_id`, `expires_at`, `actor_membership_id`, `created_at`.
  **Append-only, comme le ledger** : trigger interdisant `UPDATE` et `DELETE`.
- `balance` est un **cache dénormalisé**, et il est vérifiable : un test pgTAP
  compare `balance` à `sum(delta)` sur chaque portefeuille. C'est la seule façon
  de savoir qu'un chemin d'écriture a été oublié.
- Achat d'un pack : `payment_intent.succeeded` sur le compte connecté crédite le
  portefeuille et écrit au ledger, dans la même transaction.
- **Débit à la réservation, à l'intérieur du verrou de `book_class()`.** Pas
  d'appel séparé, pas de « on débite après ». Si l'insertion de la réservation
  échoue, le débit n'a jamais eu lieu.
- **Remboursement à l'annulation, selon la fenêtre** (RM2.4) : avant, le crédit
  revient ; après, il est consommé. En portefeuille, jamais en monnaie (RM4.4).
- Expiration : `credit_validity_days` du pack pose `expires_at` sur la ligne
  d'achat. Job quotidien, consommation **FIFO par date d'expiration** — on brûle
  d'abord ce qui périme le plus tôt, sinon on fait perdre des séances au membre.
- Rappels J-14 et J-3 (RM4.3), push **et** e-mail.
- Ajustement manuel par l'OWNER (`POST /v1/members/{id}/credits`), avec motif
  obligatoire et écriture au journal d'audit.

## Le piège qui fera perdre une demi-journée

**Le solde n'est pas un nombre, c'est une pile datée.** Un membre avec 3 crédits
qui périment le 15 et 10 qui périment en mars n'a pas « 13 crédits ». Toute
implémentation qui traite `balance` comme un entier suffisant échoue à
l'expiration : on ne sait plus lesquels retirer.

La consommation lit donc les lignes de crédit non épuisées par `expires_at`
croissant. `balance` reste, comme cache d'affichage et comme contrôle.

## Hors périmètre

- Transférer des crédits entre membres, ou entre boxes. Le second est un sujet de
  réseau inter-box (S8, P3).
- Rembourser en monnaie : geste explicite du propriétaire, via Stripe, dans
  P2-008.
- Frais de no-show débités du portefeuille (S5, P3) — RM3.4 y renvoie, on ne le
  fait pas ici.

## Critères d'acceptation

- [ ] Acheter un pack de 10 crédite 10, une seule fois, même si le webhook est
      rejoué
- [ ] Réserver débite 1 **dans la même transaction** ; si la réservation échoue
      (cours plein), le solde est inchangé
- [ ] Annuler avant la fenêtre restitue 1 ; après, ne restitue rien
- [ ] Deux réservations simultanées avec 1 crédit restant : **une seule passe**,
      solde final 0 — test de concurrence, pas un test séquentiel
- [ ] `balance = sum(delta)` sur tous les portefeuilles, après un scénario
      complet achat / résa / annulation / expiration
- [ ] Un pack expiré ne réserve plus, et le membre voit « expiré », pas « solde
      insuffisant »
- [ ] Un `UPDATE` sur `credit_transactions` lève
- [ ] Un OWNER crédite manuellement 2 séances avec motif ; la ligne d'audit
      existe et ne contient **ni e-mail ni jeton**

## Notes

C'est le ticket où l'on touche `book_class()` après coup. Relire son test de
concurrence **avant** de la modifier : s'il ne couvrait que la capacité, il faut
le doubler pour le solde.

`money-reviewer` et `rls-auditor` avant commit.
