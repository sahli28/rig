---
paths:
  - 'apps/web/app/api/**/*.ts'
  - 'packages/core/src/api/**/*.ts'
---

# Règles API

## Structure d'un endpoint

Chaque route suit le même ordre, sans exception :

1. Parser et valider le body avec un schéma **Zod** de `packages/core/src/schemas`.
2. Résoudre la session (JWT) → `user_id`, `memberships`.
3. Résoudre le tenant depuis l'en-tête `X-Tenant-Id` et **le vérifier contre le JWT**.
   Un `tenant_id` client sans membership correspondante → `404`, jamais `403`
   (ne pas révéler l'existence d'une ressource d'un autre tenant).
4. Vérifier le rôle requis (`OWNER` / `MANAGER` / `COACH` / `MEMBER`).
5. Pour toute écriture financière ou de réservation : exiger `Idempotency-Key`,
   rejeter en `400` si absent, rejouer la réponse d'origine si la clé est connue.
6. Appeler la fonction SQL ou le repository. Pas de logique métier dans la route.
7. Journaliser dans `audit_logs` toute action sensible (rôles, argent, données membres).

## Erreurs

Format unique :

```json
{ "error": { "code": "CLASS_FULL", "message_i18n": { "fr": "...", "en": "..." }, "details": {} } }
```

Codes existants à réutiliser plutôt qu'à réinventer : `CLASS_FULL`,
`NO_VALID_ENTITLEMENT`, `BOOKING_WINDOW_CLOSED`, `CANCEL_WINDOW_PASSED`,
`ALREADY_BOOKED`, `MAX_UPCOMING_BOOKINGS_REACHED`, `QUOTA_EXCEEDED`,
`TENANT_NOT_FOUND`, `FORBIDDEN_ROLE`, `IDEMPOTENCY_KEY_REQUIRED`.

Codes HTTP : `402` pour droits insuffisants, `409` pour conflit métier
(cours complet, doublon), `422` pour validation, `404` pour cross-tenant.

## Webhooks Stripe

- Vérifier la signature `Stripe-Signature` **avant** toute lecture du corps.
- Insérer l'`event.id` dans `processed_webhook_events` ; si conflit, sortir en `200` sans retraiter.
- Écrire dans `ledger_entries` dans la même transaction que l'activation des droits.
- Ne jamais activer de droit depuis une route appelée par le client.
