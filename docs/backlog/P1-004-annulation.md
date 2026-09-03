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

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `bookings`, `book_class()`, le verrou de ligne | P1-003 | ✅ existe |
| `booking_status` avec la valeur `CANCELLED` | P1-003 | ✅ existe — posée d'avance, l'index unique partiel `where status = 'CONFIRMED'` en dépend |
| `cancel_window_minutes`, en heure locale de la box | `tenant_settings` (P0-004), `tenants.timezone` | ✅ existent |
| Le harnais de concurrence | `scripts/booking-concurrency.mjs` | ✅ existe — **à étendre**, voir ci-dessous |
| **Canal de notification** (« annuler un cours notifie tous les inscrits ») | P1-007, P2-015 | ❌ **n'existe pas.** Même blocage que P1-002 : l'écran d'annulation d'une occurrence le dit déjà à qui annule. Ce critère reste ouvert jusqu'à P1-007 |
| Liste d'attente, pour proposer la place libérée | P1-006 | ❌ à créer par P1-006 — le critère le dit déjà |
| Frais d'annulation tardive / no-show | S5, v1 | ❌ hors périmètre, et c'est écrit : ici la restitution est binaire |

## Deux choses à ne pas redécouvrir

**1. `CANCEL_WINDOW_PASSED` changera de liste.** Il vit aujourd'hui dans
`API_ERROR_CODES` de `packages/core/src/errors.ts` — le catalogue de ce que la
couche API rendra — parce qu'aucune fonction SQL ne le lève. `cancel_booking()`
le lèvera par `app_error()` : il devra donc **rejoindre `APP_ERROR_CODES`**.

C'est exactement ce qui est arrivé à `CLASS_FULL` et à cinq autres en P1-003, et
ça a cassé la CI. Le test le dira maintenant en clair — « déplacer
'CANCEL_WINDOW_PASSED' de API_ERROR_CODES vers APP_ERROR_CODES » — mais autant le
savoir avant de le lire.

Un cas de `errors.test.ts` s'appuie par ailleurs sur ce code **précisément parce
qu'il n'est pas encore levé en SQL** (« ne reconnaît que les codes de la base »).
Il faudra lui trouver un successeur : `QUOTA_EXCEEDED` ou `TENANT_NOT_FOUND`.

**2. La libération de place se prouve sous contention, comme la prise.** Le
verrou de ligne de `book_class()` protège l'incrément ; `cancel_booking()`
décrémente, et rien ne garantit encore que les deux ne se croisent pas. Le
scénario à écrire est **une annulation et une réservation simultanées sur la
dernière place** : la place doit finir prise une fois, ou libre, jamais comptée
deux fois. `scripts/booking-concurrency.mjs` a déjà le mécanisme de top de
départ commun — il lui manque ce scénario.

## Notes

Le calcul de fenêtre en heure locale est la source de bug classique. Test explicite autour du changement d'heure.
