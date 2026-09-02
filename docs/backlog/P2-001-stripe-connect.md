# P2-001 — Stripe Connect Express, et la couche webhook

**Phase** P2 · **Estimation** 5 j·h · **Dépend de** P1-001b · **Spec** §4-P4 (RM4.1, RM4.2, RM4.8), §7.3, §7.5

## Objectif

Une box relie son compte Stripe depuis le back-office, et l'application **sait**
si elle peut encaisser. Aucune vente n'est possible tant que Stripe ne l'a pas
dit — pas parce qu'on l'a coché, parce que `charges_enabled` est vrai.

Ce ticket n'encaisse pas un centime. Il pose les deux choses sans lesquelles les
quatre suivants n'ont pas de sol : **le compte connecté** et **la couche
webhook**.

## Pourquoi le webhook vit ici, et pas dans le ticket qui vend

`account.updated` est le premier événement Stripe du produit, et c'est le plus
inoffensif : s'il se perd, une box voit un état d'onboarding périmé et recharge.
Le même bug sur `invoice.paid` fait perdre de l'argent à quelqu'un.

On construit donc la signature, la déduplication, le rejeu et l'observabilité
**sur l'événement où se tromper ne coûte rien**, et P2-006 hérite d'une
tuyauterie déjà éprouvée. L'inverse — poser la plomberie sous pression pendant
qu'on branche les abonnements — est la façon dont on se retrouve à déboguer un
double débit en production.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `tenants` avec `currency` et le verrou de changement de devise | `supabase/migrations/20260902...` et `..._forbid_currency_change_with_ledger.sql` | ✅ existe |
| `processed_webhook_events` | déjà dans `rls_leak_test.sql` (`tenant_id_exempt`, `policy_exempt`) | ⚠️ **la table est prévue par le test anti-fuite, mais non créée** — ce ticket la crée |
| `ledger_entries` | `..._compliance_and_ledger.sql` | ✅ existe, append-only, **aucun écrivain** — P2-006 sera le premier |
| Coquille du back-office et garde OWNER | `apps/web` (P1-001a, P1-001e) | ✅ existe |
| Écran de réglages où loger la section « Paiements » | `/box/[slug]/reglages` (P1-001b) | ✅ existe — on ajoute une section, on ne crée pas d'écran |
| **Compte Stripe de plateforme, Connect activé, clés test et live** | tableau de bord Stripe | ❌ **à créer par vous, hors code.** Délai d'activation Connect : quelques jours, vérification d'identité de la société. **Le lancer maintenant**, comme le compte Apple |
| **Entité juridique déclarée** (SIREN, IBAN de la plateforme) | — | ❌ Stripe le demande à l'activation de Connect. Rien à coder, tout à préparer |
| Un endpoint public capable de recevoir un POST non authentifié | `apps/web` route handler | ❌ à créer — **premier du produit**, ADR 0004 dit « pas de couche API », c'est l'exception à écrire |
| `svix` ou la vérification de signature native du SDK Stripe | — | ❌ dépendance à ajouter, à justifier dans le commit |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `stripe_accounts` (1-1 avec `tenants`) | section « Paiements » des réglages | celui-ci |
| `tenant_can_sell()` — `charges_enabled` **et** `payouts_enabled` | le catalogue de formules, la souscription, l'achat de pack | P2-005, P2-006, P2-007 |
| `record_webhook_event()` — dédup atomique | tous les webhooks Stripe | celui-ci, puis P2-006, P2-007, P2-008 |
| Route `POST /api/stripe/webhook` | Stripe | celui-ci |

## Périmètre

- Table `stripe_accounts` : `tenant_id` (unique), `stripe_account_id`,
  `charges_enabled`, `payouts_enabled`, `details_submitted`,
  `requirements_due jsonb`, `updated_at`. RLS forcée, lecture OWNER seul —
  **un MANAGER ne voit pas les exigences de conformité du dirigeant**, elles
  contiennent des données d'identité.
- Table `processed_webhook_events` : `stripe_event_id` en clé primaire,
  `type`, `received_at`, `processed_at`, `payload jsonb`. Sans `tenant_id` et
  sans policy — les deux exceptions sont **déjà déclarées** dans
  `rls_leak_test.sql`, ce ticket ne fait que les honorer.
- Server Action OWNER : créer le compte connecté, produire un
  `account_link` d'onboarding, retour sur `/box/[slug]/reglages?stripe=…`.
- Route webhook : vérification de signature **avant toute lecture du corps**,
  déduplication par `stripe_event_id`, `200` immédiat, traitement idempotent.
- `account.updated` met à jour les trois drapeaux et les exigences en attente.
- Affichage : ce que Stripe attend encore de la box, en clair, avec le lien pour
  reprendre l'onboarding. Une liste de codes Stripe bruts n'est pas une réponse.
- `application_fee` : **le taux de commission est une constante de plateforme**,
  pas une colonne de `tenants`. Une commission par box est un sujet commercial,
  pas technique, et une colonne modifiable est une colonne qu'on modifiera par
  erreur. Elle vivra dans le code jusqu'à ce qu'un client la négocie.

## Hors périmètre

- Vendre quoi que ce soit (P2-005 à P2-007).
- Écrire dans `ledger_entries` — rien à y écrire tant que rien n'est encaissé.
- Le reversement et le calendrier de payout (`payouts`) : Stripe les gère, on
  les lira dans P2-016.
- Les partenariats et le partage de revenus inter-box (S8, P3).

## Critères d'acceptation

- [ ] Un OWNER relie son compte et revient sur un écran qui dit exactement où il
      en est ; un MANAGER ne voit pas la section
- [ ] `charges_enabled` faux ⇒ **aucun écran de vente n'est atteignable**, et le
      message dit pourquoi, pas « erreur »
- [ ] Un webhook à signature invalide est rejeté en `400` **sans** que le corps
      soit interprété
- [ ] Le **même** `stripe_event_id` livré deux fois n'est traité qu'une fois —
      testé en rejouant l'appel, pas en le supposant
- [ ] Un webhook portant un `stripe_account_id` inconnu est enregistré et ignoré,
      sans erreur 500 : Stripe le rejouerait indéfiniment
- [ ] `pnpm test:db` vert, `processed_webhook_events` reste invisible à
      `authenticated`

## Notes

**La devise se fige ici.** `forbid_currency_change_with_ledger` interdit déjà de
changer la devise d'une box qui a des écritures. Le compte Connect en ajoute une
seconde, en amont : la devise du compte Stripe et celle du tenant doivent
concorder à la liaison, sinon le premier paiement échoue de façon
incompréhensible.

**Le webhook n'est pas authentifié, et c'est normal.** C'est la seule route du
produit dans ce cas. La signature *est* l'authentification ; si on la vérifie
après avoir désérialisé, on a déjà exécuté du code sur une entrée hostile.

Passer `money-reviewer` avant tout commit sur ce chemin.
