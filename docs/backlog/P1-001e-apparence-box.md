# P1-001e — Apparence de la box

**Phase** P1 · **Estimation** 1 j·h · **Dépend de** P1-001a · **Spec** §5.2, §11.2, §12.2

## Pourquoi ce n'est pas cosmétique

`create_tenant()` insère `primary_color` à **`#E4572E` en dur** — une couleur
d'exemple de la spécification. Aucune box ne peut changer la sienne : la table
`themes` a ses policies, ses droits et son thème SSR, mais **aucun écran ne
l'écrit**.

Le produit dont l'argument numéro un est « votre app, à vos couleurs » ne sait
pas les changer. C'est le même motif que l'écran de connexion manquant : une
moitié posée, sa jumelle jamais écrite.

Et c'est le seul ticket qui **actionne** le code de correction de contraste posé
en P0-002 — `ensureContrast()`, `pickOnColor()`, `meetsContrast()` ont leurs
tests unitaires mais n'ont jamais vu une couleur choisie par un humain.

**À faire avant la première démo à un propriétaire**, pas après.

## Périmètre

- Écran `/box/[slug]/apparence` : couleur primaire, logo, nom d'app, rayon,
  police.
- **OWNER seul** : la spec §5.2 exclut explicitement le gestionnaire du
  white-label, et la policy `themes_update` le fait déjà.
- Aperçu en direct des tokens dérivés, avec le **ratio de contraste affiché** et
  un avertissement quand la couleur choisie oblige `ensureContrast()` à corriger.
- Téléversement du logo (Supabase Storage — première utilisation, à cadrer :
  bucket par tenant, RLS du bucket, taille et format acceptés).

## Critères d'acceptation

- [ ] Un OWNER change la couleur de sa box et l'app mobile comme le back-office
      la prennent au chargement suivant
- [ ] Un MANAGER n'atteint pas l'écran
- [ ] Une couleur à faible contraste est acceptée mais **signalée**, et le texte
      reste lisible grâce à `ensureContrast()`
- [ ] Le thème par défaut d'une box nouvellement créée cesse d'être la couleur
      d'exemple de la spec
