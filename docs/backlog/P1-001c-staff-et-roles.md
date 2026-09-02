# P1-001c — Staff & Roles : annuaire, invitations, changement de rôle

**Phase** P1 · **Estimation** 3,75 j·h · **Dépend de** P1-001a, D-001, D-005 · **Spec** §5.2, §6.2

## Objectif

L'écran par lequel un propriétaire délègue : voir qui est dans sa box, inviter un
coach, changer un rôle, retirer quelqu'un.

**Ses deux dépendances sont déjà livrées** — c'était leur raison d'être. D-001 a
construit la vue `member_admin_directory`, D-005 la fonction
`create_invitation()`. Il ne reste que l'écran.

## Périmètre

- Annuaire : `member_admin_directory` (D-001), recherche, filtre par rôle et par
  statut.
- Invitations : `create_invitation(p_tenant_id, p_email, p_role, p_expires_in)`,
  liste des invitations en cours, révocation.
- Changement de rôle : `set_member_role()`, retrait : `remove_member()`.

**Deux ajouts décidés à l'ouverture, qui portent l'estimation de 2 à 3,75 j·h.**

### 1. La page publique `/invitation/[token]` (+1,25 j·h)

L'argument n'est pas l'ergonomie : **on n'imprime pas un jeton hexadécimal de
48 caractères sur une affiche murale.** D-005 a consacré tout un arbitrage au QR
d'affiliation ; un QR encode une URL. Sans page d'acceptation web, ce QR était
infabricable, et le seul chemin d'entrée passait par un deep link — donc par
D-008, bloqué sur un domaine et un compte Apple. Cette page **sort D-008 du
chemin critique**.

Elle s'appuie sur deux fonctions ajoutées ici :

- `invitation_preview(p_token)` — marque de la box, rôle proposé, et e-mail
  **masqué**. Zéro ligne pour un jeton inconnu, expiré, révoqué, consommé ou
  d'une box fermée : les cinq sont indiscernables, comme « box inconnue ou accès
  refusé » ;
- `invitation_accepts_email(p_token, p_email)` — **sans elle, l'invitation
  nominative est un piège** : une autre adresse reçoit son lien, **crée un
  compte**, puis se voit refuser l'invitation. La personne repart avec un compte
  et sans appartenance. Le contrôle a donc lieu avant l'envoi du lien.

Le jeton voyage dans l'URL, donc dans l'historique et la boîte mail. C'est
inhérent à une invitation par lien — et c'est exactement pourquoi elle est à
usage unique et expirante.

### 2. Le journal d'audit, enfin écrit (+0,5 j·h)

`log_audit()` existait depuis P0-004 avec ses droits, ses tests et sa policy de
lecture réservée à l'OWNER. **Aucun code ne l'appelait.** Reporter n'était pas
comparable à reporter une autre dette : un test manquant se réécrit, **un journal
non tenu ne se reconstitue pas**.

Six fonctions, pas trois : `set_member_role`, `remove_member`,
`create_invitation`, `accept_invitation`, `leave_tenant`, `create_tenant`. Ne
tracer que le retrait donnerait un journal qui sait dire qui a été exclu mais pas
qui est parti — la question même à laquelle un journal existe pour répondre.

Ce qui n'entre jamais dans le `diff` : **aucun jeton** (D-005 vient de les
chasser de la base, et `audit_logs` est append-only — on ne les en retirerait
plus), **aucun e-mail**. `p_ip` reste nul : un `x-forwarded-for` est falsifiable
et c'est une donnée personnelle ; un champ vide vaut mieux qu'un champ faux.

L'**écran** de consultation du journal reste hors périmètre (spec §5.2 : OWNER
seul) — il n'a de valeur que maintenant qu'il y a quelque chose dedans.

## Ce que D-005 impose à l'écran

Les invitations ne se créent plus par `insert`. `create_invitation()` rend le
jeton **en clair une seule fois** ; la base n'en garde que l'empreinte SHA-256,
et il n'est récupérable par aucun chemin ensuite.

- **Afficher le jeton — ou le lien qui le porte — immédiatement**, avec un bouton
  de copie, et dire clairement qu'il ne sera plus affiché. Le motif est celui des
  clés d'API : montré une fois, perdu ensuite.
- **Pas de « réafficher »**, seulement « régénérer », qui invalide le précédent.
  Vaut aussi pour le QR mural d'affiliation : réimprimer une affiche, c'est
  émettre un nouveau QR et jeter les anciennes.
- La matrice de rôles est **dans la fonction**, pas dans l'écran : un MANAGER
  n'invite qu'aux rôles MEMBER et COACH, et reçoit `MANAGER_CANNOT_GRANT_ROLE`
  s'il essaie autre chose. L'écran masque l'option, la base la refuse — deux
  couches.
- `invited_by` est dérivé de la session : ne pas l'envoyer.

## Critères d'acceptation

- [x] Un MANAGER invite un coach, pas un autre manager (spec §5.2) — et ne voit
      ni OWNER ni MANAGER dans les rôles proposés, ni de bouton sur leurs lignes
- [x] Le lien d'invitation s'affiche une fois, avec sa mise en garde
- [x] Une invitation se révoque ; une invitation expirée se voit comme telle,
      même quand la base la dit encore `PENDING`
- [x] Un changement de rôle passe par `set_member_role()`, jamais par un `update`
- [x] Un OWNER ne peut pas se retirer lui-même s'il est le dernier propriétaire
      (`LAST_OWNER`, déjà en base, exercé par `membership_mutations_test.sql`)
- [x] Une invitation nominative refuse une autre adresse **avant** l'envoi du
      lien : aucun compte n'est créé (vérifié, `auth.users` inchangé)
- [x] Un jeton inconnu, expiré ou déjà consommé donne le **même** message
- [x] Les six mutations écrivent au journal, avec le bon acteur, et sans jamais
      y laisser de jeton ni d'e-mail
