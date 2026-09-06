# P1-006 — Liste d'attente et promotion automatique

**Phase** P1 · **Estimation** 6 j·h · **Dépend de** P1-004 ✅, **P1-007 🔒** · **Spec** §4-P2, RM2.6

> **Sa dépendance est partiellement bloquée.** `P1-007` ne peut pas exercer le
> push sur iOS sans compte développeur Apple (Expo Go ne le fait plus depuis le
> SDK 53). Ce ticket-ci n'est pas bloqué *techniquement* — une promotion peut
> s'écrire et se tester en SQL sans qu'aucune notification parte — mais son
> critère « la promotion part en moins de 30 secondes » suppose un destinataire
> qui la reçoit. À lire avant de le lancer : le blocage se transmet, il ne
> s'arrête pas à `P1-007`.

## Périmètre

- `waitlist_entries` avec position FIFO stricte, contrainte d'unicité par cours et membre.
- Fonction `promote_waitlist` appelée dans la transaction d'annulation.
- Fenêtre de confirmation : 60 min si le cours est à plus de 12 h, promotion automatique sinon.
- Promotion en cascade si la personne promue ne confirme pas.
- Écrans : Waitlist Position (position, estimation), notification de promotion, confirmation.
- **`waitlist_length` en temps réel, repris de `P1-005`.** Le périmètre de
  `P1-005` l'annonçait alors qu'aucune table de liste d'attente n'existait, et
  que `P1-006` — qui la livre — vient **après** lui dans l'ordre : un ticket ne
  peut pas dépendre de celui qui le suit. Déplacé ici le 6 septembre 2026, à la
  découpe de `P1-005`. Ce qui reste à faire alors est petit : `P1-005a` aura
  livré la publication `supabase_realtime` et le module d'abonnement ; il faudra
  y ajouter la source du compte, et **la publication de la nouvelle table**, qui
  ne s'ajoute pas toute seule.

## Critères d'acceptation

- [ ] La promotion part en moins de 30 secondes après une annulation
- [ ] La personne promue a 60 min pour confirmer ; passé ce délai la place passe au suivant sans intervention
- [ ] Un cours à moins de 12 h promeut automatiquement sans exiger de confirmation
- [ ] Aucune place n'est perdue si toute la liste ignore la notification (retour en « place libre »)
- [ ] Quitter la liste d'attente réordonne correctement les positions
- [ ] Aucun droit n'est débité tant que la promotion n'est pas confirmée

## Notes

Le cas « personne ne confirme » est celui qui casse en production. Le tester en premier.
