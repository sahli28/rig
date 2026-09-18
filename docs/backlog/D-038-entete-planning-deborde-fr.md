# `D-038` — L'en-tête du planning déborde en français

**Phase** `dette` · **Estimation** `0,5` j·h · **Dépend de** `P1-002` · **Spec** §12.4 · **Origine** test appareil Android de `P2-024`, 18 septembre 2026

## Objectif

L'en-tête du planning (jour précédent · date · jour suivant) reste lisible en
français comme en anglais — la date ne se casse plus **syllabe par syllabe**.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| La rangée d'en-tête | `apps/mobile/app/(app)/planning.tsx:424-447` | ⚠️ **la cause** : deux `Button` texte (« Jour précédent » / « Jour suivant ») encadrent un `Text` date `flex:1`. Les libellés **FR** sont plus longs qu'en EN → ils mangent la largeur, la date au centre est écrasée et se casse caractère par caractère. Correct en EN (libellés plus courts) |
| L'intention déjà écrite | commentaire `:422` — « ‹ » et « › » comme flèches (§12.4) | ✅ prévue, **non appliquée** |
| `IconButton` | kit de composants (galerie) | ✅ existe |

## Périmètre

- Remplacer les deux boutons texte par des **flèches ‹ / ›** (`IconButton`) avec
  `accessibilityLabel` = « Jour précédent » / « Jour suivant » (§12.4) → la
  largeur est libérée pour la date, dans les deux langues.
- Vérifier le rendu **FR et EN**.

## Hors périmètre

- La grille du mois (fonctionne).
- La passe design globale `P2-021`.

## Critères d'acceptation

- [ ] En FR, « vendredi 18 septembre 2026 » tient dans l'en-tête sans casse
      syllabique ; en EN, inchangé
- [ ] Les flèches gardent leur libellé accessible (le lecteur d'écran annonce
      « Jour précédent » / « Jour suivant »)
- [~] Rendu appareil (FR + EN)

## Notes

Révélé en test le 18 sept. 2026. Le correctif est exactement celui que le
commentaire du code suggérait déjà.
