# P1-001d — Import CSV de membres

**Phase** P1 · **Estimation** 3 j·h · **Dépend de** P1-001c · **Spec** §19 (R3)

## Objectif

**Sans lui, aucune box existante ne migrera** (spec §19, risque R3). C'est le
ticket qui décide si le produit est achetable par une box déjà ouverte, ou
seulement par une box qui ouvre.

Il vaut 3 j·h à lui seul, ce que l'estimation d'origine de P1-001 avait manqué :
mapping de colonnes assisté, prévisualisation, détection de doublons, et
« rien ne se crée en cas d'erreur bloquante » — c'est une transaction et un écran
à part entière.

## Périmètre

- Dépôt d'un fichier, détection du séparateur et de l'encodage (les exports des
  logiciels français sortent volontiers en `;` et en Latin-1).
- Mapping assisté des colonnes vers les champs attendus, mémorisé pour le
  prochain import.
- Prévisualisation avant écriture : lignes valides, doublons, lignes rejetées
  avec le motif, ligne par ligne.
- Écriture **transactionnelle** : une erreur bloquante et rien n'est créé.
- Les personnes importées reçoivent une appartenance, pas un compte : le compte
  se crée à leur première connexion (`accept_invitation`).

## Critères d'acceptation

- [ ] 200 membres importés en une passe
- [ ] Les doublons (même e-mail, dans la box ou dans le fichier) sont signalés
      avant écriture, pas après
- [ ] Une erreur bloquante laisse la base exactement dans l'état d'avant
- [ ] Un e-mail déjà présent dans une **autre** box crée une appartenance, pas un
      second compte (ADR 0002 : la personne est globale)
