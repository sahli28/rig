# `D-037` — Le jeton push ne s'enregistre qu'au redémarrage

**Phase** `dette` · **Estimation** `0,75` j·h · **Dépend de** `P1-007` · **Spec** §9 (notifications) · **Origine** test appareil Android de `P2-024`, 18 septembre 2026

## Objectif

Activer les notifications (ou accorder la permission OS) enregistre le jeton push
**tout de suite** : le membre reçoit ses notifications **sans redémarrer l'app**.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| L'effet d'enregistrement du jeton | `apps/mobile/lib/push.ts`, effet 2, `deps = [userId, activeTenantId]` | ⚠️ **la cause** : il ne se relance **pas** quand `prefs.push` passe à `true` ni quand la permission OS est nouvellement accordée → le jeton n'est posé qu'au **prochain montage** (redémarrage) |
| `fetchMyPreferences`, `registerDevice`, le toggle push des Réglages | `@rack/core/supabase`, écran Réglages | ✅ existent |
| La chaîne d'envoi (producteurs, émetteur, `push_outbox`) | `P1-007` | ✅ prouvée iOS **et** Android (après redémarrage) — hors périmètre |

## Périmètre

- Relancer l'enregistrement du jeton **dès que** la préférence push devient `true`
  et/ou la permission OS est nouvellement accordée — sans redémarrage. Par
  exemple : déclencher l'enregistrement depuis l'action du toggle Réglages (après
  écriture du consentement), et/ou rendre l'effet réactif au passage de la
  préférence, **sans** réintroduire de boucle d'enregistrement.
- Rester best-effort : rien ne casse la session si la permission ou le réseau
  manquent (invariant de `push.ts`).

## Hors périmètre

- La chaîne d'envoi elle-même (elle marche).
- Quiet hours, catégories, deep link.

## Critères d'acceptation

- [ ] Install fraîche : activer les notifs dans Réglages → accepter la permission
      → une notif déclenchée dans la foulée **arrive**, sans redémarrer l'app
- [ ] Le jeton n'est enregistré **qu'une fois** (pas de double enregistrement ni
      de boucle) — test du chemin
- [~] Preuve appareil Android — même passe que `P2-024` (c'est le geste qui a
      révélé le bug)

## Notes

Révélé en testant `P2-024` sur Android le 18 sept. 2026 : le push n'arrivait
qu'après redémarrage de l'app, la permission ayant déjà été accordée entre-temps.

## Journal

**18 sept. 2026 — corrigé sur `fix/D-037-jeton-push-au-redemarrage` (un commit).**
La séquence d'enregistrement de l'effet 2 est extraite dans une fonction exportée
`ensurePushDeviceRegistered({ tenantId, userId })` de `apps/mobile/lib/push.ts`,
best-effort (ne lève jamais). Deux appelants :

- l'**effet 2**, au montage — deps inchangées `[userId, activeTenantId]`, donc
  **aucune boucle** ajoutée ;
- le **toggle PUSH des Réglages** (`preferences.tsx`), dès qu'on active les
  notifications, après l'écriture du consentement et `reload()` — lancé sans
  `await` pour ne pas bloquer le toast sur la boîte de dialogue de permission, et
  hors du chemin qui pourrait annuler la bascule optimiste. C'est ce chemin qui
  demande la permission OS dans la foulée, donc il couvre aussi « permission
  nouvellement accordée ».

**Pas de double enregistrement** (critère 2), par construction et sans nouveau
test : `getExpoPushTokenAsync` rend le même jeton pour l'appareil et
`register_device` (`security definer`) réassigne sur conflit de jeton au lieu
d'insérer — comportement déjà prouvé par `supabase/tests/push_emitter_test.sql`.
La chaîne d'envoi (producteurs, émetteur, `push_outbox`) n'est **pas** touchée.

`/check` vert (typecheck, format, lint, 18 sondes, `test`, `test:db` 723/723).
Les deux critères d'appareil restent `[ ]`/`[~]` jusqu'à la re-passe Android.
