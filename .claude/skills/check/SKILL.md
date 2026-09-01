---
name: check
description: Porte de vérification avant commit — types, lint, tests, isolation multi-tenant, i18n, tokens de thème.
disable-model-invocation: false
---

Exécute la porte de vérification, dans cet ordre, et arrête-toi au premier échec
en expliquant la cause avant de corriger.

## Automatique

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm test:db` — inclut le test anti-fuite inter-tenant. **Échec ici = blocage absolu.**

## Manuel — sur le diff courant uniquement (`git diff`)

5. **Couleurs en dur** : cherche `#[0-9a-fA-F]{3,8}`, `rgb(`, `rgba(` dans
   `apps/**` et `packages/ui/**`. Toute occurrence hors fichier de thème est un échec.
6. **Chaînes en dur** : tout texte visible dans un composant qui ne passe pas par `t(`.
7. **Parité i18n** : toute clé ajoutée dans `fr.json` existe dans `en.json`, et l'inverse.
8. **Argent** : aucun `parseFloat`, `toFixed`, `*100` ou `/100` sur un montant
   dans le diff. Les montants sont des entiers de centimes.
9. **Tenant** : toute nouvelle table a `tenant_id`, RLS forcée, policies, index —
    **et ses `grant` explicites**. Les privilèges par défaut du schéma ont été
    retirés à `anon` et `authenticated` (D-006) : sans grant, la table est
    inaccessible, ce qui est le bon défaut mais se diagnostique mal si on
    l'ignore. `pnpm test:db` confronte droits et policies dans les deux sens.
9bis. **Box active** : `pnpm lint` refuse déjà tout `.from('<table de box>')` hors
    `packages/core/src/supabase/` (règle `no-restricted-syntax` dans
    `eslint.config.mjs`). Ce qu'il reste à faire à la main, parce qu'aucune règle
    ne le voit : quand le diff **ajoute une fonction** dans ce dossier, vérifier
    qu'elle filtre bien sur la box active. La règle garantit le passage par la
    porte, pas ce qu'on fait une fois entré. Rappel : la RLS ne garde pas dans la
    box active, et aucun test pgTAP ne peut attraper cette confusion.
9ter. **Opérations sœurs** : voir `.claude/rules/database.md`. Toute protection
    ajoutée sur une opération doit être confrontée à ses jumelles —
    `insert`/`update`/`delete`, la table et sa jointure, la fonction et le
    trigger qui l'appelle. Trois trous sur trois depuis P0-004 avaient cette forme.
10. **Idempotence** : toute nouvelle route d'écriture financière ou de réservation
    exige et persiste une `Idempotency-Key`.
11. **Secrets** : aucune clé, token ou URL de connexion dans le diff.
12. **Clé de service** : `SUPABASE_SERVICE_ROLE_KEY` (et tout `service_role`)
    contourne l'intégralité de la RLS. Cherche-la dans tout le dépôt : elle ne
    doit apparaître que dans `apps/web/**/server/**` ou un fichier serveur
    explicitement commenté comme tel. Toute occurrence dans `apps/mobile/**`,
    dans un composant `'use client'`, ou dans `packages/**` est un **échec
    bloquant** — une règle qu'on ne peut pas oublier vaut mieux qu'une règle écrite.
13. **Santé et PII** : aucune donnée de santé dans un log, un événement analytics
    ou un payload cross-box.

## Sortie

Un tableau `contrôle | résultat | détail`. Puis `CHECK: PASS` ou `CHECK: FAIL`
avec la liste ordonnée de ce qu'il faut corriger. En cas de `FAIL`, ne propose
pas de commit.
