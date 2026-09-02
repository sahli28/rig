# P2-005 — Formules : le catalogue de la box

**Phase** P2 · **Estimation** 3 j·h · **Dépend de** P2-001 · **Spec** §2.2 (M8), §7.3 (`plans`), §17.1

## Objectif

Une box saisit ce qu'elle vend — abonnements, packs de séances, drop-in — et un
membre le voit. Rien ne s'achète encore : ce ticket construit **l'objet de la
vente**, pas la vente.

Le séparer de P2-006 n'est pas du découpage pour le plaisir. Un catalogue est du
CRUD tenant-scopé qu'on sait faire ; une souscription est une machine à états
partagée avec Stripe. Les mélanger, c'est déboguer un formulaire pendant qu'on
se demande si un webhook est arrivé.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `stripe_accounts` et `tenant_can_sell()` | P2-001 | ❌ **à créer par P2-001** |
| `tenants.currency` | `..._identity_and_tenancy.sql` | ✅ existe |
| Écran de réglages à sections, et son modèle de Server Action | `/box/[slug]/reglages` + `reglages/actions.ts` (P1-001b) | ✅ existe — modèle à recopier |
| Schémas Zod partagés | `packages/core` | ✅ existe |
| Un champ « montant en centimes » dans le kit web | `packages/ui` / `apps/web` | ❌ **à créer ici.** Aucun écran n'a encore saisi d'argent : le formatage, la locale (virgule décimale en FR), et l'interdiction du float sont à poser une fois |
| Un composant de liste réordonnable | — | ⚠️ non nécessaire : l'ordre d'affichage est une colonne `sort_order`, saisie au clavier. Pas de drag & drop pour trois formules |
| Écran membre où afficher le catalogue | `apps/mobile` | ⚠️ existe partiellement — les écrans mobiles n'ont **jamais tourné** (P0-005a, passe appareil en attente). En dépendre suppose cette passe faite |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `plans` + son écran back-office | l'OWNER | celui-ci |
| `plans` en lecture membre (Plan Picker) | souscription, achat de pack | P2-006, P2-007 |
| `plan_grants_booking_right()` | la réservation, quand elle vérifiera les droits | P2-006 |

## Périmètre

- Table `plans` : `tenant_id`, `kind` (`SUBSCRIPTION` | `CREDIT_PACK` |
  `DROP_IN`), `name_i18n jsonb`, `description_i18n jsonb`, `price_cents int`,
  `currency`, `interval` (`MONTH` | `YEAR`, nul hors abonnement), `credits int`,
  `credit_validity_days int`, `stripe_product_id`, `stripe_price_id`,
  `sort_order`, `active`, `deleted_at`.
- Contraintes qui disent le métier, pas la forme :
  - `price_cents >= 0`, entier — règle 5 de `CLAUDE.md` ;
  - `kind = 'SUBSCRIPTION'` ⇒ `interval not null` et `credits is null` ;
  - `kind = 'CREDIT_PACK'` ⇒ `credits > 0` et `interval is null` ;
  - `currency` = celle du tenant, vérifiée par trigger. Une box en EUR ne vend
    pas en GBP.
- Création du `Product` et du `Price` Stripe **sur le compte connecté**, à
  l'enregistrement. Un `Price` Stripe est immuable : changer un tarif crée un
  nouveau `Price` et **archive** l'ancien, il ne le modifie pas.
- Écran `/box/[slug]/formules`, OWNER seul (§5.2 range la tarification avec le
  white-label, côté propriétaire).
- Le catalogue en lecture pour un membre : `plans_for_member()`, qui ne rend que
  les formules `active` et non supprimées de **sa** box.

## Le point qui coûtera plus cher qu'il n'en a l'air : désactiver une formule

Une formule qu'on retire du catalogue a des abonnés. `deleted_at` la retire de
la vente ; il ne résilie personne. Les trois états sont distincts et doivent
l'être à l'écran :

| État | En vente ? | Abonnés en cours ? |
| ---- | ---------- | ------------------ |
| `active = true` | oui | conservés |
| `active = false` | non | **conservés** — c'est le cas normal d'un tarif fermé aux nouveaux |
| `deleted_at not null` | non | conservés, et la formule reste lisible pour l'historique |

Aucun de ces états ne touche Stripe côté abonnement : résilier est un geste
explicite, par abonné, et il appartient à P2-006.

## Hors périmètre

- Souscrire, payer, débiter (P2-006, P2-007).
- Codes promo et remises. La spec les mentionne dans le payload §4-P4
  (`promo_code?`) sans jamais les spécifier : à traiter comme un ticket propre le
  jour où une box le demande.
- Prix par palier, tarif étudiant, engagement 12 mois : une box qui en veut peut
  créer plusieurs formules. On n'invente pas de moteur tarifaire pour zéro client.

## Critères d'acceptation

- [ ] Un OWNER crée « Illimité 89 € / mois » et « 10 séances, 6 mois de validité »,
      et les deux apparaissent côté membre dans sa langue
- [ ] Un MANAGER ne voit pas l'écran ; la policy refuse aussi, l'écran explique
- [ ] Changer un prix **archive** l'ancien `Price` Stripe et en crée un nouveau —
      vérifié dans le tableau de bord Stripe, pas seulement en base
- [ ] Un pack sans `credits`, ou un abonnement sans `interval`, est refusé **par
      la base** — test pgTAP, pas seulement par Zod
- [ ] Une box dont `charges_enabled` est faux voit le catalogue en lecture avec
      la raison, et ne peut rien publier
- [ ] Un membre d'une autre box ne voit aucune de ces formules (`rls_leak_test`)

## Notes

`name_i18n` en `jsonb`, pas une table de traductions : deux langues, une poignée
de lignes par box, et c'est la box qui écrit — pas nous. Une table de traduction
serait la bonne réponse à un problème qu'on n'a pas.
