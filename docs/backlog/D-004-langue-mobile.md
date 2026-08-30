# D-004 — Persistance mobile de la préférence de langue

**Phase** dette · **Estimation** 1 j·h · **Origine** P0-003 · **Dépend de** P0-005

## Pourquoi

Sur le web, le choix de langue est persisté dans `localStorage`. Sur mobile, il ne
vaut que pour la session : `I18nProvider` accepte un adaptateur `LocaleStorage`,
mais l'app mobile n'en fournit aucun. Un membre qui bascule en anglais retrouve le
français au prochain lancement.

## Périmètre

- Persister `users.locale` côté serveur — la colonne existe déjà (P0-004) — et la
  lire au démarrage après authentification.
- Adaptateur `LocaleStorage` mobile s'appuyant sur le profil, avec repli local
  avant connexion.

## Critères d'acceptation

- [ ] La langue choisie survit à un redémarrage de l'app
- [ ] Elle suit le compte d'un appareil à l'autre
- [ ] Avant connexion, la langue de l'appareil s'applique toujours

## Notes

Dépend de P0-005 : sans profil serveur, il n'y a rien où écrire. C'est la raison
pour laquelle cette dette a été laissée à P0-003 plutôt que traitée sur place.
