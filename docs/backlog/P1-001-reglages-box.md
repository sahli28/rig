# P1-001 — Réglages box, salles et types de cours

**Phase** P1 · **Estimation** 4 j·h · **Dépend de** P0-005 · **Spec** §4-P1 (onboarding Owner), §6.2

## Périmètre

- Assistant d'onboarding box en 5 étapes : infos, horaires d'ouverture, salles, types de cours, règles de réservation.
- `class_types` (nom i18n, durée, couleur, capacité par défaut), `locations`, `rooms`.
- Règles de réservation par box : `open_days_before`, `close_minutes_before`, `cancel_window_minutes`, `max_upcoming_bookings`, `visitor_capacity`.
- Back-office web : Box Settings, Staff & Roles, invitations de coachs.
- Import CSV de membres avec mapping de colonnes assisté et prévisualisation.

## Critères d'acceptation

- [ ] Une box se configure entièrement en moins de 45 minutes sans aide
- [ ] Le fuseau horaire de la box est stocké et utilisé pour toutes les règles
- [ ] L'import CSV traite 200 membres, signale les doublons et les lignes invalides sans rien créer en cas d'erreur bloquante
- [ ] Une checklist de mise en route persiste sur le dashboard avec son taux de complétion
- [ ] Un `MANAGER` peut inviter un coach, pas un autre manager

## Notes

L'import CSV n'est pas un confort : sans lui, aucune box existante ne migrera (spec §19, R3).

## Ce que D-005 impose à l'écran d'invitations

Les invitations ne se créent plus par `insert` : la porte est
`public.create_invitation(p_tenant_id, p_email, p_role, p_expires_in)`, qui rend
le jeton **en clair une seule fois**. La base n'en garde que l'empreinte
SHA-256 ; il n'est récupérable par aucun chemin ensuite.

Conséquences pour l'écran :

- **Afficher le jeton — ou le lien qui le porte — immédiatement**, avec un bouton
  de copie, et dire clairement qu'il ne sera plus affiché. Le motif est celui des
  clés d'API : montré une fois, perdu ensuite.
- **Pas de « réafficher »**, seulement « régénérer », qui invalide le précédent.
  Vaut aussi pour le QR mural d'affiliation : réimprimer une affiche, c'est
  émettre un nouveau QR et jeter les anciennes affiches.
- La matrice de rôles est dans la fonction, pas dans l'écran : un `MANAGER`
  n'invite qu'aux rôles `MEMBER` et `COACH`, et reçoit
  `MANAGER_CANNOT_GRANT_ROLE` s'il essaie autre chose. L'écran masque l'option,
  la base la refuse — deux couches.
- `invited_by` est dérivé de la session : ne pas l'envoyer.
