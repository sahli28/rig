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

- [ ] Un membre ne peut pas obtenir l'e-mail d'un autre membre, par aucun chemin
- [ ] La policy de `public.users` reste `id = auth.uid()`
- [ ] Un test pgTAP le prouve, dans les deux sens
