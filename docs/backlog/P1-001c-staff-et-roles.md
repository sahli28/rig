# P1-001c — Staff & Roles : annuaire, invitations, changement de rôle

**Phase** P1 · **Estimation** 2 j·h · **Dépend de** P1-001a, D-001, D-005 · **Spec** §5.2, §6.2

## Objectif

L'écran par lequel un propriétaire délègue : voir qui est dans sa box, inviter un
coach, changer un rôle, retirer quelqu'un.

**Ses deux dépendances sont déjà livrées** — c'était leur raison d'être. D-001 a
construit la vue `member_admin_directory`, D-005 la fonction
`create_invitation()`. Il ne reste que l'écran.

## Périmètre

- Annuaire : `member_admin_directory` (D-001), recherche, filtre par rôle et par
  statut.
- Invitations : `create_invitation(p_tenant_id, p_email, p_role, p_expires_in)`,
  liste des invitations en cours, révocation.
- Changement de rôle : `set_member_role()`, retrait : `remove_member()`.

## Ce que D-005 impose à l'écran

Les invitations ne se créent plus par `insert`. `create_invitation()` rend le
jeton **en clair une seule fois** ; la base n'en garde que l'empreinte SHA-256,
et il n'est récupérable par aucun chemin ensuite.

- **Afficher le jeton — ou le lien qui le porte — immédiatement**, avec un bouton
  de copie, et dire clairement qu'il ne sera plus affiché. Le motif est celui des
  clés d'API : montré une fois, perdu ensuite.
- **Pas de « réafficher »**, seulement « régénérer », qui invalide le précédent.
  Vaut aussi pour le QR mural d'affiliation : réimprimer une affiche, c'est
  émettre un nouveau QR et jeter les anciennes.
- La matrice de rôles est **dans la fonction**, pas dans l'écran : un MANAGER
  n'invite qu'aux rôles MEMBER et COACH, et reçoit `MANAGER_CANNOT_GRANT_ROLE`
  s'il essaie autre chose. L'écran masque l'option, la base la refuse — deux
  couches.
- `invited_by` est dérivé de la session : ne pas l'envoyer.

## Critères d'acceptation

- [ ] Un MANAGER invite un coach, pas un autre manager (spec §5.2)
- [ ] Le jeton d'invitation s'affiche une fois, avec sa mise en garde
- [ ] Une invitation se révoque ; une invitation expirée se voit comme telle
- [ ] Un changement de rôle passe par `set_member_role()`, jamais par un `update`
- [ ] Un OWNER ne peut pas se retirer lui-même s'il est le dernier propriétaire
