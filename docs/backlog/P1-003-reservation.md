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
