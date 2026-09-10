# `D-024` — Le compte-rendu d'annulation : qui a été prévenu, qui non

**Phase** `dette` (non programmée, hors ①) · **Estimation** `1,5` j·h · **Dépend de** `P1-007` ✅ (l'émetteur, `notification_eligibility`, `cancel_class_bookings`) · **Spec** §5.3, §12.3 · **Trouvé** à la passe partielle de `P1-007`, le 11 septembre 2026

## Objectif

Quand la box annule un cours, le back-office lui dit **combien de membres inscrits
seront prévenus, et combien ne le seront pas — avec la raison**. « 3 prévenus,
1 non : notifications coupées. » Aujourd'hui l'annulation part en silence côté
staff : l'enfilage est correct, mais rien à l'écran ne le montre, et le doute est
réel.

## Pourquoi ce ticket existe : le silence a coûté vingt minutes à qui connaît le code

À la passe partielle de `P1-007`, annuler un cours a bien enfilé les
`CLASS_CANCELLATION` — vérifié en base, six requêtes SQL pour l'établir. Rien à
l'écran ne le disait. **Marc aura exactement ce doute le jour où il annulera un
cours pour de vrai**, et il n'ouvrira pas Studio pour lire `push_outbox`. La
microcopie `planning.cancel_push_only` (« seuls les membres qui ont activé les
notifications sont prévenus ») **s'excuse au lieu d'informer** : elle dit qu'il y
a peut-être des non-prévenus, jamais lesquels ni combien. Ce ticket la remplace
par un compte-rendu.

## Ce que ce ticket suppose et qui doit exister

*Chaque état est vérifié dans le dépôt, le 11 septembre 2026.*

| Prérequis | Où il vit | État |
| --- | --- | --- |
| `cancel_class_bookings(class_id)` | `20260911100700_push_producers.sql` | ✅ existe — annule les réservations, recalcule `booked_count`, enfile un `CLASS_CANCELLATION` par membre. **Rend un `integer` (le compte)** ; ce ticket lui fait rendre un **détail** |
| `notification_eligibility(membership, category, now)` | `20260911100300_notification_eligibility.sql` | ✅ rend déjà le **code de raison** (`OK` / `NO_PUSH_CONSENT` / `CATEGORY_DISABLED` / `QUIET_HOURS` / `MARKETING_CAP` / `NO_MEMBERSHIP`). Rien à réinventer : il reste à **agréger** |
| `enqueue_push(...)` | `20260911100600_push_transport.sql` | ✅ rend un **booléen** (enfilé / écarté), **pas la raison** — d'où la décision ci-dessous |
| L'action web d'annulation `cancelClass` | `apps/web/app/box/[slug]/planning/actions.ts` | ✅ pose `status='CANCELLED'` + le motif, puis appelle `cancel_class_bookings`. Rend un `ActionState` (`{status, key}`) — c'est lui qui portera le compte-rendu |
| L'écran d'annulation | `apps/web/app/box/[slug]/planning/week-grid.tsx` | ✅ le formulaire + la microcopie `planning.cancel_push_only`, à remplacer par le compte-rendu |
| Le rôle qui annule | `current_admin_tenant_ids()` (OWNER/MANAGER) | ✅ la garde de `cancel_class_bookings` |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --- | --- | --- |
| Le détail de notification d'une annulation (prévenus / écartés par raison) | l'écran d'annulation du back-office | celui-ci — **pas d'appelant manquant** (règle 7) : le compte-rendu est consommé par le formulaire qui l'a déclenché |

## La décision qui structure le ticket

**Le compte-rendu reflète l'éligibilité au moment de l'enfilage, pas la livraison.**
À l'annulation, les notifications sont **enfilées** (`pending`), pas encore
envoyées — l'émetteur draine ensuite, en asynchrone. Le staff peut donc savoir
« qui **sera** prévenu » (éligible → enfilé), jamais « qui a **reçu** » (ça, c'est
plus tard, et c'est un autre besoin). Écrire « prévenu » au futur, pas au passé.

**Où l'agrégation se fait.** Deux formes, à trancher à l'ouverture avec l'écran
sous les yeux — et le choix est réel, chacune a son coût :

1. **`cancel_class_bookings` rend un `jsonb`** au lieu d'un `integer` :
   `{ cancelled, will_notify, skipped: { NO_PUSH_CONSENT: n, CATEGORY_DISABLED: n, … } }`.
   La fonction boucle **déjà** sur les réservations annulées en appelant
   `enqueue_push` ; il suffit qu'elle lise la **raison** (`notification_eligibility`
   rendant autre chose qu'`OK`) et l'agrège. **Coût, et il a des sœurs** — vérifié
   dans le dépôt, pas supposé :
   - **Changer le type de retour ne se fait pas par `create or replace`** :
     Postgres refuse « cannot change return type of existing function ». Et la
     fonction est définie **deux fois** — `20260905100000_cancel_booking.sql:300`
     (l'originale) **et** `20260911100700_push_producers.sql:115` (recréée par
     P1-007). Il faut donc éditer **les deux** en place (règle 13, pas de base de
     prod ; le hook `guard-migrations.mjs` bloque l'Edit et `pnpm
     migrations:immuables` avertit), ou un `drop function` avant recréation.
   - **Deux tests** assertent le retour entier, pas un : `push_emitter_test.sql`
     **et `cancellation_test.sql:472`** (`is(cancel_class_bookings(…), 1)`) — la
     sœur exacte dans le fichier d'à côté, la classe de trou que ce dépôt traque
     (règle 10, `.claude/rules/database.md`). Les `throws_ok`/`lives_ok`
     d'isolation de rôle de ce même fichier (l. 628, 637, 656) ne lisent pas le
     retour : intacts.
   - L'appelant **runtime**, lui, est bien unique — `actions.ts` (grep).
2. Une fonction de lecture séparée `class_cancellation_report(class_id)`, appelée
   après coup — **sa force : elle ne touche à aucune signature ni aucune
   migration versionnée** (elle évite tout le coût ci-dessus). **Sa faiblesse** :
   elle rejouerait l'éligibilité sur un état déjà muté, et deux lectures de la
   même vérité divergent (le motif du `returning` de `cancel_class_bookings`,
   tranché en `P1-004`). Le compromis se pèse à l'ouverture, l'écran sous les
   yeux — ce n'est plus l'évidence que « recommandation : la première » laissait
   croire.

## Périmètre

- SQL : le détail est produit (option 1 ou 2 selon l'arbitrage), et ses tests
  pgTAP suivent — **les deux fichiers frères** (`push_emitter_test`,
  `cancellation_test`) si le type de retour change.
- Core : le type du retour, exposé proprement (pas de `jsonb` nu côté client).
- Web : l'action `cancelClass` porte le détail dans son `ActionState` ; l'écran
  l'affiche à la place de `planning.cancel_push_only`.
- i18n FR/EN : les libellés des raisons (« notifications coupées », « catégorie
  désactivée »…), dans le même commit.

## Hors périmètre

- **La confirmation de livraison** (reçu / échoué par membre) : c'est
  `notification_sends` relu après l'envoi, un besoin distinct et plus lourd.
- Le rappel J-1 et la promotion de liste d'attente : mêmes raisons disponibles,
  mais leur surface d'affichage n'existe pas (pas d'écran « je viens d'enfiler »).
  À reprendre si le besoin se pose.
- Le canal e-mail de repli (`D-008`).

## Critères d'acceptation

- [ ] Après une annulation, l'écran affiche **combien** de membres inscrits seront
      prévenus **et** combien ne le seront pas
- [ ] Chaque non-prévenu porte **sa raison** (au moins : consentement push absent,
      catégorie coupée), en clair et traduite
- [ ] Le compte est juste sur un cours mêlant consentants et non-consentants
      (pgTAP : le détail rendu par `cancel_class_bookings`)
- [ ] La microcopie `planning.cancel_push_only` est **remplacée** par le
      compte-rendu, pas juxtaposée
- [ ] `rls-auditor` **SAFE** si la signature SQL change ; `pnpm test:db` vert

## Notes

Ne pas gonfler : les raisons existent déjà, le chemin d'annulation existe déjà,
c'est de l'agrégation et de l'affichage. Le risque est l'inverse — sur-concevoir
un « centre de notifications » là où le besoin est une phrase sous un bouton
d'annulation. Si l'estimation dépasse 1,5 à l'ouverture, c'est le signe qu'on a
ajouté la livraison (hors périmètre), pas le compte-rendu.
