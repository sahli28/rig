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

## La convention web (ADR 0005)

**Radix Primitives** pour le comportement, **CSS Modules** pour la mise en forme.

- Radix ne porte aucun style : il porte l'accessibilité — focus piégé,
  échappement, clavier, `aria-*`, portail. C'est ce que la spec §12.2 dit de ne
  jamais recoder en solo, et rien de plus.
- Un fichier `.module.css` à côté de son composant. **Toute** couleur, tout
  rayon, toute taille de texte, toute cible tactile vient d'une variable
  `--rig-*` injectée par `themeToCssRule()`. Aucune valeur littérale.
- Les paquets Radix s'installent **un par un, à l'usage**, justifiés au commit.
- **Pas de Tailwind, pas de shadcn/ui** : ils apportent un second système de
  thème à côté de `@rig/ui/theme`, et deux endroits où définir une couleur, c'est
  la promesse white-label qui se casse — silencieusement, un `bg-slate-100` à la
  fois.

Chaque écran de back-office vit sous `/box/[slug]/…` : **la box active est dans
l'URL**, jamais dans un contexte ni dans un cookie. Elle survit au
rafraîchissement et au lien partagé, le rendu serveur la lit dans `params`, et
une lecture croisée se voit dans la barre d'adresse. Le slug se résout **parmi
ses propres appartenances** (`findMembershipBySlug`), jamais par
`tenant_public_profile()` : « box inconnue » et « accès refusé » doivent rester
indiscernables.

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
