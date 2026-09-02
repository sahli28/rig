# P1-002b — Planning mobile et cache hors ligne

**Phase** P1 · **Estimation** 3,5 j·h · **Dépend de** P1-002 · **Spec** §4-P2, §6.1

## Objectif

Un membre consulte le planning quotidien, filtre par type ou coach, et retrouve
la dernière version connue hors ligne. Le cache est un confort : la source de
vérité reste la base, et le jalon pilote privilégie d'abord le planning fiable.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `classes` matérialisées, et lecture membre | P1-002 | ❌ à créer par P1-002 |
| Types de cours, salles et coachs | P1-001b, P1-001c | ✅ existent |
| Application mobile ayant exécuté au moins une fois | P0-005a | ⚠️ jamais vérifiée sur appareil (`docs/REPRISE.md` §2) |
| Stockage persistant React Native | `apps/mobile` | ❌ à ajouter ici (`@react-native-async-storage/async-storage`), dépendance à justifier |
| Identité du membre et memberships | `me()` (P0-005a) | ✅ existent — nécessaires pour partitionner le cache |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| Écran mobile Schedule | le membre | celui-ci |
| Cache partitionné par `user_id` et `tenant_id` | l'écran Schedule | celui-ci |

## Périmètre

- Écran quotidien et filtres type / coach.
- Cache de la dernière réponse réussie, avec date de mise à jour visible.
- Clé de cache partitionnée par utilisateur **et** tenant ; invalidation à la
  déconnexion. Une clé tenant seule ferait voir à deux membres d'un téléphone
  partagé les données l'un de l'autre.
- Lecture réseau prioritaire ; repli sur cache seulement en cas d'échec réseau.

## Hors périmètre

- Écriture offline, réservation offline et synchronisation différée : P1-003
  interdit implicitement toute réservation hors de sa transaction PostgreSQL.
- Check-in offline : P1-008.

## Critères d'acceptation

- [ ] Un membre voit la journée, filtre par type et coach
- [ ] Sans réseau, le dernier planning chargé est consultable avec sa date de mise à jour
- [ ] Deux membres et deux boxes sur le même téléphone ne partagent jamais leur cache
- [ ] Une déconnexion supprime les caches du compte local
- [ ] Un appareil réel exerce le parcours ; Expo web seul ne coche pas le critère
