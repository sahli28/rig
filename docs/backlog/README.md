# Backlog exécutable

Un fichier par ticket. Un ticket = une session Claude Code = une branche = un commit.
On lance un ticket avec `/ticket P0-001`.

## Convention

- `P0-*` — Socle (M1→M2, ~20 j·h)
- `P1-*` — v0 pilote (M3→M6, ~42 j·h) — objectif : une box réelle réserve en production
- `P2-*` — MVP vendable (M7→M11, ~45 j·h) — paiement, programmation, stores
- `P3-*` — v1 (M12→M20) — Hyrox, réseau inter-box

Estimations en **jours-homme de 7 h effectives**. À 15–20 h/semaine, compter
~2,3 j·h par semaine.

## Ordre recommandé

```
P0-001 → P0-002 → P0-003 → P0-004 → P0-005        (socle, rien de visible)
P1-001 → P1-002 → P1-003 → P1-004 → P1-005        (planning et réservation)
P1-007 → P1-006 → P1-008                          (push, waitlist, check-in)
                     ↓
        ═══ JALON : mise en production chez la box pilote ═══
```

Le jalon compte plus que la complétude. Une v0 imparfaite en production vaut
mieux qu'un MVP parfait au mois 13.

## État

| Ticket | Titre                                |    j·h | Statut               |
| ------ | ------------------------------------ | -----: | -------------------- |
| P0-001 | Monorepo, CI, outillage              |      3 | ✅ fusionné (PR #2)  |
| P0-002 | Design tokens et thème tenant        |      4 | ✅ fusionné (PR #1)  |
| P0-003 | i18n FR/EN                           |      2 | ✅ fusionné (PR #3)  |
| P0-004 | Schéma de base, RLS, test anti-fuite |      6 | 🔨 en cours          |
| P0-005 | Authentification et session          |      5 | à faire              |
| P1-001 | Réglages box, salles, types de cours |      4 | à faire              |
| P1-002 | Planning récurrent (RRULE)           |      7 | à faire              |
| P1-003 | Réservation transactionnelle         |      8 | à faire              |
| P1-004 | Annulation et fenêtres               |      4 | à faire              |
| P1-005 | Places restantes en temps réel       |      3 | à faire              |
| P1-006 | Liste d'attente et promotion         |      6 | à faire              |
| P1-007 | Notifications push                   |      4 | à faire              |
| P1-008 | Check-in QR et mode kiosque          |      6 | à faire              |
|        | **Total jusqu'au jalon pilote**      | **62** |                      |

### Dette convertie en tickets

`CLAUDE.md` dit « ce qui déborde devient un nouveau ticket ». La dette accumulée
dans les tickets clos y échappait : un ticket clos ne se relit pas.

| Ticket | Titre                                          | j·h | Origine |
| ------ | ---------------------------------------------- | --: | ------- |
| D-001  | Vue restreinte des membres d'une box           |   2 | P0-004  |
| D-002  | Tests de rendu des composants                  |   2 | P0-002  |
| D-003  | SSR de l'i18n pour les pages publiques         |   2 | P0-003  |
| D-004  | Persistance mobile de la langue                |   1 | P0-003  |
| D-005  | Empreintes des jetons d'invitation             |   1 | PR #4   |
