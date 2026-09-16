# `P2-018` — Abonnement à durée fixe, attribué à la main

**Phase** `P2` · **Estimation** `3,5` j·h · **Dépend de** `P1-003` (`book_class`), `P1-001c` (annuaire des membres) · **Spec** §7 (RM2.8), §2.6 · **Origine** décision commanditaire, 16 septembre 2026

## Objectif

Le staff donne à un membre un accès de durée fixe — 1, 2, 3, 6 ou 12 mois — et à
partir de là ce membre réserve tant que son accès couvre la date du cours, pas
au-delà. Le paiement se fait hors app (`P2-019`) ; l'attribution, elle, est un
geste dans le back-office.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| `member_has_booking_right(membership_id, class_starts_at)` | `20260903090000_bookings_and_book_class.sql:106` | ✅ **le point d'accroche** — aujourd'hui « appartenance active », commentée « P2-006 y met l'abonnement (RM2.8) ». Ce ticket remplit ce corps, **à la place de P2-006** (Stripe) |
| `book_class()` appelle déjà l'oracle dans la transaction | même fichier `:247` | ✅ rien à recâbler côté réservation |
| Table d'abonnement | — | ❌ **à créer ici** : `member_subscriptions` (`tenant_id`, `membership_id`, `duration_months`, `starts_on`, `ends_on`, `granted_by`, `created_at`) |
| Écran d'attribution | `apps/web/app/box/[slug]/membres/` (liste + actions) | ⚠️ la **liste** existe, pas de fiche par membre. L'attribution se fait par une action/feuille depuis la ligne du membre — pas besoin d'un écran de détail complet |
| Message « pas de droits » côté membre | `NO_VALID_ENTITLEMENT` (`packages/core/src/errors.ts`) | ⚠️ le code existe ; le CTA « Choisir une formule » devient « Contacte ta box » (pas de vente in-app) |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --- | --- | --- |
| Le corps de `member_has_booking_right()` = « un abonnement couvre la date » | `book_class()` | celui-ci |
| L'action « donner un accès » | la ligne membre du back-office | celui-ci |
| L'affichage « accès actif jusqu'au … » | la carte membre (P1) | celui-ci |

## Périmètre

- Migration : `member_subscriptions` ; contrainte `duration_months in (1,2,3,6,12)` ;
  `ends_on` calculé = `starts_on + n mois` en **heure locale de la box** (règle 9) ;
  RLS (staff écrit, membre lit le sien) ; pgTAP.
- Réécriture du corps de `member_has_booking_right()` : appartenance active
  **et** un abonnement dont `[starts_on, ends_on]` couvre `class_starts_at` (date,
  fuseau box). Le grant reste **retiré** à `authenticated` — la fonction n'est
  appelée que par `book_class()`, la fuite fermée par `close_booking_right_oracle`
  ne se rouvre pas.
- Action `grantSubscription(slug, membershipId, durationMonths)` depuis la liste
  des membres : feuille de choix de durée, début = aujourd'hui (fuseau box),
  écriture + journal d'audit.
- Renouvellement = ré-attribution (nouvelle ligne). L'accès à un instant = la
  ligne qui couvre cet instant.
- Côté membre : « Accès actif jusqu'au JJ/MM » sur la carte ; à défaut, un état
  clair « Pas d'accès actif — contacte ta box ».

## Hors périmètre

- Le paiement (lien externe) → `P2-019`.
- Abonnements Stripe récurrents, facturation, dunning → `P2-006`/`P2-008`,
  **différés avec l'entité**. `member_subscriptions` est la version manuelle ;
  quand l'entité existera, `P2-006` branchera Stripe sur la même garde sans jeter
  ce modèle.
- Crédits / packs de séances → `P2-007`, différé.
- Prévenir le membre que son accès expire (push J-3) → à ouvrir si l'usage le
  demande (motif de `P1-029`).

## Critères d'acceptation

- [ ] Un membre à qui on attribue « 3 mois » réserve un cours daté dans 2 mois, et
      se voit refuser (`NO_VALID_ENTITLEMENT`) un cours daté dans 4 mois — pgTAP
- [ ] `duration_months` hors {1,2,3,6,12} est refusé par la base — pgTAP
- [ ] Un abonnement expiré ne laisse plus réserver dès le lendemain de `ends_on`
      (fuseau box), y compris au passage d'heure d'été — pgTAP (règle 9)
- [ ] `member_has_booking_right()` reste sans grant à `authenticated` ;
      `rls-auditor` SAFE
- [ ] Un COACH ne peut pas attribuer d'accès ; OWNER/MANAGER oui — pgTAP de policy
- [~] Parcours réel : la box donne 1 mois à Léa, elle réserve ; l'accès retiré,
      elle ne peut plus — à jouer sur l'hébergé

## Notes

Décision tenue (commanditaire, 16 sept. 2026) : l'accès est **manuel** et à
**durée fixe**. Pas de prix ni de catalogue ici — la durée est un choix, pas un
produit tarifé ; le tarif vit dans le lien Stripe de la box (`P2-019`). Ne pas
réintroduire `plans`/`subscriptions` Stripe : ce sont `P2-005`/`P2-006`, différés.
