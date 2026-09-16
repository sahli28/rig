# `P2-026` — Retrait d'accès (bouton) + filtre `deleted_at` en lecture

**Phase** `P2` · **Estimation** `1` j·h · **Dépend de** `P2-018` · **Spec** §5.2 (suspendre), §7 · **Origine** écart signalé par la passe `P2-018`, 16 septembre 2026

## Objectif

Le staff **retire** l'accès d'un membre depuis l'écran — aujourd'hui c'est un
`update … set deleted_at` à la main en SQL — et un abonnement retiré disparaît
des lectures.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| `member_subscriptions` + `deleted_at` + `grant_member_subscription()` | `20260916100000_member_subscriptions.sql` (P2-018) | ✅ existe |
| `member_has_booking_right()` exclut déjà `deleted_at` | même migration (`s.deleted_at is null`) | ✅ **vérifié le 16 sept.** — donc retirer l'accès **bloque déjà la réservation**. La correction de fond est faite ; seul le geste humain manque |
| Policies de lecture de `member_subscriptions` | même migration | ⚠️ **ne filtrent pas `deleted_at`** — observation non bloquante de `rls-auditor`, à corriger ici : un abonnement retiré ne doit plus être rendu |
| La ligne membre dans le back-office | `apps/web/app/box/[slug]/staff/` (l'écart #1 de P2-018 : la liste vit dans `staff/`, pas `membres/`) | ✅ `grantSubscription` y est déjà accroché |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --- | --- | --- |
| `revoke_member_subscription()` (security definer, garde de rôle, audit) | le bouton « Retirer l'accès » | celui-ci |

## Périmètre

- Fonction `revoke_member_subscription()` — motif de `grant_member_subscription()` :
  security definer, garde OWNER/MANAGER, audit dans la même transaction, écriture
  du `deleted_at`. Aucune écriture directe de table.
- Bouton « Retirer l'accès » sur la ligne membre (`staff/`), avec confirmation.
- Filtre `deleted_at is null` dans les policies de lecture de `member_subscriptions`.
- pgTAP : après retrait, `member_has_booking_right` = `false` et la lecture ne rend
  plus la ligne ; COACH refusé.

## Hors périmètre

- L'historique des accès passés (une ligne retirée reste en base) — un écran
  d'historique est un autre ticket si l'usage le demande.

## Critères d'acceptation

- [ ] Le staff retire l'accès d'un membre depuis l'écran ; il ne peut plus
      réserver — pgTAP + parcours
- [ ] Un abonnement retiré n'apparaît plus dans les lectures (policy filtre
      `deleted_at`)
- [ ] Un COACH ne peut pas retirer ; `rls-auditor` SAFE
- [~] Parcours hébergé (retrait réel) — même environnement que le `[~]` de `P2-018`

## Notes

`member_has_booking_right()` filtre déjà `deleted_at` (vérifié 16 sept.) : la
correction de sécurité est faite, ce ticket ajoute le geste humain et l'hygiène
de lecture.

**Piège d'environnement connu, non traité ici** : `apps/mobile/lib/push.ts:114`
(ExpoNotifications indisponible sur le harnais web, chemin `P1-007`) lève une
« Uncaught Error » dont l'overlay avale les clics tant qu'on ne le ferme pas.
Préexistant à `P2-018`, contourné, pas traité — à ouvrir en dette si ça regêne.
