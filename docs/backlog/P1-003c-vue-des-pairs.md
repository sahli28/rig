# P1-003c — La feuille d'inscrits : en quoi un pair diffère d'un coach

**Phase** P1 · **Estimation** 3,5 j·h · **Dépend de** P1-003b ✅ · **Spec** §5.2 · **✅ fait le 5 septembre 2026**

> **2 → 3,5 j·h**, et le demi-jour et demi a une cause unique : une opposition
> qu'on ne peut pas exercer n'existe pas, et **aucun écran ne permettait de
> changer une préférence**. Voir « Le trou de la règle 8 » ci-dessous.

## Objectif

Un membre voit qui d'autre est inscrit au cours qu'il regarde — ou ne le voit
pas, et le ticket dit lequel. **La décision est le livrable**, l'écran vient
après.

## La condition était remplie, et elle l'a été jusqu'au bout

D-001 a différé cette question, P1-003 l'a reléguée à son lot 2, et P1-003b l'a
laissée dehors — trois fois, pour la même raison, et elle est bonne : elle se
tranche **avec l'écran sous les yeux**. L'écran existait depuis la veille et
avait tourné sur un iPhone.

Ce qui a changé depuis, et qui rend la décision plus facile : **la règle
d'exposition d'identité existe** (P1-010, `.claude/rules/privacy.md`). Il n'y a
plus à réinventer un standard. La question se réduit à une seule :

> **En quoi un pair diffère-t-il d'un coach ?**

## Le point de départ, hérité et non rediscuté

La règle commune s'applique jusqu'à preuve du contraire :

- prénom, **initiale** du nom, photo si consentie ;
- jamais d'e-mail, de téléphone, de date de naissance ni de sexe ;
- les identifiants techniques quand une jointure les réclame ;
- une vue **par audience**, `security_invoker = false`, un seul `WHERE` dérivé
  d'`auth.uid()`, un test pgTAP dans les deux sens.

Ce n'est pas à rediscuter. Ce qui suit l'est.

## Les trois différences réelles, et ce sont elles le ticket

**1. La base juridique change.** Le coach exerce une fonction publique de la
box : son nom est au mur, l'exposer relève de l'exécution de son contrat. **Un
pair n'exerce aucune fonction.** Sa présence à un cours est un fait de vie
privée, et rien ne la rend nécessaire à l'exécution de son propre contrat avec
la box. Reste donc l'intérêt légitime — avec information et **droit
d'opposition** — ou le consentement.

**2. L'app ne montre pas ce que la salle montre.** L'argument qui semble
imparable — « ils se voient déjà en vrai » — ne tient pas : l'app transforme
« les gens que je croise le mardi » en une **liste consultable de chez soi de
qui s'entraîne quand**. Ce n'est pas le même objet. Quelqu'un qui évite un ex,
ou qui préfère simplement que ses horaires ne soient pas lisibles par cent
personnes, a un intérêt réel.

**3. Opt-in ou opt-out.** Un opt-in sur une liste d'inscrits a un taux de
complétion médiocre, et une feuille à moitié anonyme n'aide personne. La forme
probablement plus juste est celle que la spec applique déjà au partage
inter-box : **intérêt légitime, information claire, opt-out** — « ne pas
apparaître dans la liste des inscrits ».

**Contrainte irréversible à ne pas prendre à la légère** : une valeur d'enum ne
se retire pas (`alter type … add value` est additif). Ajouter une finalité de
consentement est définitif ; c'est la raison pour laquelle cette décision n'a
jamais été prise en passant.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| La règle d'exposition d'identité | `.claude/rules/privacy.md` (P1-010) | ✅ écrite — ce ticket n'a plus qu'à dire ce qui change |
| `tenant_coaches` comme précédent immédiat | P1-010 | ✅ la vue, ses grants, son test négatif |
| `bookings` et ses policies | P1-003 | ✅ existent — la feuille d'inscrits se lit là |
| L'écran de détail d'un cours | P1-003b | ❌ à créer, **et c'est lui la condition** : la décision se prend avec l'écran sous les yeux |
| La case `LEADERBOARD` des consentements | P0-004, écran de P0-005a | ✅ existe et **n'a toujours aucun lecteur** — sixième « livré sans appelant ». À reprendre ici plutôt qu'à doubler |

## Hors périmètre

- **La feuille de présence d'un coach** — ce qu'un coach voit des inscrits de
  **son** cours. Quatrième audience, elle a ses propres raisons (il encadre, il
  compte, il pointe) et mérite son ticket. Notée dans la règle, sans ticket
  à ce jour.

## Les trois décisions, prises

Écrites en tête de la migration `20260905090000_class_roster.sql`, parce que
c'est là qu'on les relira, et résumées dans `.claude/rules/privacy.md`, où le
tableau des audiences porte enfin sa quatrième ligne.

1. **Base juridique : intérêt légitime, information, opposition.** Un coach
   exerce une fonction publique de la box ; un pair n'exerce aucune fonction, et
   sa présence à un cours est un fait de vie privée. L'opt-in a été écarté pour
   la raison déjà écrite : une feuille à moitié anonyme n'aide personne.
2. **`LEADERBOARD` n'est pas le contrôle.** Elle dit « ton prénom et tes
   **scores** » — le classement, P2-014. La recycler ferait faire à une case
   l'inverse de ce qu'elle annonce, et c'est un opt-in là où il faut un opt-out.
   Elle garde donc son lecteur pour P2-014 ; ce ticket ne lui en donne pas un
   faux.
3. **Le contrôle est une colonne, pas une finalité de consentement.**
   `memberships.hidden_from_roster` : par box, réversible, tracée dans
   `audit_logs`. Aucune valeur d'enum ajoutée — la contrainte irréversible que
   trois tickets refusaient de prendre à la légère n'a pas été prise du tout.

## Le trou de la règle 8, et ce qu'il a coûté

**Une opposition qu'on ne peut pas exercer n'existe pas.** Vérifié dans le dépôt
avant d'écrire : `(auth)/consents.tsx` n'est atteignable que par l'aiguillage de
démarrage, quand `me()` réclame `ACCEPT_CONSENTS`. Après l'inscription, il n'est
plus joignable, et aucun écran de réglages n'existait.

Conséquence qui dépassait ce ticket : `PUSH` et `LEADERBOARD` se donnaient une
fois et **ne se retiraient jamais**, ce qui contredisait `.claude/rules/privacy.md`
— « un consentement se retire aussi simplement qu'il se donne ». Le trou
existait avant ; c'est ce ticket qui l'a rendu bloquant, parce qu'il ajoute une
exposition **visible par défaut**. D'où `(app)/preferences.tsx`, et d'où
2 → 3,5 j·h.

## La fuite trouvée avant le commit

`rls-auditor` l'a trouvée alors que la vue, ses six tests d'isolation et les
380 tests pgTAP étaient verts. **La colonne d'opposition était lisible par
n'importe quel membre de la box** : `memberships` rend toutes ses colonnes à tout
membre du tenant depuis P0-004, et `.claude/rules/privacy.md` l'assumait — « aucun
nom, donc aucune fuite d'identité ». Vrai tant que la table ne portait que des
faits d'appartenance ; faux à la seconde où on y a mis une opposition RGPD.

Reproduit à la main avant de corriger : Léa, simple MEMBER, lisait
`hidden_from_roster = true` sur la ligne de Julie — exactement ce que la vue
existe pour ne pas dire à un pair. Le chemin gardé était la vue, le jumeau oublié
le grant de table. Corrigé par un grant de colonne et `get_roster_visibility()`,
et **prouvé par un test qui attend un `42501`** — celui qui manquait, et sans
lequel tout le reste était un faux vert.

## Critères d'acceptation

- [x] Le ticket dit **en quoi un pair diffère d'un coach**, et la règle commune
      n'est pas réécrite mais citée
- [x] La base juridique est tranchée, et l'opt-in / opt-out avec
- [x] Aucune finalité de consentement n'est ajoutée — et le ticket dit pourquoi
      une colonne était le bon outil pour une **opposition**
- [x] Une vue restreinte, jamais un élargissement de la policy de `users`
- [x] Un membre d'une autre box ne voit rien — test pgTAP dans les deux sens,
      **plus** le cas qui distingue une feuille d'un annuaire : un membre de la
      box **non inscrit au cours** ne voit rien non plus, coach compris
- [x] La case `LEADERBOARD` **n'est pas** le bon contrôle, et le ticket dit
      pourquoi. Elle trouve tout de même un lecteur : l'écran de préférences la
      rend enfin **retirable**
- [x] L'opposition est exerçable **depuis l'app**, et pas seulement en base
- [ ] **Sur appareil** : la feuille est lisible et annoncée, l'opposition la fait
      disparaître, la réactivation la fait revenir. Trois gestes, à la prochaine
      passe — le harnais web les a tous exercés, mais il ne coche aucun critère
      de parcours.

      **Passe du 5 septembre 2026 : geste 1 conforme, gestes 2 et 3 ont trouvé un
      défaut**, corrigé ci-dessous. Le critère reste ouvert jusqu'à ce que les
      trois soient rejoués sur l'appareil avec le correctif.

## Le défaut de la passe : l'écran affirmait le contraire de la base

Couper « Apparaître dans la liste des inscrits », revenir sur la fiche du cours :
**on s'y voyait toujours**. Il fallait remonter au planning et rouvrir la séance
pour que la feuille dise la vérité.

Rien n'était faux en base — l'opposition était bien enregistrée, et les autres
inscrits ne voyaient plus la personne. C'est l'écran qui mentait, et il mentait
**dans le sens qui coûte le plus cher** : quelqu'un qui vient de demander à
disparaître se voit encore, et n'a aucune raison de croire que le reste a marché.
Un affichage périmé sur un contrôle de vie privée n'est pas un défaut cosmétique.

**La cause n'a rien à voir avec la feuille.** `class/[id].tsx` chargeait ses
données dans un `useEffect` monté une fois. L'écran de préférences est *poussé
par-dessus* celui-là, et `router.back()` rend la main à la **même instance** :
aucun effet ne rejoue. Corrigé par un `useFocusEffect` — premier passage avec son
squelette, retours rafraîchis en silence, et un rafraîchissement qui échoue
laisse à l'écran ce qui s'y trouve plutôt que d'y mettre une erreur.

**Et les trois autres écrans ont exactement le même montage** —
`planning.tsx:103`, `index.tsx:48`, `bookings.tsx:55`. Le plus visible : on
réserve depuis une fiche, on revient au planning, **le nombre de places
restantes n'a pas bougé**. Ce n'est plus le sujet de ce ticket-ci, c'est
`D-016` — écrit le jour même, avec la forme déjà éprouvée ici à reprendre.
