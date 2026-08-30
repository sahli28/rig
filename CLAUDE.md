# RIG — SaaS multi-tenant pour boxes CrossFit / Hyrox

Plateforme de réservation, programmation et coopération inter-box.
Spécification produit complète : `docs/spec/RIG-spec-produit-technique.md`
(~156 Ko : à ouvrir section par section quand un ticket la référence, jamais en entier).
Backlog exécutable : `docs/backlog/` — un fichier par ticket.

## Contexte de développement

- **Développeuse solo**, ~15–20 h/semaine. Optimise pour la maintenabilité par une seule personne, jamais pour l'élégance architecturale.
- Priorité produit : **CrossFit d'abord**, Hyrox en v1, réseau inter-box en v1.
- Phase courante : **P0 — Socle** (voir `docs/backlog/README.md`).
- Langues : FR + EN dès le premier écran. Marché : France / UE, RGPD applicable.

## Stack

| Couche           | Choix                                                                      | Note                                                                   |
| ---------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Monorepo         | Turborepo + pnpm                                                           | `apps/mobile`, `apps/web`, `packages/core`, `packages/ui`, `supabase/` |
| Mobile           | Expo (React Native) + expo-router + TypeScript                             | OTA updates activées                                                   |
| Web              | Next.js App Router + TypeScript                                            | back-office box + pages publiques SSR                                  |
| Données          | Supabase (Postgres 16, région **EU**) + RLS                                | migrations SQL versionnées dans `supabase/migrations/`                 |
| Logique critique | **fonctions PLpgSQL transactionnelles**                                    | réservation, annulation, crédits, waitlist                             |
| Paiement         | Stripe + **Connect Express**                                               | destination charges, jamais d'encaissement en propre                   |
| Validation       | Zod, schémas partagés dans `packages/core`                                 | une seule source de vérité mobile/web/API                              |
| Tests            | Vitest (unit), pgTAP (SQL/RLS), Playwright (web E2E), Maestro (mobile E2E) |                                                                        |

## Règles non négociables

1. **`tenant_id` sur toute table métier**, `NOT NULL`, RLS `FORCE` activée. Toute nouvelle table sans policy RLS = bug bloquant.
2. **Aucune décision d'autorisation côté client.** Le JWT et la RLS font foi ; un `tenant_id` envoyé par le client n'accorde jamais de droit.
3. **Réservation, annulation, débit de crédit : une seule transaction SQL** avec verrou de ligne. Jamais de lecture-puis-écriture en TypeScript.
4. **`Idempotency-Key` obligatoire** sur toute écriture financière ou de réservation.
5. **Argent en centimes entiers** (`amount_cents int`), jamais de float. Ledger `ledger_entries` **append-only** : pas d'UPDATE, pas de DELETE, seulement des contre-écritures.
6. **Le webhook Stripe est la source de vérité**, jamais le retour client. Les droits s'activent sur `invoice.paid` / `payment_intent.succeeded`.
7. **Zéro couleur en dur.** Tout passe par les design tokens alimentés par le thème du tenant (white-label).
8. **Zéro chaîne en dur.** Toute chaîne visible passe par i18n, clés en `fr.json` / `en.json`.
9. **Timestamps en `timestamptz` UTC**, fuseau du tenant stocké à part. Les règles métier (fenêtre d'annulation) se calculent en heure locale de la box.
10. **Pas de suppression physique** sur les entités métier : `deleted_at`. Exception : demande RGPD → anonymisation réelle.
11. **Aucune donnée de santé** (blessure, restriction médicale) dans les logs, les analytics ou les payloads partagés inter-box. Colonne isolée et chiffrée.
12. **UUID v7** pour tous les identifiants.

## Commandes

```bash
pnpm install            # installe le monorepo
pnpm dev                # web + mobile en parallèle
pnpm typecheck          # tsc sur tous les packages
pnpm lint               # eslint + prettier
pnpm test               # vitest
pnpm test:db            # tests pgTAP, dont le test anti-fuite inter-tenant
pnpm e2e:web            # Playwright
pnpm db:migrate         # applique les migrations Supabase en local
pnpm db:reset           # reset + seed local
```

`pnpm test:db` **doit** être vert avant tout commit touchant `supabase/`.

## Conventions de code

- TypeScript strict. Pas de `any`, pas de `@ts-ignore` sans commentaire justifiant.
- Nommage : fichiers en `kebab-case`, composants en `PascalCase`, tables et colonnes SQL en `snake_case`.
- Un fichier = une responsabilité. Au-delà de 300 lignes, découper.
- Les erreurs API sortent en `{ error: { code, message_i18n, details } }`. Le client réagit au `code`, jamais au texte.
- Toute fonction PLpgSQL a un test pgTAP correspondant dans `supabase/tests/`.
- Les composants UI vivent dans `packages/ui` s'ils sont partagés, sinon dans l'app.

## Workflow attendu de Claude Code

1. Un ticket à la fois, depuis `docs/backlog/`. Lire le ticket avant de coder.
2. **Plan mode d'abord** pour tout ticket touchant la base, l'argent ou l'auth. Attendre validation.
3. Écrire le test avant l'implémentation quand une règle métier est en jeu (règles 1 à 6 ci-dessus).
4. Lancer `/check` avant de proposer un commit.
5. Une branche par ticket : `feat/P0-003-rls-policies`. Jamais de commit direct sur `main`.
6. Si un choix contredit la spec, **le signaler** au lieu de l'appliquer silencieusement.

## Ce qu'il ne faut pas faire

- Ne pas ajouter de dépendance sans la justifier dans le message de commit.
- Ne pas introduire Redis, une file de messages ou un service séparé avant d'avoir un problème mesuré.
- Ne pas coder de champ carte bancaire : uniquement les SDK Stripe (Payment Sheet / Elements).
- Ne pas élargir le périmètre d'un ticket. Ce qui dépasse devient un nouveau ticket dans `docs/backlog/`.
