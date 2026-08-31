# D-006 — Défense en profondeur sur `public.users`

**Phase** dette · **Estimation** 0,5 j·h · **Origine** vérification manuelle des droits, P0-004

## Pourquoi

`authenticated` conserve les droits **table** `INSERT` et `DELETE` sur
`public.users`. Ce sont les policies absentes qui bloquent aujourd'hui — ça
fonctionne, c'est couvert par les tests, mais **la protection ne tient que sur une
seule couche**.

Or le garde-fou n°6 de `docs/adr/0002-multitenancy.md` demande explicitement la
défense en profondeur : « une faille applicative seule ne doit pas suffire ». Et
le scénario qu'on protège ici est celui du **compte à moitié supprimé** —
`public.users` détruit tandis que `auth.users` survit, les appartenances, les
appareils et les consentements partis en cascade, et la personne qui se
reconnecte sur un compte vidé.

## Périmètre

```sql
revoke insert, delete on public.users from authenticated;
```

Vérifier au préalable que cela ne casse ni la cascade depuis `auth.users` (les
actions référentielles s'exécutent sous le propriétaire, donc hors droits de
l'appelant) ni le trigger `handle_new_user` (`security definer`).

Même question à poser pour `consents`, `audit_logs` et `ledger_entries` : leurs
protections reposent aussi sur l'absence de policy.

## Critères d'acceptation

- [ ] `delete from public.users` échoue pour `authenticated` **par les droits**,
      pas seulement par l'absence de policy
- [ ] La suppression de compte via `auth.users` fonctionne toujours
- [ ] L'inscription fonctionne toujours (trigger `on_auth_user_created`)
- [ ] Un test le prouve pour chacune des trois tables append-only
