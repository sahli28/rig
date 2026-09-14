# `D-035` — La grille web dit à quelle heure on ressort

**Phase** `dette` · **Estimation** `0,25` j·h · **Dépend de** — · **Spec** §7 · **Origine** usage réel du pilote, 14 septembre 2026

## Objectif

La carte d'un cours affiche la **plage** — « 10:00 – 11:00 » — et plus
seulement le départ. `ends_at` existait en base depuis P1-002 (départ + durée
du type) sans jamais atteindre l'écran web.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| `ends_at` sur l'occurrence, jusqu'au client | `Occurrence` (`@rack/core/supabase`), déjà dans les props | ✅ existe |
| Le format d'heure au fuseau de la box | `formatTime()` d'`useI18n()` | ✅ existe |
| Le précédent d'écriture | la carte **mobile** (`(app)/index.tsx`) affiche déjà « début – fin » | ✅ — même tiret, même forme |

## Périmètre

- `week-grid.tsx` : `slotTime` devient `{début} – {fin}`. **Web seulement** —
  le mobile l'affiche déjà, pas de volet mobile.

## Critères d'acceptation

- [x] Chaque carte de la grille affiche « HH:MM – HH:MM », au fuseau de la
      box — **fait le 14 sept. 2026**, vérifié au harnais (WOD 07:00 – 08:00,
      Haltéro 19:00 – 20:30 : la durée vient bien du type)
