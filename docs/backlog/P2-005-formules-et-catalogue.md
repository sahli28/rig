# P2-005 — Formules : le catalogue de la box

**Phase** P2 · **Estimation** 3 j·h · **Dépend de** P2-001 · **Spec** §2.2 (M8), §7.3 (`plans`), §17.1

> **Amendé le 5 septembre 2026, après la passe sur appareil**, sur deux points
> qui coûtent une ligne aujourd'hui et une migration une fois des formules
> vendues : le plafond de réservations devient un attribut de formule, et la
> périodicité passe à la forme de Stripe. L'estimation ne bouge pas — ce sont
> deux colonnes et deux contraintes dans une table qui n'existe pas encore.

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
| Écran membre où afficher le catalogue | `apps/mobile` | ⚠️ existe partiellement. Les écrans mobiles **ont tourné** sur appareil (passes des 3 et 4 septembre 2026) ; ce qui manque ici est l'écran de catalogue lui-même, pas la confiance dans le socle |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `plans` + son écran back-office | l'OWNER | celui-ci |
| `plans` en lecture membre (Plan Picker) | souscription, achat de pack | P2-006, P2-007 |
| `plan_grants_booking_right()` | la réservation, quand elle vérifiera les droits | P2-006 |

## Périmètre

- Table `plans` : `tenant_id`, `kind` (`SUBSCRIPTION` | `CREDIT_PACK` |
  `DROP_IN`), `name_i18n jsonb`, `description_i18n jsonb`, `price_cents int`,
  `currency`, **`interval`** (`MONTH` | `YEAR`, nul hors abonnement),
  **`interval_count int`**, `credits int`, `credit_validity_days int`,
  **`max_upcoming_bookings int null`**, `stripe_product_id`, `stripe_price_id`,
  `sort_order`, `active`, `deleted_at`.
- Contraintes qui disent le métier, pas la forme :
  - `price_cents >= 0`, entier — règle 5 de `CLAUDE.md` ;
  - `kind = 'SUBSCRIPTION'` ⇒ `interval not null`, `interval_count >= 1` et
    `credits is null` ;
  - `kind <> 'SUBSCRIPTION'` ⇒ `interval is null` **et** `interval_count is null` ;
  - `kind = 'CREDIT_PACK'` ⇒ `credits > 0` ;
  - `max_upcoming_bookings` nul ou `>= 1`. Zéro serait une formule qui ne permet
    de réserver rien — si une box veut ça, elle désactive la formule ;
  - `currency` = celle du tenant, vérifiée par trigger. Une box en EUR ne vend
    pas en GBP.

### `interval_count`, et l'ambiguïté qu'il faut lever à la saisie

`interval` seul ne sait pas dire « illimité 3 mois » : il ne connaît que le mois
et l'année. La forme retenue est **celle de Stripe** — `recurring: { interval,
interval_count }` — parce que ces formules **deviendront des `Price`**, et qu'un
modèle qui ne colle pas au leur se paie à chaque webhook, en conversions
manuelles qu'aucun test ne couvre.

**Ce que `interval_count` exprime, et ce qu'il n'exprime pas.** C'est la
**périodicité de facturation** : « 3 mois » signifie *facturé tous les trois
mois, et renouvelé*. Ce **n'est pas** un forfait de trois mois qui s'arrête tout
seul. Les deux se ressemblent à la vente et n'ont rien à voir à l'exécution :

| Ce que la box veut vendre | Ce que c'est chez Stripe | Statut ici |
| --- | --- | --- |
| Illimité, facturé tous les 3 mois, reconduit | `recurring: { interval: month, interval_count: 3 }` | ✅ ce ticket |
| Trois mois puis fin, sans reconduction | un `cancel_at` posé à la souscription, ou une *subscription schedule* | ❌ **hors périmètre**, et il faut le dire à l'écran de saisie |

L'écran de formules doit donc **nommer la reconduction** — « facturé tous les
3 mois, renouvelé automatiquement » — plutôt qu'afficher « 3 mois », qui laisse
croire à un terme. Une box qui veut vraiment un forfait non reconduit crée un
`CREDIT_PACK` avec `credit_validity_days`, ce que le modèle sait déjà faire.

`DAY` et `WEEK` existent chez Stripe et **n'entrent pas** dans l'enum : une
valeur d'enum sans code derrière ne vaut rien (`CLAUDE.md`), et `alter type … add
value` coûte une ligne le jour où une box vend à la semaine.

### `max_upcoming_bookings` : le plafond appartient à la formule

Il est aujourd'hui un réglage **unique** de la box
(`tenant_settings.max_upcoming_bookings`, défaut 3), et ce réglage suppose que
toutes les formules se plafonnent pareil. C'est faux dès qu'une box vend en
parallèle un illimité et un carnet : pour un carnet, **le plafond naturel est le
solde restant**, pas un nombre saisi ; pour un illimité, le plafond est une règle
d'équité — ne pas bloquer six créneaux qu'on n'honorera pas.

`plans.max_upcoming_bookings int null`, **nul = on retombe sur le réglage de la
box**. Le réglage de box ne disparaît pas : il reste le défaut, et il reste la
seule valeur qui s'applique pendant le pilote, où aucune formule n'existe.

**La règle de résolution, écrite ici parce que `book_class()` devra la coder**
et qu'elle ne se devine pas quand une personne détient plusieurs droits :

> le plafond effectif est le **maximum** des `max_upcoming_bookings` des formules
> qui lui accordent un droit aujourd'hui, chaque formule à `null` comptant pour
> le réglage de la box.

Le maximum et non le minimum : un plafond attaché à une formule est une
**contrepartie de ce qu'on a acheté**. Avoir acheté davantage ne doit pas
restreindre. La contrainte de solde d'un carnet, elle, est d'une autre nature et
s'applique **en plus** — voir P2-007, qui dit comment les deux s'articulent au
lieu de les laisser se contredire à l'exécution.
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
- [ ] Un OWNER crée « Illimité 3 mois » et le `Price` Stripe porte bien
      `interval: month, interval_count: 3` — vérifié dans le tableau de bord,
      pas seulement en base
- [ ] Un `CREDIT_PACK` avec un `interval_count` est refusé par la base : la
      périodicité n'a de sens que pour un abonnement
- [ ] L'écran de saisie **dit la reconduction** : « facturé tous les 3 mois,
      renouvelé automatiquement », jamais « 3 mois » tout court
- [ ] Une formule sans `max_upcoming_bookings` se comporte exactement comme
      aujourd'hui — c'est le réglage de la box qui s'applique. Test pgTAP, parce
      que c'est la ligne de non-régression du pilote
- [ ] Une box dont `charges_enabled` est faux voit le catalogue en lecture avec
      la raison, et ne peut rien publier
- [ ] Un membre d'une autre box ne voit aucune de ces formules (`rls_leak_test`)

## Notes

`name_i18n` en `jsonb`, pas une table de traductions : deux langues, une poignée
de lignes par box, et c'est la box qui écrit — pas nous. Une table de traduction
serait la bonne réponse à un problème qu'on n'a pas.
