# D-002 — Tests de rendu des composants

**Phase** dette · **Estimation** 2 j·h · **Origine** P0-002, P0-003

## Pourquoi

Trois critères d'acceptation restent à `[~]` faute de test de rendu :

- les 16 composants s'affichent correctement en clair et en sombre (P0-002) ;
- le texte dynamique à 200 % ne casse aucun composant (P0-002) ;
- changer la langue met à jour toute l'interface sans redémarrage (P0-003).

Le moteur est testé dans les trois cas ; le rendu ne l'est pas. Ces critères ne
seront jamais cochables sans cet outillage.

## Périmètre

- `@testing-library/react-native` pour le kit, `@testing-library/react` pour le web.
- Un test par composant : rend sans lever, avec un thème clair et un thème sombre.
- Un test qui change la langue et vérifie que les libellés suivent, sans remontage.
- Un test de mise à l'échelle du texte à 200 %.

## Critères d'acceptation

- [ ] Les 16 composants passent un test de rendu dans les deux schémas
- [ ] Le basculement de langue est prouvé par un test, plus par une intuition
- [ ] Les trois critères `[~]` de P0-002 et P0-003 deviennent cochables

## Notes

Deux dépendances de développement à justifier au commit. C'est le prix de
critères d'acceptation qu'on peut réellement cocher.
