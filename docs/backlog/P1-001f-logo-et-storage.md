# P1-001f — Logo de la box, et la couche Storage

**Phase** P1 · **Estimation** 1 j·h · **Dépend de** P1-001e · **Spec** §11.2 · **Après la première démo**

## Pourquoi c'est un ticket à part

Le logo n'est pas une fonctionnalité de plus : c'est le **premier usage de
Supabase Storage**, donc le pilote de toute la couche fichiers. Le concevoir dans
un ticket dont l'objet est une couleur, c'est le concevoir distrait.

Ce design sera hérité par les **avatars** — qui sont, eux, des données
personnelles soumises au consentement (`.claude/rules/privacy.md`) — puis par les
vidéos de mouvements. Ce qu'on décide ici, on le décide trois fois.

Et une box se reconnaît à ses couleurs avant son logo : P1-001e suffit à la
démonstration.

## Périmètre

- Bucket, et son cloisonnement : un chemin par tenant, ou un bucket par tenant —
  à trancher, avec les policies sur `storage.objects` qui vont avec. La RLS de
  Storage est une table comme une autre : `tenant_id` doit s'y retrouver.
- Limites de **taille** et de **type MIME**, posées dans `config.toml` **et**
  vérifiées côté serveur : un client peut mentir sur les deux.
- URL **publique ou signée** : un logo de box est public par destination (il
  s'affiche avant connexion, sur `/invitation/[token]`), donc probablement
  publique — mais ça se décide, ça ne se subit pas.
- **Qui supprime l'ancien logo** quand une box en téléverse un nouveau. C'est la
  question que tout le monde oublie, et sans réponse le stockage accumule des
  orphelins pour toujours. Personne ne les retrouvera : rien ne les référence.
- Le champ dans l'écran `/box/[slug]/apparence`, à côté de la couleur.

## Ce qu'on ne fera pas : un champ `logo_url` libre

La colonne existe depuis P0-004, et l'exposer dans un formulaire serait deux
lignes de travail. C'est précisément pourquoi il faut l'écrire ici : **ce serait
une requête sortante pilotée par l'utilisateur**, chargée dans le navigateur de
chaque membre. Lien mort, hotlinking chez un tiers, contenu mixte en HTTPS, pixel
de suivi déguisé en logo.

Si un dépannage l'exigeait vraiment un jour, il faudrait au minimum valider le
schéma et l'hôte, et le documenter comme temporaire.

## Critères d'acceptation

- [ ] Un OWNER téléverse un logo ; il apparaît sur la page d'invitation et dans
      l'app mobile
- [ ] Un fichier trop lourd ou d'un type non autorisé est refusé, côté serveur
- [ ] Téléverser un second logo **supprime le premier** — vérifié en comptant les
      objets du bucket, pas en le supposant
- [ ] Un membre d'une autre box ne peut pas écrire dans le dossier de celle-ci
