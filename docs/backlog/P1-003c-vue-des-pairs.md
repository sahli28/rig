# P1-003c — La feuille d'inscrits : en quoi un pair diffère d'un coach

**Phase** P1 · **Estimation** 2 j·h · **Dépend de** P1-003b · **Spec** §5.2

## Objectif

Un membre voit qui d'autre est inscrit au cours qu'il regarde — ou ne le voit
pas, et le ticket dit lequel. **La décision est le livrable**, l'écran vient
après.

## Ce ticket ne se lance pas encore

D-001 a différé cette question, P1-003 l'a reléguée à son lot 2, et P1-003b l'a
laissée dehors — trois fois, pour la même raison, et elle est bonne : elle se
tranche **avec l'écran sous les yeux**. Le détail d'un cours arrive en P1-003b ;
ce ticket se lance après lui, pas avant.

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

## Critères d'acceptation

- [ ] Le ticket dit **en quoi un pair diffère d'un coach**, et la règle commune
      n'est pas réécrite mais citée
- [ ] La base juridique est tranchée, et l'opt-in / opt-out avec
- [ ] Si une finalité de consentement est ajoutée, le ticket dit pourquoi elle
      est irréversible et pourquoi c'est acceptable
- [ ] Une vue restreinte, jamais un élargissement de la policy de `users`
- [ ] Un membre d'une autre box ne voit rien — test pgTAP dans les deux sens
- [ ] La case `LEADERBOARD` trouve enfin son lecteur, ou le ticket dit pourquoi
      elle n'est pas le bon contrôle
