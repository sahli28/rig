# D-005 — Empreintes des jetons d'invitation

**Phase** dette (avant la première box en production) · **Estimation** 1 j·h · **Origine** relecture de la PR #4

## Pourquoi

`invitations.token` est stocké **en clair**. L'exposition est aujourd'hui limitée —
seuls OWNER et MANAGER lisent la table — mais un dump, une sauvegarde, un accès
support ou une future vue mal cadrée livrerait des identifiants **vivants** :
chacun de ces jetons ouvre une appartenance dans une box.

## Périmètre

- Stocker `encode(digest(token, 'sha256'), 'hex')` plutôt que le jeton.
- `accept_invitation()` hache son paramètre et cherche par empreinte. Étant
  `security definer`, cela ne coûte rien côté appelant.
- Fonction `create_invitation()` `security definer` qui génère le jeton, stocke
  l'empreinte et **retourne le jeton en clair une seule fois** — cohérent avec le
  modèle déjà retenu pour `memberships`, où toutes les mutations passent par des
  fonctions.
- Retirer alors la capacité d'`insert` directe sur `invitations`.

## Critères d'acceptation

- [ ] Aucun jeton en clair en base
- [ ] Un jeton valide reste acceptable, un jeton inconnu est refusé
- [ ] Le QR d'affiliation (invitation sans e-mail) continue de fonctionner
- [ ] Un test prouve qu'un dump de `invitations` ne permet pas de rejouer un jeton

## Notes

Repoussé hors de P0-004 parce que le changement porte sur le **contrat de
création** d'une invitation, que P0-005 construit. Le faire maintenant obligerait
à écrire deux fois l'API d'invitation.
