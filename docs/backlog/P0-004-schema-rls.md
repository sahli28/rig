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
- Fonction `current_tenant_ids()` qui dérive les tenants autorisés de l'identité
  du JWT, jamais d'un paramètre client. (Remplace `auth_tenant_id()`, initialement
  prévue : un claim `tenant_id` imposerait de réémettre le jeton à chaque
  changement de box — voir l'amendement de `docs/adr/0002-multitenancy.md`.)
- RLS `enable` + `force` sur toutes les tables métier, policies `select` et `all`
  avec `with check`.
- Trigger interdisant `update` et `delete` sur `ledger_entries`.
- Seed local : 2 tenants, 2 owners, 4 membres, pour rendre les fuites détectables.
- `supabase/tests/rls_leak_test.sql` : parcourt `information_schema.tables` et
  échoue si une table métier n'a pas `tenant_id`, RLS forcée, ou au moins une policy.

## Critères d'acceptation

- [x] Une requête authentifiée du tenant A ne retourne **aucune** ligne du tenant B, sur toutes les tables
      — `tenancy_test.sql`, 19 assertions couvrant les 13 tables
- [x] Une tentative d'insertion dans le tenant B depuis une session du tenant A est refusée par `with check`
- [x] Le rôle applicatif n'a ni `superuser` ni `bypassrls` — `roles_test.sql`
- [x] Un `UPDATE` sur `ledger_entries` lève une exception — et sur `audit_logs` aussi,
      ajouté en cours de ticket : un journal d'audit modifiable ne prouve rien
- [x] `pnpm test:db` échoue si on ajoute une table sans policy
      — **démontré** : table sans policy ajoutée en base, les 4 contrôles du test
      structurel échouent en la nommant, table retirée, suite de nouveau verte
- [ ] Le sous-agent `rls-auditor` rend `VERDICT: SAFE` — **non atteint après cinq passes.**
      Les deux dernières ne trouvent plus aucune fuite inter-tenant ni élévation
      de privilège : l'isolation est confirmée intacte et re-testée en profondeur.
      Ce qu'elles trouvent, ce sont des **régressions fonctionnelles introduites
      par mes propres correctifs** (inscription impossible, rectification d'adresse
      bloquée, preuve de consentement détruite par cascade) — toutes corrigées et
      couvertes par des tests. Une sixième passe reste à lancer pour statuer.
- [x] Les fonctions `security definer` fixent `search_path` — les 8, vérifié par l'auditeur

## Notes

Toutes les tables listées ci-dessus sont **créées** par ce ticket, mais elles ne sont
pas toutes tenant-scopées. `users` et `devices` sont globales (pas de `tenant_id`) ;
`consents` est hybride (`tenant_id` nullable, cf. `.claude/rules/database.md`).
Le test anti-fuite doit connaître ces trois cas et ne pas les signaler comme manquants.

Un utilisateur est **global** : une identité, plusieurs `memberships`.
S'inscrire dans une deuxième box ne crée pas de compte.
Passer ce ticket en plan mode et prendre le temps : c'est de l'irréversible.

### Ce que le ticket a livré au-delà de son périmètre, et pourquoi

- **`create_tenant()` et `accept_invitation()`.** Sans elles, aucune appartenance
  n'est créable : un `with check` d'appartenance sur `memberships` rend la
  première ininsérable. Le schéma aurait été livré inutilisable.
- **`tenant_public_profile(slug)`**, exposée à `anon`. Les policies étant réservées
  à `authenticated`, l'écran de bienvenue brandé de P0-005 — « affiche le logo et
  la couleur de la box **avant** connexion » — n'aurait pas pu charger.
- **Garde de rôle sur `memberships` et `invitations`.** Prévue pour « la matrice de
  permissions », donc pour plus tard. À tort : sans elle, un `MEMBER` exécutait
  `update memberships set role='OWNER'` et prenait la box. La table qui *porte*
  l'autorisation ne peut pas attendre.
- **Clés étrangères composites** `(id, tenant_id)`. Une FK simple laissait une
  salle de la box A référencer une adresse de la box B ; un `on delete cascade`
  côté B aurait alors détruit des lignes de A.

### Décision — `users` reste invisible aux pairs

Un coach ne peut lire le nom d'aucun de ses membres : la policy est
`id = auth.uid()`. Le `Class Roster` (P1-003, P1-008) et `Members List` (P1-001)
ne pourront donc rien afficher en l'état. **C'est délibéré.**

La policy « visible aux pairs du même tenant » qui vient naturellement à l'esprit
exposerait `email`, `birthdate` et `gender` de chaque membre à **tous** les autres
membres de la box, simples adhérents compris. C'est une violation de la
minimisation RGPD pour un besoin qui se satisfait de bien moins.

La forme à construire en P1-001 : une **vue restreinte** — prénom, initiale du
nom, avatar si consenti — plutôt qu'un accès direct à `public.users`. C'est déjà
la règle du partage inter-box (`.claude/rules/privacy.md`) ; elle vaut aussi à
l'intérieur d'une box.

### Dette laissée par ce ticket

- Un membre ne peut pas quitter sa box lui-même : l'écriture sur `memberships`
  est réservée à OWNER/MANAGER. Il faudra une fonction `leave_tenant()`.
- Le resserrement du rôle ne couvre que `memberships` et `invitations`. Les
  tables sensibles à venir — `payments`, notes de coach — devront faire entrer
  le rôle dans leur propre prédicat, pas s'en remettre à l'API.
- pgTAP est installée par migration, donc aussi en production. Compromis assumé
  pour une suite de tests exécutable à l'identique partout ; à réévaluer le jour
  où une base de production existe.
- `public.users.id` est un UUID v4 imposé par `auth.users`, là où tout le reste
  du schéma utilise `uuid_generate_v7()`.
