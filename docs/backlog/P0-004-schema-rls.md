# P0-004 — Schéma de base, RLS et test anti-fuite

**Phase** P0 · **Estimation** 6 j·h · **Dépend de** P0-001 · **Spec** §7.1–7.3, §11.1

## Objectif

Poser le socle multi-tenant. **C'est le ticket le plus important du projet** :
il n'est pas rétro-installable, et une erreur ici se paie sur toute la durée de vie
du produit.

## Périmètre

Tables : `tenants`, `tenant_settings`, `locations`, `rooms`, `themes`, `users`,
`memberships`, `invitations`, `consents`, `audit_logs`, `devices`,
`processed_webhook_events`, `ledger_entries`.

- `uuid_generate_v7()` comme génération d'identifiants.
- Fonction `auth_tenant_id()` qui lit le tenant courant depuis le JWT, jamais depuis
  un paramètre client.
- RLS `enable` + `force` sur toutes les tables métier, policies `select` et `all`
  avec `with check`.
- Trigger interdisant `update` et `delete` sur `ledger_entries`.
- Seed local : 2 tenants, 2 owners, 4 membres, pour rendre les fuites détectables.
- `supabase/tests/rls_leak_test.sql` : parcourt `information_schema.tables` et
  échoue si une table métier n'a pas `tenant_id`, RLS forcée, ou au moins une policy.

## Critères d'acceptation

- [ ] Une requête authentifiée du tenant A ne retourne **aucune** ligne du tenant B, sur toutes les tables
- [ ] Une tentative d'insertion dans le tenant B depuis une session du tenant A est refusée par `with check`
- [ ] Le rôle applicatif n'a ni `superuser` ni `bypassrls`
- [ ] Un `UPDATE` sur `ledger_entries` lève une exception
- [ ] `pnpm test:db` échoue si on ajoute une table sans policy (à démontrer par un test volontairement cassé, puis corrigé)
- [ ] Le sous-agent `rls-auditor` rend `VERDICT: SAFE`
- [ ] Les fonctions `security definer` fixent `search_path`

## Notes

Toutes les tables listées ci-dessus sont **créées** par ce ticket, mais elles ne sont
pas toutes tenant-scopées. `users` et `devices` sont globales (pas de `tenant_id`) ;
`consents` est hybride (`tenant_id` nullable, cf. `.claude/rules/database.md`).
Le test anti-fuite doit connaître ces trois cas et ne pas les signaler comme manquants.

Un utilisateur est **global** : une identité, plusieurs `memberships`.
S'inscrire dans une deuxième box ne crée pas de compte.
Passer ce ticket en plan mode et prendre le temps : c'est de l'irréversible.
