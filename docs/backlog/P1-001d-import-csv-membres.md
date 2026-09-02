# P1-001d — Import CSV de membres

**Phase** P1 · **Estimation** 4 j·h · **Dépend de** P1-001c · **Spec** §19 (R3)

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
- Les personnes importées reçoivent une **invitation**, pas une appartenance —
  voir la correction ci-dessous.

## La contradiction du ticket, et ce qu'elle a décidé

Le ticket disait « les personnes importées reçoivent une **appartenance**, pas un
compte ». **Le schéma l'interdit** : `memberships.user_id` → `public.users` →
`auth.users`. Pas de compte, pas d'appartenance.

Ce que l'import crée est donc une invitation par ligne — et la vraie question
devient : comment 200 personnes la reçoivent-elles ?

**Créer les comptes à l'import est écarté, pas reporté.** Ce serait traiter les
données de quelqu'un qui n'a rien accepté, sans base légale établie avec lui, et
`consents` n'aurait aucune ligne pour lui. Tout le parcours RGPD de ce produit
repose sur le consentement recueilli à l'inscription.

**Distribuer 200 jetons** dans un tableur est écarté aussi : D-005 a consacré un
ticket entier à éliminer les jetons vivants de la base.

**La sortie : on accepte une invitation nominative sans détenir le jeton**, en se
connectant avec l'adresse invitée. Le jeton n'a jamais été qu'une commodité — la
garantie réelle est le contrôle de la boîte mail, exactement comme pour un lien
magique, et `accept_invitation()` comparait **déjà** l'adresse au JWT vérifié.

### Ce que cette seconde porte a coûté en précautions

- `pending_invitations_for_me()` **ne prend aucun paramètre**, comme
  `current_tenant_ids()` : avec une adresse en argument, elle deviendrait un
  annuaire d'invitations lisible à travers tous les tenants.
- `accept_pending_invitation()` ne résout que **parmi ses propres invitations**,
  pour ne pas devenir un oracle : sans ça, un identifiant deviné distinguerait
  « inexistante » de « pas pour vous », et les UUID v7 portent un horodatage.
- **Les deux portes partagent leur corps**, `claim_invitation()`. Si les listes
  de contrôles divergeaient d'un seul, ce serait un contournement — et personne
  ne le verrait, les deux fonctions passant leurs tests séparément.
- Un **index unique partiel** interdit désormais deux invitations `PENDING` pour
  la même personne dans la même box. Il n'y en avait aucun : un import rejoué —
  et il le sera — en créait une deuxième, puis une troisième.
- L'import expire à **90 jours** et non 30 : sur un effectif entier, celles et
  ceux qui ne se connectent pas dans le mois seraient bloqués sans que la box le
  sache.

## Le vrai piège technique : l'encodage, pas l'analyse

PapaParse reçoit une **chaîne** : il ne décode rien. Lu avec `readAsText()` —
UTF-8 par défaut — un export Excel FR a déjà perdu ses accents quand l'analyse
commence, et on importe 200 noms cassés sans qu'un test bronche.

Le chemin est donc : `ArrayBuffer` → UTF-8 en mode `fatal` → repli
`windows-1252` → BOM retiré → PapaParse. Vérifié de bout en bout : « Chloé
Béranger » et « Hervé Noël » arrivent intacts en base depuis un fichier
windows-1252.

**Le fichier ne quitte jamais le navigateur** — décodé, analysé et mappé côté
client, seules les lignes retenues partent. Ce n'est pas un détail
d'implémentation mais une propriété de confidentialité, désormais écrite dans
`.claude/rules/privacy.md`.

## Critères d'acceptation

- [x] 200 membres importés en une passe — vérifié avec un fichier réellement
      encodé en `windows-1252`, séparé par `;`, avec une colonne en trop
- [x] Les doublons (même e-mail, dans la box ou dans le fichier) sont signalés
      avant écriture : 198 à créer, 1 doublon interne, 1 déjà membre
- [x] Une erreur bloquante laisse la base exactement dans l'état d'avant — la
      ligne valide qui précédait la ligne illisible n'existe pas non plus
- [x] Un e-mail déjà présent dans une **autre** box crée une appartenance, pas un
      second compte (ADR 0002 : la personne est globale)
- [x] Réimporter le même fichier ne crée rien et explique pourquoi
- [x] Une personne importée rejoint **sans jeton**, en se connectant, et son
      prénom pré-remplit son profil vide
- [x] Le journal porte **une** entrée par import, avec des nombres et aucune
      adresse

## Deux culs-de-sac trouvés en vérifiant, pas en relisant

1. **`/login` refuse de créer des comptes** (`shouldCreateUser: false`), ce qui
   est juste pour la porte du back-office — mais une personne qu'une box vient
   d'importer **n'a pas encore de compte** : elle arrivait sur « utilisateur
   inconnu », sans issue. `/invitations` demande donc explicitement
   l'inscription, comme le fait déjà la page d'invitation par jeton.
2. **Aucune sortie de compte sur `/invitations`** : le message « connecte-toi
   avec l'autre adresse » y était déjà, sans le bouton qui le rend possible.
   Troisième occurrence du même motif — une page qui ouvre une session à
   quelqu'un qui n'a pas le back-office, et rien pour en sortir.
