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

- [x] `delete from public.users` échoue pour `authenticated` **par les droits**,
      pas seulement par l'absence de policy
- [x] La suppression de compte via `auth.users` fonctionne toujours
      (`account_deletion_test.sql` vert)
- [x] L'inscription fonctionne toujours (trigger `on_auth_user_created`, exercé
      par le seed et par le parcours HTTP)
- [x] Un test le prouve pour chacune des trois tables append-only — et pour les
      treize, par un contrôle générique

## Le périmètre réel : tout le schéma, pas `users`

L'inventaire a montré que `anon` et `authenticated` détenaient `arwdDxtm` — soit
**tous** les droits — sur les treize tables. Dont `TRUNCATE`, que **la RLS
n'intercepte pas** (ce n'est pas une opération ligne à ligne) et que le trigger
append-only ne voit pas non plus (il est `before update or delete`).

Relevé avant correction : Léa, simple MEMBER qui ne peut même pas *lire*
`ledger_entries`, en a effacé les deux lignes — celles des deux boxes. `anon`,
sans aucune authentification, aussi. Balayage : les treize tables tronquables,
aucune refusée.

Pas exploitable à distance — PostgREST n'expose aucun verbe produisant un
`TRUNCATE`, et les deux rôles sont `NOLOGIN` — mais ce qui protégeait était
**l'absence de chemin**, pas un refus. Une couche, là où l'ADR 0002 en demande deux.

## Livré

- `revoke all on all tables ... from anon, authenticated`, puis réattribution du
  strict miroir des policies, table par table. `anon` ne reçoit rien : son seul
  besoin passe par `tenant_public_profile()`, `security definer`.
- **Privilèges par défaut du schéma retirés** : sans cela, la correction serait
  vraie aujourd'hui et fausse à la prochaine table. Conséquence assumée — toute
  nouvelle table pose ses `grant` avec ses policies.
- `rls_leak_test.sql` gagne l'invariant qui aurait tout attrapé : **droit accordé
  ⇔ policy correspondante**, huit privilèges × treize tables, sans liste
  d'exceptions. `truncate`, `references`, `trigger` et `maintain` n'ayant jamais
  de policy, ils ne peuvent jamais être accordés. Plus une assertion sur les
  privilèges par défaut, sans laquelle l'invariant serait temporaire.
- `role_isolation_test.sql` : contrôle comportemental, la contrepartie exacte de
  la sonde — sous un MEMBER puis sous `anon`, aucune table n'est tronquable.

## Deux pièges rencontrés, tous deux signalés par les tests

- **`revoke all on all tables` emporte les droits de colonne.** Le `grant update
  (first_name, …)` de P0-004 a sauté, et « un utilisateur édite bien son propre
  profil » a échoué. Il faut le réémettre.
- **`all tables` comprend les vues.** L'annuaire de D-001 a perdu son grant. Une
  vue n'a pas de policy : son grant est, avec son `WHERE`, tout ce qui la protège.

## Effet de bord sur les tests existants

Quatre tests prouvaient une garde en constatant qu'un ordre **n'affectait rien** :
la policy masquait la ligne, l'ordre passait en silence. Ils lèvent maintenant une
couche plus tôt, et ont été convertis en `throws_ok`. C'est un gain — un échec
bruyant plutôt qu'un succès trompeur pour un client buggé — mais il fallait le
noter : ces assertions ne prouvent plus la policy, devenue inatteignable depuis
`authenticated`. C'est le contrôle de correspondance qui s'en charge désormais.
