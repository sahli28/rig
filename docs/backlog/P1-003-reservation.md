# P1-003 — Réservation transactionnelle

**Phase** P1 · **Estimation** 8 j·h · **Dépend de** P1-002 · **Spec** §4-P2, RM2.1–2.8

## Objectif

La fonction pour laquelle on achète le produit. **Un seul double-booking en
production détruit la confiance de façon irréversible.**

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
