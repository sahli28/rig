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

**Fusionné le 11 septembre 2026 (PR #80).** Cinq critères sont prouvés en CI par
pgTAP (`supabase/tests/waitlist_test.sql`, 37 assertions) ; le sixième — la
latence de la promotion — est un **critère d'appareil**, `[~]` derrière la passe
iPhone de `P1-007`. Forme d'annotation : celle de `P1-005a`.

- [~] **La promotion part en moins de 30 secondes après une annulation** — le
      versant SQL est **synchrone** : `cancel_booking` promeut sous le verrou et
      appelle `kick_push_emitter` dans la même transaction. Le « < 30 s » mesure
      la **livraison du push sur l'appareil**, et ne se prouve qu'à la passe
      iPhone de `P1-007` (émetteur déployé et servi — `P1-017`)
- [x] **60 min pour confirmer, sinon la place passe au suivant sans
      intervention** — scénarios 2 et 4 de `waitlist_test.sql` : l'offre porte
      `expires_at = +60 min` ; passé le délai, `expire_waitlist_offers` la marque
      `EXPIRED` et cascade au suivant
- [x] **Un cours à moins de 12 h promeut d'office** — scénario 3 : à `< 12 h`
      l'entrée passe `ACCEPTED`, une réservation confirmée existe, et le siège est
      **transféré** (`booked_count` inchangé), sans fenêtre de confirmation
- [x] **Aucune place perdue si toute la file ignore l'offre (retour en place
      libre)** — le scénario *flagship* (celui qui casse en prod, testé en
      premier) : offre → cascade → file épuisée → `booked_count` retombe à 0, la
      place redevient réservable, **et aucune réservation n'a été créée en chemin**
- [x] **Le rang affiché reste correct après un départ, sans réécrire de ligne
      sœur** — *critère reformulé.* L'original disait « quitter réordonne les
      positions » ; **il n'est plus vrai à la lettre**, et le laisser inviterait à
      le cocher à tort ou à le rouvrir à tort. La conception a changé : la
      `position` est une **clé immuable**, le rang est **dérivé** par
      `my_waitlist_rank` (compte des entrées actives devant soi). Quitter passe
      l'entrée à `LEFT` sans toucher **aucune** autre ligne — donc rien à
      réordonner, et pas de course entre renumérotations concurrentes. Prouvé par
      les rangs dérivés (Julie 1re, Hugo 2e ; réservée → `null` ; autre box →
      `null`)
- [x] **Aucun droit débité tant que la promotion n'est pas confirmée** — le siège
      est tenu par `booked_count`, **aucune `booking` n'est créée pendant l'offre**
      (flagship : « aucune réservation créée en chemin — aucun débit »). Le point
      de débit (P2-007, à venir) est la création de la réservation, à la
      confirmation ou à l'auto-book, jamais à l'offre

## Décisions tranchées, à ne pas re-litiger

**Le plafond `max_upcoming_bookings` ne mord pas à la confirmation d'une offre.**
Il est vérifié à `join_waitlist` et à l'auto-book (`< 12 h`), **pas** à
`confirm_promotion` : une personne au plafond (p. ex. 3 réservations à venir) qui
reçoit une offre (`≥ 12 h`) peut la confirmer et **passer à 4**. C'est **voulu** —
on honore une offre déjà émise plutôt que de la lui retirer après l'avoir promise.
La décision ne vivait que dans un commentaire de migration
(`supabase/migrations/20260911101100_waitlist_functions.sql:88`) ; elle est écrite
ici parce qu'un commentaire de fonction ne se relit pas — **amendement à RM2.5**.

## Notes

Le cas « personne ne confirme » est celui qui casse en production. Le tester en
premier — c'est le scénario *flagship* de `waitlist_test.sql`.

**Défaut ouvert à la relecture de clôture → `D-027`.** `confirm_promotion` sur un
cours **annulé par la box** (entrée passée à `CLASS_CANCELLED`) tombe dans la
branche générique et répond « Cette offre a expiré. La place est passée au
suivant. » — faux, et générateur d'un message au support.
