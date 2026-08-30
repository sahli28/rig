# P1-002 — Planning récurrent (RRULE)

**Phase** P1 · **Estimation** 7 j·h · **Dépend de** P1-001 · **Spec** §4-P2, §6.2

## Périmètre

- `class_schedules` avec règle de récurrence RRULE (jour, heure, coach, salle, capacité).
- Matérialisation des occurrences dans `classes` par un job `pg_cron`, sur un horizon glissant de 8 semaines.
- Exceptions : cours annulé, coach remplacé, capacité modifiée sur une occurrence sans toucher la récurrence.
- Back-office : grille semaine, création récurrente, duplication d'une semaine, annulation d'un cours avec notification.
- Mobile : Schedule jour, filtres par type et par coach.

## Critères d'acceptation

- [ ] Créer « WOD, lundi au vendredi 18h30, salle principale, 16 places » génère 8 semaines d'occurrences
- [ ] Modifier la récurrence ne détruit pas les occurrences passées ni les réservations existantes
- [ ] Annuler une occurrence unique ne casse pas la série
- [ ] Le passage à l'heure d'hiver ne décale aucun cours (test explicite sur le dimanche de bascule)
- [ ] Dupliquer une semaine prend moins de 5 secondes
- [ ] Le planning mobile s'affiche hors ligne à partir du cache

## Notes

Ne pas stocker les occurrences à l'infini : horizon glissant, et purge des occurrences non réservées au-delà.
