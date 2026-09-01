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
P0-001 → P0-002 → P0-003 → P0-004                 (socle, rien de visible)
P0-005a → P0-005b                                 (connexion, puis SSO)
P1-001 → P1-002 → P1-003 → P1-004 → P1-005        (planning et réservation)
P1-007 → P1-006 → P1-008                          (push, waitlist, check-in)
                     ↓
        ═══ JALON : mise en production chez la box pilote ═══
                     ↓
P2-002 → P2-003                                   (RGPD, Apple — avant les stores)
```

**P2-003 (Sign in with Apple) bloque la publication**, pas le pilote. Son prérequis
est administratif — compte développeur Apple, 99 $/an, délai d'enrôlement variable —
et c'est le seul élément du chemin critique dont le délai ne se rattrape pas :
l'inscription se lance dès maintenant, pas au moment du ticket.

Le jalon compte plus que la complétude. Une v0 imparfaite en production vaut
mieux qu'un MVP parfait au mois 13.

## État

| Ticket | Titre                                |    j·h | Statut               |
| ------ | ------------------------------------ | -----: | -------------------- |
| P0-001 | Monorepo, CI, outillage              |      3 | ✅ fusionné (PR #2)  |
| P0-002 | Design tokens et thème tenant        |      4 | ✅ fusionné (PR #1)  |
| P0-003 | i18n FR/EN                           |      2 | ✅ fusionné (PR #3)  |
| P0-004 | Schéma de base, RLS, test anti-fuite |      6 | ✅ fusionné (PR #4)  |
| P0-005a | Se connecter — code, session, `me()` |      6 | ✅ fusionné (PR #6) — reste la passe sur appareil |
| P0-005b | SSO Google et linking d'identités    |      4 | à faire              |
| P1-001 | Réglages box, salles, types de cours |      4 | à faire              |
| P1-002 | Planning récurrent (RRULE)           |      7 | à faire              |
| P1-003 | Réservation transactionnelle         |      8 | à faire              |
| P1-004 | Annulation et fenêtres               |      4 | à faire              |
| P1-005 | Places restantes en temps réel       |      3 | à faire              |
| P1-006 | Liste d'attente et promotion         |      6 | à faire              |
| P1-007 | Notifications push                   |      4 | à faire              |
| P1-008 | Check-in QR et mode kiosque          |      6 | à faire              |
|        | **Total jusqu'au jalon pilote**      | **67** |                      |

Le total passe de 62 à 67 j·h : P0-005 était estimé 5, l'inventaire en a montré
~17, dont 8 déplacés en P2. Ce qui reste avant le jalon pilote est donc 10, pas 5.

### Avant la publication sur les stores

| Ticket | Titre                                   | j·h | Pourquoi pas avant |
| ------ | --------------------------------------- | --: | ------------------ |
| P2-002 | Droits RGPD en self-service             |   5 | Obligation légale, pas préalable à la connexion. Conditionné à `docs/procedures/effacement-manuel.md` pendant le pilote. |
| P2-003 | Sign in with Apple                      |   3 | Bloquant de publication. Prérequis administratif à lancer dès maintenant. |

### Dette convertie en tickets

`CLAUDE.md` dit « ce qui déborde devient un nouveau ticket ». La dette accumulée
dans les tickets clos y échappait : un ticket clos ne se relit pas.

| Ticket | Titre                                          | j·h | Origine |
| ------ | ---------------------------------------------- | --: | ------- |
| D-001  | Vue restreinte des membres d'une box           |   2 | P0-004 — ✅ fait, débloque P1-001 |
| D-002  | Tests de rendu des composants                  |   2 | P0-002  |
| D-003  | SSR de l'i18n pour les pages publiques         |   2 | P0-003  |
| D-004  | Persistance mobile de la langue                |   1 | P0-003  |
| D-005  | Empreintes des jetons d'invitation             |   1 | PR #4 — ✅ fait, prérequis de P1-001 |
| D-006  | Défense en profondeur sur `public.users`       | 0,5 | P0-004 — ✅ fait (périmètre réel : tout le schéma) |
| D-007  | Contraste de la page de démo                   | 0,25 | P0-002 |
| D-008  | Lien d'invitation qui survit à l'installation  | 1,5 | P0-005a |

D-004 n'est plus bloquée : elle attendait un profil serveur, que P0-005a livre.
`users.locale` est désormais écrit à l'inscription ; ce qui manque est la lecture
au démarrage.
