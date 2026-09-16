# `P2-023` — Soumission App Store

**Phase** `P2` · **Estimation** `2` j·h · **Dépend de** `P2-003` (Sign in with Apple), `P2-002` (RGPD), le build TestFlight de `P1-016` · **Spec** §19 (R11), §18.4 · **Origine** demande commanditaire, 16 septembre 2026

## Objectif

L'app est **soumise et acceptée** sur l'App Store — fiche, captures, labels de
confidentialité, notes de revue — pas seulement « buildée ».

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Compte Apple Developer actif | 8 sept. 2026 → 8 sept. 2027 | ✅ |
| Build TestFlight qui tourne | `P1-016` (n°6 soumis) | ✅ |
| Sign in with Apple | `P2-003` | ❌ **prérequis** : dès qu'un autre SSO est présent, Apple l'exige (guideline 4.8) |
| Suppression de compte in-app + export | `P2-002` | ❌ **prérequis** : exigence Apple + RGPD |
| Note de revue « service physique rendu hors app » | — | ❌ à rédiger ici : le service sportif est réglé hors app, la règle des achats intégrés ne s'y applique pas — à documenter (R11) |
| Labels de confidentialité, fiche, captures | App Store Connect | ❌ **le gros du ticket**, surtout non-code : geste commanditaire + guidage |

## Périmètre

- Fiche store : nom, descriptif FR/EN, captures par taille d'écran, mots-clés.
- Labels de confidentialité (App Privacy) cohérents avec la politique (`D-023`) et
  le fait qu'aucune donnée de paiement n'est traitée.
- Notes de revue : Sign in with Apple présent, suppression de compte accessible,
  service physique réglé hors app.
- Soumission et gestion des allers-retours de revue (compter 2–3, ~3 semaines —
  R11 / checklist §18.4).

## Hors périmètre

- Le canal Android / Firebase → `P1-016` (échéance mise en service) ; la soumission
  Play suit une fois le build Android prouvé.
- White-label N2 (app dédiée par box) → hors MVP.

## Critères d'acceptation

- [ ] L'app est **acceptée** sur l'App Store (le seul critère qui compte)
- [ ] La fiche existe en FR et EN
- [~] Play Store : après le build Android (`P1-016`)

## Notes

Surtout de l'administratif et des allers-retours ; le chiffrage (2 j·h) couvre le
travail de fiche et de notes, pas l'attente de revue. Le blocage est la file
d'Apple, pas le code.
