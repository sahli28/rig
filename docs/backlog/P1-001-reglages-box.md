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
