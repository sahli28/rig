# P1-009 — Sélecteur de box (mobile)

**Phase** P1 · **Estimation** 1,5 j·h · **Dépend de** P0-005a ✅ · **Spec** §6.1

## Objectif

Une personne membre de deux boxes peut passer de l'une à l'autre. Aujourd'hui
elle est **enfermée dans la première qu'elle touche**, jusqu'à se déconnecter.

## Le défaut, tel qu'il se produit

`apps/mobile/app/(app)/index.tsx:47` n'affiche la liste des boxes que si
`activeTenantId === null`. Or rien ne remet cette valeur à `null` en dehors de
`signOut()` : `setActiveTenant()` l'écrit dans le trousseau
(`lib/session.tsx:125`), et au lancement suivant `chooseActiveTenant()` la relit.
Le choix est donc définitif.

Trouvé par la passe du 3 septembre 2026, avec la seule fixture concernée :
**Julie est membre de Rueil et de Nanterre**, et le seed n'a que celle-là. Une
box pilote n'ayant qu'une box, ce défaut ne se serait pas manifesté avant la
première personne inscrite dans deux salles.

`setActiveTenant()` est donc un demi-appelant (règle 7) : elle a un appel, sur
un chemin qu'on ne repasse jamais.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `me().memberships` — toutes les appartenances actives | P0-005a | ✅ existe, déjà lu par l'écran d'accueil |
| `setActiveTenant(tenantId)` — persiste et recharge `me()` | `lib/session.tsx:125` | ✅ existe, et **c'est l'appelant qui manque** |
| `chooseActiveTenant()` — la préférence mémorisée | `@rig/core/supabase` | ✅ existe |
| Un composant de liste sélectionnable | `@rig/ui/native` — `ListRow`, `Sheet` | ✅ existent tous les deux |
| Un endroit dans la navigation où loger l'entrée | `apps/mobile` | ⚠️ l'accueil n'a ni en-tête utile ni menu de compte. **Voir D-009** : l'en-tête de la pile est celui d'expo-router par défaut, et il faut d'abord le reprendre |
| Le cache du planning, partitionné par box | P1-002b | ❌ n'existe pas encore — et **changer de box devra le vider** (contrainte inscrite dans P1-002b) |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| L'écran ou la feuille de sélection | le membre multi-box | celui-ci |
| Le second appelant de `setActiveTenant()` | idem | celui-ci |

## Périmètre

- Une entrée visible **seulement si `memberships.length > 1`** : une personne
  d'une seule box n'a rien à choisir, et un sélecteur à une ligne est du bruit.
- La liste montre le nom de la box et son slug, la box active est marquée.
- Choisir recharge `me()` pour la nouvelle box — thème, fuseau, règles — et
  **vide tout cache partitionné par box** (P1-002b).
- Le libellé et l'état vide passent par i18n, comme le reste.

## Hors périmètre

- **Rejoindre une seconde box** depuis le mobile : c'est le parcours
  d'invitation (P0-005a) ou `accept_pending_invitation()` (P1-001d), pas ce
  sélecteur.
- Le sélecteur **web** : le back-office porte la box dans l'URL
  (`/box/[slug]/…`, ADR 0002), donc changer de box y est une navigation. Rien à
  construire.
- Quitter une box : `leave_tenant()` existe, l'écran est P2-002.

## Critères d'acceptation

- [ ] Julie (`julie@example.com`, membre de Rueil **et** Nanterre) passe de
      l'une à l'autre et revient, sans se déconnecter
- [ ] Le thème, le nom et le fuseau affichés changent avec la box
- [ ] Une personne d'une seule box ne voit aucun sélecteur
- [ ] Le choix survit à la fermeture complète de l'app
- [ ] Vérifié sur appareil réel — c'est un parcours, pas une fonction

## Notes

**Le hors-périmètre de P0-005a disait « Box Switcher : une box pilote est une
box ».** C'était vrai du jalon, et faux de la fixture : le seed porte Julie dans
deux boxes depuis P0-004, précisément pour que les tests d'isolation aient un cas
multi-box. Le produit a donc une personne à qui il ne sait pas répondre, et c'est
le seed qui le dit.

La spec §6.1 le classe en P1. Il n'est pas bloquant pour le jalon pilote — une
seule box y participe — et c'est pourquoi il reste **après** la chaîne
D-009 → P1-002b → P1-003b plutôt que devant.
