# P1-001 — Réglages box, salles et types de cours

**Phase** P1 · **Estimation** 4 j·h · **Dépend de** P0-005 · **Spec** §4-P1 (onboarding Owner), §6.2

> **Ticket archivé.** Il valait 11,5 j·h, pas 4 — voir « Découpage et
> ré-estimation » à la fin. Le travail vit désormais dans **P1-001a**
> (porte d'entrée, fusionné), **P1-001b** (réglages), **P1-001c** (staff),
> **P1-001d** (import CSV) et **P1-001e** (apparence). Les deux critères
> orphelins — assistant en 5 étapes et checklist de mise en route — sont
> partis en **P2-004**. Ce fichier reste pour la trace du raisonnement.

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

## Découpage et ré-estimation (décidé en P1-001a)

**L'estimation de 4 j·h est fausse.** Elle omettait trois choses :

1. **La porte d'entrée n'existait pas.** `apps/web` n'avait aucun écran de
   connexion — P0-005a avait livré les écrans du mobile et la tuyauterie de
   session web, jamais la porte. Sortie en **P1-001a** (~2,5 j·h), livrée : la
   connexion par lien, la coquille, la box active dans l'URL, et le choix de la
   base de composants web (ADR 0005), lui non plus jamais fait.
2. **`class_types` n'existe pas en base.** Il y a donc une migration, avec ses
   policies, ses droits de table (D-006) et ses tests.
3. **L'import CSV vaut 2 à 3 j·h à lui seul.** 200 lignes, mapping de colonnes
   assisté, prévisualisation, détection de doublons, et « rien ne se crée en cas
   d'erreur bloquante » — c'est une transaction et un écran à part entière.

Le reste se coupe en trois, à ouvrir dans cet ordre :

| Ticket | Contenu | j·h |
| --- | --- | ---: |
| **P1-001b** | `class_types` + Box Settings : infos, horaires, salles, règles de réservation | 3 |
| **P1-001c** | Staff & Roles : annuaire (`member_admin_directory`, D-001), invitations (`create_invitation`, D-005), changement de rôle | 2 |
| **P1-001d** | Import CSV de membres | 3 |

Les deux dépendances de P1-001c sont déjà livrées : D-001 a construit l'annuaire
administratif, D-005 l'API d'invitation. C'était leur raison d'être.
