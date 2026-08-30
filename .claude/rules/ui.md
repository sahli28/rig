---
paths:
  - 'apps/mobile/**/*.tsx'
  - 'apps/web/**/*.tsx'
  - 'packages/ui/**/*.tsx'
---

# Règles UI

## Deux plateformes, deux façons d'accéder au même thème

Décision d'architecture : **le kit de composants est React Native, le web
consomme les tokens en CSS** (ADR 0003). Il n'y a pas de composant partagé.

| | mobile (`apps/mobile`) | web (`apps/web`) |
| --- | --- | --- |
| Composants | `@rig/ui/native` | les siens, base accessible (Radix/shadcn) |
| Accès aux tokens | `useTheme()` | variables CSS `var(--rig-color-primary)` |
| Source des tokens | `@rig/ui/theme` | `@rig/ui/theme` via `themeToCssRule()` |

**Ne jamais importer `@rig/ui/native` depuis `apps/web`** : cela embarquerait
React Native dans le bundle Next et casserait le build.

## White-label

- **Aucune couleur littérale** (`#E4572E`, `rgb(...)`, `red`) dans un composant,
  ni dans une feuille de style web. Uniquement des tokens.
- Sur mobile : `colors.primary`, `colors.surface`, `colors.textMuted`… via
  `useTheme()`. Un composant qui ne peut pas être thémé est mal conçu.
- Sur le web : `var(--rig-color-primary)`, `var(--rig-radius-md)`,
  `var(--rig-text-body)`… Les variables sont injectées en SSR par `<ThemeStyle/>`,
  ce qui évite tout flash de thème.
- Tester chaque écran avec deux thèmes contrastés (clair/sombre, primaire chaude/froide).

## i18n

- Aucune chaîne visible en dur. `t('booking.confirm')`, clés en `fr.json` et `en.json`.
- Ajouter les deux langues dans le même commit. Une clé manquante en EN = build rouge.
- Dates, heures et montants via les helpers `formatDate`, `formatTime`, `formatMoney`
  de `packages/core` — jamais de `toLocaleString` appelé à la main.
- Heures affichées dans le fuseau de la box, pas celui de l'appareil.

## Accessibilité (cible WCAG 2.2 AA)

- Contraste ≥ 4,5:1 texte, ≥ 3:1 composants.
- Cibles tactiles ≥ 44 pt / 48 dp.
- `accessibilityLabel` sur tout bouton icône.
- L'information n'est jamais portée par la couleur seule (un cours complet a un texte).
- Respecter `prefers-reduced-motion`.
- Support du texte dynamique jusqu'à 200 % sans casse de mise en page.

## Comportement

- Une seule action primaire par écran.
- Mise à jour optimiste sur la réservation, avec rollback visible si le serveur refuse.
- Jamais de spinner bloquant sur un parcours de réservation.
- Tout état vide explique quoi faire et propose l'action.
- Planning, WOD du jour et carte de membre doivent fonctionner hors ligne en lecture.
