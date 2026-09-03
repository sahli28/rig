# P1-003 — Réservation transactionnelle

**Phase** P1 · **Estimation** 8 j·h · **Dépend de** P1-002 · **Spec** §4-P2, RM2.1–2.8

## Objectif

La fonction pour laquelle on achète le produit. **Un seul double-booking en
production détruit la confiance de façon irréversible.**

## Ce lot : le SQL seul

Ce ticket se fait **en deux lots**, et celui-ci ne livre aucun écran.

C'est la logique métier la plus risquée du produit — « un seul double-booking en
production détruit la confiance de façon irréversible » — et elle se prouve
**entièrement en pgTAP**, sans interface. Les mêler ferait relire une fonction
transactionnelle en même temps qu'un formulaire, et c'est la fonction qui perdrait.

| Lot | Contenu | État |
| --- | ------- | ---- |
| **1 — SQL** | `bookings`, `book_class()`, verrou de ligne, contraintes, idempotence, codes d'erreur, test de concurrence | **celui-ci** |
| 2 — écrans | Détail du cours, réservation, confirmation, Mes réservations, carte « prochain cours » | **`P1-003b-ecrans-reservation.md`** — écrit le 3 septembre 2026, après la passe mobile. L’écran Planning en est sorti : il appartient à P1-002b |

## Ce que ce ticket suppose et qui doit exister

Section ajoutée le 3 septembre 2026 (règle 8 de `CLAUDE.md`), rétroactivement :
ce ticket a été rédigé avant le gabarit.

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `classes` avec `capacity`, `booked_count`, `status` | `..._recurrent_class_schedules.sql` (P1-002) | ✅ existe — avec `check (booked_count between 0 and capacity)` déjà posé |
| `booked_count` **hors des `grant update`** de `authenticated` | idem | ✅ existe, et c'est délibéré : seule une fonction `security definer` pourra le bouger. Vérifié — `has_column_privilege` rend `false` |
| Fenêtres de réservation : `open_days_before`, `close_minutes_before`, `max_upcoming_bookings` | `tenant_settings` (P0-004), éditables depuis P1-001b | ✅ existent, avec leurs contraintes de bornes |
| `tenants.timezone` — les fenêtres se calculent en **heure locale de la box** | P0-004 | ✅ existe (règle 9 de `CLAUDE.md`) |
| `app_error(code, message, sqlstate)` | `..._app_error_codes.sql` | ✅ existe |
| Les six codes d'erreur du périmètre | `packages/core/src/errors.ts` : `CLASS_FULL`, `ALREADY_BOOKED`, `BOOKING_WINDOW_CLOSED`, `NO_VALID_ENTITLEMENT`, `MAX_UPCOMING_BOOKINGS_REACHED`, `IDEMPOTENCY_KEY_REQUIRED` | ✅ **déjà déclarés**, avec leurs clés i18n et le test de parité qui relit les migrations. Rien à inventer, tout à câbler |
| `current_tenant_ids()`, `log_audit()`, `uuid_generate_v7()` | P0-004 | ✅ existent |
| **`bookings`** | — | ❌ **n'existe pas.** Ce lot la crée : c'est son objet |
| **Une infrastructure d'idempotence** | — | ❌ **n'existe rien.** `Idempotency-Key` est une règle de `CLAUDE.md` (n°4) que rien n'implémente encore. Ce lot pose la première, et P2-006 s'en servira pour l'argent |
| **Des droits de réservation réels** (abonnement, crédits) | P2-006, P2-007 | ❌ **à créer, et volontairement pas ici** — voir ci-dessous |
| `waitlist_entries` | P1-006 | ❌ à créer par P1-006. `CLASS_FULL` est donc une fin de parcours dans ce lot, pas une porte vers l'attente |
| Annulation, et la libération de place qui va avec | P1-004 | ❌ à créer par P1-004 |
| **La vue des pairs** (feuille d'inscrits) | — | ❌ **n'existe pas**, et D-001 l'a délibérément laissée. Les trois décisions à prendre sont écrites en fin de ticket ; elles se tranchent **avec l'écran sous les yeux**, donc au lot 2 |
| **Écran de réservation côté membre** | `apps/mobile` | ❌ à créer par **P1-003b**. La condition posée ici — que le socle mobile ait tourné sur un appareil — est **levée** : passe faite le 3 septembre 2026 (`docs/passe-mobile-iphone.md`) |
| `k6` ou `pgbench` pour la charge | — | ⚠️ **pas nécessaire à ce lot.** Le test de concurrence se fait en pgTAP avec `dblink`, voir les notes — le p95 sous charge appartient au lot 2, quand il y aura un appel HTTP à mesurer |

## Ce que ce lot rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `book_class(class, membership, idempotency_key)` | l'écran Détail du cours | **P1-003b** |
| `bookings` | l'annulation, la waitlist, le check-in, le portefeuille | P1-004, P1-006, P1-008, P2-007 |
| `member_has_booking_right()` — le point de couture des droits | l'abonnement, le portefeuille | **P2-006 et P2-007 la remplacent**, voir ci-dessous |
| L'infrastructure d'idempotence | toute écriture financière | P2-006, P2-007 |

**Règle 7 : `book_class()` n'a aucun appelant à la fin de ce lot.** C'est assumé
et c'est écrit — son appelant est **P1-003b**, qui existe depuis le 3 septembre
2026 et attend D-004 puis P1-002b.

## Où P2-006 et P2-007 viendront se brancher

Le hors-périmètre dit « pendant la phase pilote les droits sont accordés à la
main par la box ». C'est le bon choix : encaisser n'est pas un préalable à
réserver, et la box pilote paie hors app par construction. Mais **un choix
temporaire non préparé devient une couture forcée**, alors autant la poser tout
de suite.

`book_class()` appelle **une seule fonction** pour décider si la personne a le
droit de réserver :

    member_has_booking_right(p_membership_id uuid, p_class_starts_at timestamptz)
      returns boolean

Dans ce lot, son corps tient en une ligne : l'appartenance est `ACTIVE` et non
suspendue. C'est exactement « les droits sont accordés à la main par la box » —
inviter quelqu'un, c'est lui donner le droit de réserver.

Les deux tickets d'argent la **remplacent**, ils n'en ajoutent pas une seconde :

- **P2-006** y met l'abonnement, avec RM2.8 — « une réservation est bloquée si
  l'abonnement expire **avant la date du cours** », d'où le paramètre
  `p_class_starts_at`, qui n'a aucune utilité aujourd'hui et existe pour ça ;
- **P2-007** y ajoute le portefeuille, et **débite dans le verrou** de
  `book_class()` plutôt que dans une seconde transaction.

Le paramètre inutile est donc un choix, pas un oubli. Une signature qu'on
n'aurait pas à changer coûte une ligne aujourd'hui et évite de reprendre la
fonction la plus dangereuse du produit le jour où elle porte de l'argent.

## Périmètre

- Fonction PLpgSQL `book_class(p_class_id, p_membership_id, p_idempotency_key)` :
  verrou de ligne sur `classes`, vérification capacité / droits / fenêtre / doublon,
  insertion de la réservation, incrément du compteur — **une seule transaction**.
- Contraintes : `unique (class_id, membership_id) where status='CONFIRMED'`,
  `check (booked_count <= capacity)`, `unique (idempotency_key)`.
- `POST /v1/classes/{id}/bookings` avec `Idempotency-Key` obligatoire,
  rejeu renvoyant la réponse d'origine.
- Codes d'erreur : `CLASS_FULL` (409), `NO_VALID_ENTITLEMENT` (402),
  `BOOKING_WINDOW_CLOSED`, `ALREADY_BOOKED`, `MAX_UPCOMING_BOOKINGS_REACHED`.
- Écrans : Home avec le prochain cours réservable, Schedule, Class Detail,
  Booking Confirmation, My Bookings.
- Mise à jour optimiste côté client, avec rollback visible si le serveur refuse.

## Hors périmètre

Liste d'attente (P1-006), annulation (P1-004), paiement réel (P2) — pendant la
phase pilote les droits sont accordés à la main par la box.

## Critères d'acceptation

- [ ] 200 réservations simultanées sur 1 place → exactement 1 confirmée, 0 débit erroné
- [ ] Double tap avec la même `Idempotency-Key` → 1 réservation, réponse identique
- [ ] Une requête sans `Idempotency-Key` est refusée en `400`
- [ ] Un membre sans droits voit « Choisir une formule », jamais une erreur brute
- [ ] La réservation se fait en 2 taps depuis l'accueil
- [ ] p95 de l'appel API < 800 ms
- [ ] Perte de connexion pendant la réservation → rejeu sans doublon
- [ ] Le sous-agent `money-reviewer` rend `VERDICT: SAFE`

## Notes

Écrire le test de concurrence **avant** la fonction. Le lancer avec `k6` ou
un script `pg_bench`, pas seulement en unitaire : la concurrence ne se simule
pas correctement en TypeScript.

## La vue des pairs — trois décisions léguées par D-001

D-001 a livré `member_admin_directory` (staff) et **délibérément pas** la vue des
pairs : elle n'avait pas d'appelant, et la feuille d'inscrits qui la motive naît
ici, avec `bookings`. Ce qui reste à trancher, écrit tant que le raisonnement
était frais :

**Où elles se tranchent** : dans **P1-003c**, écrit une fois que l'écran Détail
du cours existera (P1-003b). La condition « avec l'écran sous les yeux » n'est
toujours pas remplie ; la trancher avant serait la retrancher après.

1. **« Les gens que je croise », pas « toute la box ».** Exposer l'annuaire
   complet d'une box à chacun de ses membres est plus large que ce que la spec
   §5.2 décrit, et plus large que le besoin : la feuille d'inscrits d'un cours.
2. **La case « leaderboard / visibilité » de l'écran de consentements (P0-005a)
   gouverne l'avatar.** Elle existe déjà, elle a été acceptée par la personne, et
   c'est le contrôle le plus proche de ce qu'on veut exprimer.
3. **Rouvrir le « si consenti » de la spec §5.2.** Un opt-in sur une liste
   d'inscrits a un taux de complétion médiocre, et une feuille à moitié anonyme
   n'aide personne. La forme probablement plus juste est celle que la spec
   applique déjà au partage inter-box : **intérêt légitime, information claire,
   opt-out** — « ne pas apparaître dans la liste des inscrits ». Plus léger, et
   cohérent avec le reste du produit.

   L'argument qui tranche, et qu'il faut garder sous la main parce que « ils se
   voient déjà en vrai » a l'air imparable : **l'app ne montre pas ce que la
   salle montre.** Elle transforme « les gens que je croise le mardi » en une
   liste consultable de chez soi de qui s'entraîne quand. Ce n'est pas le même
   objet. Quelqu'un qui évite un ex, ou qui préfère simplement que ses horaires
   ne soient pas lisibles par cent personnes, a un intérêt réel. Un contrôle est
   justifié ; c'est sa forme — opt-in ou opt-out — qui se décide avec l'écran
   sous les yeux.

Contrainte technique héritée : une valeur d'enum **ne se retire pas**
(`alter type … add value` est additif). Ajouter une finalité de consentement est
une décision irréversible — à ne prendre qu'avec l'écran qui la motive.
