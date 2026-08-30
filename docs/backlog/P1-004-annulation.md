# P1-004 — Annulation et fenêtres

**Phase** P1 · **Estimation** 4 j·h · **Dépend de** P1-003 · **Spec** RM2.4, RM2.7

## Périmètre

- Fonction PLpgSQL `cancel_booking` : transaction unique, libération de la place, restitution du droit selon la fenêtre.
- Fenêtre configurable par box (défaut 4 h), calculée en **heure locale de la box**.
- Feuille de confirmation explicite quand l'annulation est hors délai, avec la conséquence écrite avant validation.
- `DELETE /v1/bookings/{id}` idempotent.
- Annulation d'un cours entier par la box : notification à tous les inscrits, restitution automatique.

## Critères d'acceptation

- [ ] Annulation à J-4h01 : droit restitué. À J-3h59 : droit consommé
- [ ] La conséquence est affichée **avant** validation, jamais après
- [ ] La place libérée est immédiatement disponible (et proposée à la liste d'attente une fois P1-006 livré)
- [ ] Annuler un cours entier notifie tous les inscrits en moins de 60 secondes
- [ ] Aucune double restitution possible en cas de double appel

## Notes

Le calcul de fenêtre en heure locale est la source de bug classique. Test explicite autour du changement d'heure.
