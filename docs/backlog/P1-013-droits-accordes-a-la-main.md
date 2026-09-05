# P1-013 — Le droit de réserver, accordé et retiré à la main

**Phase** P1 · **Estimation** 2 j·h · **Dépend de** P1-003 ✅, P1-001c ✅ · **Spec** §5.2, RM2.7, RM2.8 · **Non programmé** — voir ci-dessous

## Le chemin que personne n'a écrit

Le hors-périmètre de P1-003 dit : « pendant la phase pilote les droits sont
accordés à la main par la box ». C'est le bon choix, et il a été tenu — mais
**« à la main » n'a jamais été implémenté**. `member_has_booking_right()` rend
aujourd'hui `true` pour toute appartenance `ACTIVE` :

```sql
select exists (
  select 1 from public.memberships m
  where m.id = p_membership_id and m.status = 'ACTIVE' and m.left_at is null
);
```

Autrement dit : **être membre, c'est avoir le droit de réserver, sans fin et sans
condition.** Pendant le pilote, où l'encaissement se fait hors app, une box ne
peut donc pas exprimer « celle-ci a arrêté de payer » autrement qu'en la
**retirant de la box** — ce qui efface aussi son historique de sa vue, la sort de
la feuille d'inscrits, et lui fait perdre l'accès à ce qu'elle a déjà réservé.

Le geste disponible est cent fois trop violent pour le besoin.

## Ce que ce ticket n'est pas

**Ce n'est pas P2-005 à P2-007 en avance.** Les formules, les carnets vendus, les
abonnements Stripe et le portefeuille de crédits sont couverts là-bas, avec leur
catalogue et leur `interval_count` qui donne déjà 1 / 3 / 6 / 12 mois.

Ce ticket ne livre **ni euro, ni objet Stripe, ni prix**. Il livre le droit
lui-même, posé par une personne au lieu d'être obtenu en payant.

C'est précisément ce qui rend la couture propre : P2-006 et P2-007 deviendront
« **le même droit, obtenu en payant** », au lieu d'un second modèle de droits
qu'il faudrait réconcilier avec celui-ci.

## Périmètre

- Table `entitlements` : `tenant_id`, `membership_id`, `kind`
  (`UNLIMITED` | `PACK`), `sessions_total` et `sessions_used` pour un carnet,
  `starts_on`, `ends_on`, `granted_by_membership_id`, `note`, `revoked_at`.
- **Aucune colonne de montant.** Pas de `price_cents`, pas de `stripe_*`. Le
  jour où ils arriveront, ils seront sur `subscriptions` et `plans`, pas ici.
- `member_has_booking_right()` **remplacée**, pas doublée : un droit non révoqué
  couvrant la date du cours — ce à quoi sert `p_class_starts_at`, posé en P1-003
  sans usage pour cette raison exacte (RM2.8).
- Écran back-office, sur la fiche d'un membre : accorder, voir l'historique,
  révoquer. **OWNER seul** — c'est une décision commerciale, pas opérationnelle,
  et §5.2 range l'argent côté propriétaire.
- Journal d'audit sur l'octroi et la révocation : c'est une décision qui touche
  ce qu'une personne peut faire, elle se relit.
- Décompte d'un carnet **dans le verrou de `book_class()`**, jamais après. Même
  raisonnement que le débit de crédits de P2-007, et même endroit.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `member_has_booking_right(membership, class_starts_at)` | P1-003 ✅ | ✅ existe — **c'est son appelant manquant**, et sa signature a été écrite pour ce jour-là |
| Le verrou de ligne de `book_class()` | P1-003 ✅ | ✅ existe — le décompte de carnet s'y insère, il n'ouvre pas une seconde transaction |
| Fiche membre du back-office | P1-001c ✅ | ✅ existe — on ajoute une section, pas un écran |
| `log_audit()` | P0-004 ✅ | ✅ existe, écrit depuis P1-001c |
| Codes d'erreur | `NO_VALID_ENTITLEMENT` | ✅ **existe déjà**, dans `APP_ERROR_CODES` depuis P1-003, avec sa clé i18n |
| Le libellé côté membre | `errors.no_valid_entitlement` | ⚠️ **à revoir** : il dit « Aucun abonnement ni crédit valable pour ce cours », or pendant le pilote il n'y a ni abonnement ni crédit — seulement un droit accordé par la box. RM2.7 veut « Choisir une formule » ; ici la phrase juste est plutôt « demande à ta box » |
| Le harnais de concurrence | `scripts/booking-concurrency.mjs` ✅ | ✅ existe — **à étendre** : un carnet à une séance, N réservations simultanées, une seule doit passer |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `entitlements` et son écran | l'OWNER, sur la fiche d'un membre | celui-ci |
| `member_has_booking_right()` avec un vrai corps | `book_class()` | ✅ **elle a déjà son appelant** — c'est l'inverse du cas habituel |
| Le décompte d'un carnet sous verrou | `book_class()` | celui-ci |
| La restitution d'une séance à l'annulation | `cancel_booking()` | **P1-004**, via son point de couture |

## La couture avec P2-006 et P2-007

Elle est déjà à moitié faite, et c'est l'intérêt d'écrire ce ticket maintenant.

| Aujourd'hui | Ce ticket | P2-006 / P2-007 |
| ----------- | --------- | --------------- |
| `member_has_booking_right()` rend `true` pour tout membre actif | un droit **posé à la main**, daté, révocable | le **même** droit, créé par `invoice.paid` au lieu d'un clic |
| Aucun décompte | un carnet décrémenté sous verrou | un portefeuille décrémenté au même endroit |
| Aucune restitution | une séance rendue à l'annulation (P1-004) | un crédit rendu au portefeuille (RM4.4) |

Deux règles à ne pas perdre en route :

1. **P2-007 ne crée pas une seconde table de droits.** Un portefeuille de crédits
   achetés est un `entitlements` de type `PACK` dont l'origine est un paiement.
   Si les deux modèles divergent, la question « cette personne peut-elle
   réserver ? » aura deux réponses, et c'est exactement ce qu'on évite ici ;
2. **la table reste sans montant.** Le prix payé vit sur `payments` et
   `ledger_entries` ; le droit obtenu vit ici. Mélanger les deux ferait entrer de
   l'argent dans une table qui n'a pas les gardes de la règle 5.

## Critères d'acceptation

- [ ] Un OWNER accorde un droit illimité de trois mois à une membre, qui réserve
- [ ] Le même droit arrivé à échéance **bloque** la réservation, et le message
      dit quoi faire — jamais une erreur brute (RM2.7)
- [ ] Un droit révoqué bloque immédiatement, sans toucher à l'appartenance : la
      personne reste membre, garde son historique et ses réservations en cours
- [ ] Un carnet de dix séances se décrémente à la réservation, **dans la même
      transaction** — vérifié sous contention, une seule réservation passe sur la
      dernière séance
- [ ] Un droit qui expire **avant la date du cours** bloque la réservation, même
      s'il est valide au moment où l'on réserve (RM2.8)
- [ ] Un MANAGER ne peut ni accorder ni révoquer ; la page l'explique
- [ ] L'octroi et la révocation sont au journal d'audit, sans e-mail ni donnée
      inutile dans le `diff`
- [ ] `member_has_booking_right()` n'a plus de corps provisoire

## Quand le faire

**Pas avant P1-004, et pas avant que la box pilote le demande.**

Tant qu'elle accepte que « membre = peut réserver », le ticket ne sert à rien :
la box gère ses impayés en parlant aux gens, ce qu'elle fait déjà. Le jour où
elle dit « je veux pouvoir couper sans exclure », il est écrit, chiffré, et la
décision prend une minute.

C'est aussi la raison de l'écrire maintenant plutôt qu'alors : ce qui coûte cher
n'est pas de le coder, c'est de découvrir sous pression que
`member_has_booking_right()` rend `true` pour tout le monde.
