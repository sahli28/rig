---
paths:
  - 'apps/web/app/api/**/*.ts'
  - 'packages/core/src/api/**/*.ts'
  - 'packages/core/src/supabase/**/*.ts'
---

# Règles API

> **Il n'y a pas encore de route handler** (ADR 0004) : les opérations livrées
> sont des fonctions Postgres appelées en RPC depuis le client. Ce fichier
> décrit donc deux choses — la forme que prendront les routes quand P1-003 les
> imposera, et **la règle du tenant actif, qui s'applique dès aujourd'hui aux
> appels directs**.

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
6. **Filtrer explicitement sur le tenant actif** — voir ci-dessous, c'est la règle
   la plus facile à oublier et la plus coûteuse.
7. Appeler la fonction SQL ou le repository. Pas de logique métier dans la route.
8. Journaliser toute action sensible via `public.log_audit(...)` — jamais un
   `insert` direct dans `audit_logs`, qui n'a pas de policy d'écriture. La
   fonction déduit l'acteur de `auth.uid()` : il n'y a pas de paramètre d'acteur,
   et c'est volontaire.
   **Le `diff` n'est pas filtré par la base** : n'y mettre ni donnée de santé, ni
   e-mail, ni rien que `privacy.md` interdise de journaliser. Le tri se fait ici.

## La RLS ne vous garde pas dans la box active

**Toute requête doit ajouter `.eq('tenant_id', activeTenantId)`.**

La RLS garantit que vous ne sortez pas des boxes **de l'utilisateur** ; elle ne
garantit pas que vous restez dans **la box active**. Un membre inscrit dans deux
boxes est un cas nominal du produit (ADR 0002) : sans ce filtre, les données de la
box A s'affichent dans l'interface de la box B.

Ce n'est pas une fuite inter-utilisateur, donc **aucun test pgTAP ne l'attrapera** —
tous les tests d'isolation passeront au vert pendant que l'écran ment. C'est la
classe de bug la plus probable de tout P1. Chaque route qui lit des données
tenant-scopées mérite un test avec un utilisateur multi-box.

```ts
// ✗ compile, passe la RLS, affiche les cours de l'autre box
const { data } = await supabase.from('classes').select();

// ✓
const { data } = await supabase.from('classes').select().eq('tenant_id', activeTenantId);
```

**Le filtre ne se laisse pas à la discipline de chaque appelant.** Il vit dans
`tenantScope()` (`packages/core/src/supabase/active-tenant.ts`), que tout accès
à une table de box doit traverser — route handler comme appel direct :

```ts
const scope = tenantScope(supabase, activeTenantId);
const { data } = await scope.select('classes'); // .eq('tenant_id', …) est posé
await scope.insert('classes', row); // tenant_id imposé, pas seulement suggéré
```

Le type n'accepte que les tables portant un `tenant_id` : `scope.select('users')`
ne compile pas, parce qu'il n'y aurait rien à filtrer. Un `supabase.from(…)` en
direct sur une table de box est à considérer comme un oubli de filtre jusqu'à
preuve du contraire.

## Erreurs venues de la base

Les fonctions SQL lèvent leur erreur avec un **code applicatif** dans le champ
`detail`, que PostgREST expose sous `details` (migration `app_error_codes`).
C'est nécessaire parce que le SQLSTATE ne discrimine pas : `check_violation`
couvre à lui seul l'invitation expirée, l'invitation déjà utilisée, la box
fermée, le dernier propriétaire et le quota atteint.

Côté client, un seul chemin correct :

```ts
try {
  await acceptInvitation(supabase, token);
} catch (error) {
  setErrorKey(errorMessageKeyOf(error)); // clé i18n, jamais le message brut
}
```

`packages/core/src/errors.ts` tient la table `code → clé i18n`, et un test relit
les migrations : un `app_error()` ajouté en SQL sans message côté client fait
échouer `pnpm test`.

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
