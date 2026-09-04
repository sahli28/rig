# D-003 — Résolution de la langue côté serveur

**Phase** dette (avant toute page publique indexée) · **Estimation** 2 j·h · **Origine** P0-003

## Pourquoi

Les pages web sont devenues des composants client pour consommer le contexte i18n.
Sans effet sur des écrans de remplissage, mais la spec §14 prévoit des **pages
publiques en SSR** pour le référencement (« box crossfit + ville », pages de
programme, planning public). Une page client-only n'est pas indexable correctement
et perd le bénéfice du rendu serveur.

## Périmètre

- Résolution de la langue côté serveur : en-tête `Accept-Language`, puis cookie de
  préférence, puis segment d'URL si l'on adopte `/[locale]/`.
- Traduction dans les Server Components via `translate()` de `@rack/core`, sans
  contexte React.
- Le `I18nProvider` client demeure pour les parties interactives.
- Décider si l'URL porte la langue — condition d'un référencement propre en deux
  langues.

## Critères d'acceptation

- [ ] Une page publique est rendue traduite côté serveur, sans JavaScript
- [ ] `<html lang>` reflète la langue effective
- [ ] Aucun flash de langue au chargement
