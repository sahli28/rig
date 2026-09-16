# `P2-025` — Soumission Play Store

**Phase** `P2` · **Estimation** `2` j·h · **Dépend de** `P2-024` (build Android), `P2-002` (RGPD) · **Spec** §18.4, §19 · **Origine** demande commanditaire, 16 septembre 2026 — **prioritaire**

## Objectif

L'app est **soumise et acceptée** sur le Google Play Store — fiche, captures,
formulaire Data safety, note sur le paiement hors app.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Build Android qui tourne | `P2-024` | ❌ **prérequis** |
| **Compte Google Play Developer** (25 $ une fois) | Google Play Console | ❌ **prérequis administratif** — distinct du projet Firebase et du compte Apple. À vérifier : existe-t-il ? |
| Suppression de compte in-app + URL de suppression web | `P2-002` | ❌ **prérequis** : Google exige, comme Apple, la suppression de compte accessible (et une URL de suppression) |
| Fiche, captures, Data safety | Play Console | ❌ **le gros du ticket**, surtout non-code : geste commanditaire + guidage |

## Périmètre

- Fiche Play : nom, descriptif FR/EN, captures, catégorie.
- Formulaire **Data safety** cohérent avec la politique (`D-023`) et l'absence de
  traitement de données de paiement.
- Note : le service sportif est réglé hors app — comme sur iOS, un service
  consommé hors de l'app est hors du champ de la facturation Play.
- Soumission et allers-retours de revue.

## Hors périmètre

- L'App Store → `P2-023`.
- White-label N2 (app dédiée par box) → hors MVP.

## Critères d'acceptation

- [ ] L'app est **acceptée** sur le Play Store
- [ ] La fiche existe en FR et EN
- [ ] Le formulaire Data safety est cohérent avec la politique de confidentialité

## Notes

Même nature que `P2-023` (App Store) : de l'administratif et des allers-retours,
le chiffrage couvre le travail de fiche, pas l'attente de revue.
