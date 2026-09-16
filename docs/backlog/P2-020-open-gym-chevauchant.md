# `P2-020` — Open gym qui chevauche un cours, explicitement

**Phase** `P2` · **Estimation** `1,5` j·h · **Dépend de** `P1-002` (planning), `P1-001b` (types de cours) · **Spec** §6.2 · **Origine** demande commanditaire, 16 septembre 2026

## Objectif

Un créneau d'open gym peut occuper la même salle, à la même heure, qu'un cours
coaché — et c'est un cas **prévu et étiqueté**, pas un chevauchement subi. Les
membres s'entraînent en accès libre pendant qu'un cours tourne.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Types de cours, dont « Open gym » | `20260901180000_class_types_and_opening_hours.sql`, `seed.sql:111` | ✅ existe — « Open gym » est un `class_type` du seed |
| Un garde d'occupation de salle (heure/salle) | — | ✅ **il n'y en a pas** : `P1-026` l'a constaté (« rien ne le contrôle, pour les séries non plus »). Le chevauchement est donc déjà techniquement possible |
| Un marqueur « ce type est de l'accès libre » | `class_types` | ❌ **à créer** : `is_open_access boolean` (défaut `false`), pour que la règle repose sur une propriété du type, pas sur son nom |
| Le formulaire de planning | `apps/web/.../planning` (P1-002) | ⚠️ à vérifier : s'il pose un jour un avertissement de chevauchement, l'open gym en est exempté |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --- | --- | --- |
| `class_types.is_open_access` | la règle de chevauchement, et un futur garde de salle | celui-ci |

## Périmètre

- Migration : `class_types.is_open_access` ; le type « Open gym » du seed le porte.
- Règle explicite : deux créneaux dans la même salle au même moment sont autorisés
  **si au moins l'un est `is_open_access`** ; sinon avertissement (pas blocage —
  même niveau de garde que l'existant, `P1-026`).
- Planning : l'open gym se pose sur un créneau occupé sans friction ; deux cours
  coachés au même endroit affichent l'avertissement.

## Hors périmètre

- Un garde dur de double-réservation de salle pour les cours coachés — même statut
  qu'aujourd'hui (aucun), à traiter le jour où ça se pose (`P1-026`).
- Capacité partagée : l'open gym est « sans réservation » (seed), il ne consomme
  pas de place de cours.

## Critères d'acceptation

- [ ] Un open gym créé sur la même salle/heure qu'un WOD existant se pose sans
      avertissement
- [ ] Deux cours coachés sur la même salle/heure affichent l'avertissement
      (comportement inchangé)
- [ ] `rls-auditor` SAFE sur la migration

## Notes

La règle repose sur `is_open_access`, pas sur le nom « Open gym » (une box peut
renommer). On **autorise** le chevauchement pour l'accès libre, on ne le bloque
pas ailleurs — on avertit (`P1-026`).
