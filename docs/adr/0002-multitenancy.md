# ADR 0002 — Modèle de multi-tenancy

**Date** 2026-08-30 · **Statut** accepté

## Contexte

Chaque box est un tenant. Les données ne doivent jamais se croiser. Une seule
personne maintient les migrations.

## Décision

Base unique, colonne `tenant_id` sur toute table métier, isolation par Row Level
Security Postgres avec `force row level security`.

## Alternatives écartées

- **Un schéma par tenant** : isolation supérieure, mais N migrations à chaque
  changement. Ingérable seule dès 50 boxes.
- **Une base par tenant** : réservé à une exigence contractuelle grand compte.

## Garde-fous non négociables

1. RLS activée et forcée sur toutes les tables métier.
2. Le `tenant_id` vient du JWT via `auth_tenant_id()`, jamais d'un paramètre client.
3. Test automatisé anti-fuite bloquant en CI, itérant sur toutes les tables.
4. Le rôle applicatif n'est ni `superuser` ni `bypassrls`.
5. Les jobs de fond fixent explicitement leur tenant de contexte.
6. Défense en profondeur : RBAC applicatif **et** RLS. Une faille applicative seule
   ne doit pas suffire à faire fuiter un tenant.

## Conséquences

Toute nouvelle table est un moment à risque. D'où le sous-agent `rls-auditor`
et le hook qui protège les migrations déjà appliquées.
