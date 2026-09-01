# D-001 — Vue restreinte des membres d'une box

**Phase** dette (P1-001 la rend bloquante) · **Estimation** 2 j·h · **Origine** P0-004

## Pourquoi

La policy de `public.users` est `id = auth.uid()` : personne ne voit personne
d'autre. En l'état, le `Class Roster` (P1-003, P1-008) et `Members List` (P1-001)
ne peuvent afficher aucun nom.

**Ne pas élargir la policy de `users`.** La rendre « visible aux pairs du même
tenant » exposerait `email`, `birthdate` et `gender` de chaque adhérent à tous les
autres. La minimisation vaut aussi à l'intérieur d'une box
(`.claude/rules/privacy.md`).

## Périmètre

- Vue (ou fonction `security definer`) exposant, pour les membres actifs du tenant
  courant : prénom, initiale du nom, `avatar_url` si consenti, rôle, statut.
- Jamais : e-mail, date de naissance, sexe, téléphone.
- Le coach voit le nom complet des membres de **ses** cours, pas de toute la box —
  à trancher au moment de l'implémentation, selon les besoins de la feuille de présence.

## Critères d'acceptation

- [x] Un membre ne peut pas obtenir l'e-mail d'un autre membre, par aucun chemin
      — ni par `users` (policy inchangée), ni par la vue (zéro ligne). Vérifié en
      pgTAP et en HTTP réel.
- [x] La policy de `public.users` reste `id = auth.uid()` — encodé en test :
      aucune policy de `users` ne mentionne `tenant_id` ni `current_tenant_ids`.
- [x] Un test pgTAP le prouve, dans les deux sens
      (`supabase/tests/member_directory_test.sql`, 12 assertions)

## Livré

`public.member_admin_directory` — `OWNER` et `MANAGER` seulement, e-mail compris
(la box est responsable de traitement, et l'import CSV de P1-001 en dépend).
`security_invoker = false` : son `WHERE` est la seule chose entre un membre et
`users` entière, d'où le commentaire et les tests qui vont avec.

Helper `current_admin_tenant_ids()`, sœur à garde de rôle de
`current_tenant_ids()`.

`rls_leak_test.sql` couvre désormais les vues : le parcours de catalogue était
restreint à `relkind = 'r'`, donc une vue posée sans filtre de tenant n'aurait
fait rougir aucun test **ni** atterri dans une liste d'exceptions. Deux contrôles
ajoutés : prédicat de tenant sur toute vue, prédicat de **rôle** sur celles qui
exposent `email`, `birthdate` ou `gender`.

**Hors périmètre initial, corrigé au passage** : `audit_logs` et
`ledger_entries` étaient protégées par tenant sans garde de rôle. Un simple
`MEMBER` lisait tout le journal d'audit de sa box — `diff jsonb` compris — et
toutes les écritures comptables, dont la somme est le chiffre d'affaires. C'est
la même question que celle du ticket, posée aux tables voisines.

**Défaut du seed trouvé en vérifiant** : `auth.users` était semé avec
`confirmation_token`, `recovery_token`, `email_change` et
`email_change_token_new` à `NULL`. GoTrue les lit dans des champs Go
non-nullables, si bien qu'**aucun compte du seed ne pouvait se connecter**
(500, « Database error finding user »). Resté invisible parce que les essais
manuels de P0-005a créaient leur compte par l'API. Corrigé.

## Reporté

La vue des **pairs** part en P1-003, avec la feuille d'inscrits qui la motive :
sans appelant, une vue au `WHERE` permissif est un passif que rien n'exerce. Sa
forme juste est « les gens que je croise », pas l'annuaire complet — les trois
décisions à prendre sont écrites dans les notes de `P1-003-reservation.md`.

Le `COACH` n'a volontairement aucun accès : son besoin est la feuille de **ses**
cours, ce que `bookings` permettra d'exprimer.
