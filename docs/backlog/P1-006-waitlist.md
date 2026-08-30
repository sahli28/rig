# P1-006 — Liste d'attente et promotion automatique

**Phase** P1 · **Estimation** 6 j·h · **Dépend de** P1-004, P1-007 · **Spec** §4-P2, RM2.6

## Périmètre

- `waitlist_entries` avec position FIFO stricte, contrainte d'unicité par cours et membre.
- Fonction `promote_waitlist` appelée dans la transaction d'annulation.
- Fenêtre de confirmation : 60 min si le cours est à plus de 12 h, promotion automatique sinon.
- Promotion en cascade si la personne promue ne confirme pas.
- Écrans : Waitlist Position (position, estimation), notification de promotion, confirmation.

## Critères d'acceptation

- [ ] La promotion part en moins de 30 secondes après une annulation
- [ ] La personne promue a 60 min pour confirmer ; passé ce délai la place passe au suivant sans intervention
- [ ] Un cours à moins de 12 h promeut automatiquement sans exiger de confirmation
- [ ] Aucune place n'est perdue si toute la liste ignore la notification (retour en « place libre »)
- [ ] Quitter la liste d'attente réordonne correctement les positions
- [ ] Aucun droit n'est débité tant que la promotion n'est pas confirmée

## Notes

Le cas « personne ne confirme » est celui qui casse en production. Le tester en premier.
