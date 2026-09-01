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

- [x] Aucun jeton en clair en base — la colonne s'appelle désormais `token_hash`
      et porte un SHA-256 hexadécimal
- [x] Un jeton valide reste acceptable, un jeton inconnu est refusé
- [x] Le QR d'affiliation (invitation sans e-mail) continue de fonctionner
- [x] Un test prouve qu'un dump de `invitations` ne permet pas de rejouer un
      jeton — `invitation_tokens_test.sql` lit la valeur **telle qu'elle est en
      base** et la rejoue : `INVITATION_NOT_FOUND`

## Arbitrage retenu : tout est haché, QR mural compris

Le QR d'affiliation est une invitation sans e-mail, réutilisable, imprimée sur
une affiche. N'en garder que l'empreinte veut dire que la box ne peut plus le
**réafficher**, seulement le **régénérer** — ce qui invalide les affiches
précédentes.

L'option inverse se défendait : un QR mural est déjà public par destination, et
le hacher protège d'un dump plus que d'un passant. Mais un dump livrerait les QR
de **toutes** les boxes, donc la possibilité de rejoindre n'importe laquelle à
distance — ce que l'affiche physique n'autorise pas. Uniformité retenue :
aucun jeton vivant ne dort en base, quelle qu'en soit la nature.

## Livré

- `token` → `token_hash`, **renommée** plutôt que réinterprétée. Les invitations
  en vol sont préservées : la migration hache l'existant au lieu de l'effacer.
- `create_invitation()` `security definer`, seule porte d'entrée. Elle rejoue la
  matrice de la policy supprimée (`OWNER` invite à tout rôle, `MANAGER` seulement
  `MEMBER` et `COACH`), refuse une box fermée, et **dérive `invited_by` de la
  session** au lieu de l'accepter en paramètre — gain net sur l'`insert` direct,
  qui laissait écrire n'importe quel invitant, ou aucun.
- `accept_invitation()` cherche par empreinte. Le client continue d'envoyer le
  jeton en clair : la fonction étant `security definer`, la signature TypeScript
  ne bouge pas.
- Policy `invitations_insert` **et** droit `insert` retirés ensemble — depuis
  D-006, le test de correspondance signalerait l'un sans l'autre.

Aucun nouveau code d'erreur : `AUTH_REQUIRED`, `FORBIDDEN_ROLE`,
`MANAGER_CANNOT_GRANT_ROLE` et `TENANT_CLOSED` existaient déjà et sont déjà
traduits.

## Écarté

**Restreindre `update` aux colonnes utiles**, par symétrie avec `users`. Le seul
abus concevable serait qu'un `OWNER` réécrive une invitation de sa propre box —
qu'il peut déjà créer, ce n'est donc pas une élévation. Et l'escalade qui
compterait, un `MANAGER` promouvant une invitation en `OWNER`, est déjà bloquée
par le `with check` de `invitations_update`. Le coût en réécriture de tests
dépassait le gain.

## Notes

Repoussé hors de P0-004 parce que le changement porte sur le **contrat de
création** d'une invitation, que P0-005 construit. Le faire maintenant obligerait
à écrire deux fois l'API d'invitation.
