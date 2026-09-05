# P1-012 — Le planning dit ce qui est déjà réservé

**Phase** P1 · **Estimation** 2 j·h · **Dépend de** P1-003b ✅, P1-011 ✅ · **Après P1-004** · **Spec** §12.4

## Ce que la passe d'usage a montré

Une membre ouvre son planning et **ne voit pas qu'elle est inscrite au 18h30**.
L'information existe — « Mes réservations » la porte — mais il faut quitter
l'écran où l'on se pose la question pour aller la chercher ailleurs.

C'est du confort, pas du chemin critique. Mais c'est le genre de confort qui
décide si une box trouve l'app agréable ou pénible, et il se paie une fois.

## Périmètre

Deux niveaux, parce que ce sont deux questions différentes :

1. **Sur la ligne du cours** — un badge « Réservé ». La question est « suis-je
   inscrite à *celui-là* ? ».
2. **Sur le jour, dans le bandeau de semaine** — une pastille. La question est
   « ai-je quelque chose cette semaine, et quand ? », à laquelle on ne doit pas
   avoir à répondre en ouvrant sept journées l'une après l'autre.

**Le badge est un texte, jamais une couleur seule** (`.claude/rules/ui.md`). La
pastille du bandeau, elle, est un marqueur visuel : elle doit donc porter son
sens dans l'étiquette d'accessibilité du jour — « mardi 8, 2 réservations » — et
non seulement dans le pixel.

Ce ticket touche **le planning et le bandeau de semaine**, deux écrans livrés
séparément (P1-003b et P1-011). C'est pourquoi il est à part : glissé dans
P1-004, il aurait brouillé un ticket dont le sujet est une transaction.

## La décision à prendre : le marqueur hors ligne

**Le cache hors ligne exclut volontairement les réservations personnelles**
(P1-002b) : il garde le planning de la box, pas ce qui appartient à une
personne. Le marqueur disparaîtrait donc hors ligne, et le planning affirmerait
en creux « tu n'as rien réservé » — ce qui est faux.

Deux issues, et il faut choisir dans le ticket :

| Option | Ce que ça donne | Ce que ça coûte |
| ------ | --------------- | --------------- |
| **A — assumer et le dire** | Hors ligne, aucun marqueur, et une phrase à l'écran : « hors ligne — tes réservations ne sont pas affichées » | Une phrase de plus, et un écran qui avoue une limite au lieu de mentir |
| **B — mettre en cache les identifiants** | Une liste d'`id` de cours réservés, et rien d'autre | Rouvre le cache aux données personnelles, qu'on avait fermé exprès |

**Recommandation : B, strictement bornée aux identifiants.**

Le raisonnement de P1-002b était d'éviter de stocker des **données de membres**
sur l'appareil — noms, adresses, ce que `privacy.md` protège. Une liste d'`id`
de cours **que la personne a elle-même réservés, sur son propre téléphone,
derrière son propre trousseau** n'est pas de cette famille : elle ne révèle
personne d'autre, et son détenteur la connaît déjà.

L'option A a un défaut qui n'est pas cosmétique : elle rend l'écran **moins
fiable hors ligne que le reste de l'app**, alors que le planning, lui, s'affiche.
Une personne dans un sous-sol de salle de sport — le lieu même où l'on consulte
un planning — verrait ses cours et pas ses inscriptions.

Deux garde-fous à écrire avec l'option B, sans quoi elle devient A en pire :

- **des identifiants et rien d'autre.** Pas d'heure, pas de nom de cours, pas de
  statut. Le marqueur se pose en croisant cette liste avec le planning déjà en
  cache ;
- **purge à la déconnexion**, comme le cache de planning (P1-002b), et clé
  partitionnée par `user_id` **et** `tenant_id` — le cas du téléphone partagé a
  déjà été traité une fois, ne pas le repayer.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `bookings`, et la lecture de ses propres réservations | P1-003 ✅ | ✅ existe — policy `bookings_own_select` |
| L'écran de planning mobile et sa ligne de cours | P1-003b ✅ | ✅ existe |
| Le bandeau de semaine | P1-011 ✅ | ✅ existe, avec sa suite de tests |
| Le cache hors ligne et sa clé partitionnée | P1-002b ✅ | ✅ existe — **à étendre**, voir la décision ci-dessus |
| La purge à la déconnexion | P1-002b ✅ | ✅ existe — le nouveau cache doit s'y brancher, pas en créer une seconde |
| Une suite de tests pour `apps/mobile` | P1-011 ✅ | ✅ existe depuis P1-011 — c'est elle qui rend ce ticket testable sans appareil |
| Le planning **web** | P1-002 ✅ | ⚠️ **hors périmètre, et à décider** : le staff regarde le planning de la box, pas ses propres réservations. Le marqueur n'y a probablement pas de sens — le dire plutôt que l'oublier |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| Le badge « Réservé » sur une ligne de cours | le planning mobile | celui-ci |
| La pastille du bandeau de semaine | le bandeau (P1-011) | celui-ci |
| Le cache des identifiants réservés | les deux ci-dessus | celui-ci |

## Critères d'acceptation

- [ ] Une membre inscrite au 18h30 le voit **sur la ligne du cours**, sans
      ouvrir le détail
- [ ] Le badge est un texte lisible par VoiceOver, pas une couleur seule
- [ ] Le bandeau marque les jours où l'on a au moins une réservation, et
      l'étiquette d'accessibilité du jour le dit en toutes lettres
- [ ] Annuler une réservation (P1-004) fait disparaître le marqueur **au retour
      sur le planning**, sans relancer l'app — c'est le geste 3 de `D-016`, et il
      s'est déjà fait prendre deux fois
- [ ] Hors ligne, le marqueur reste affiché à partir du cache
- [ ] Se déconnecter efface ce cache : le compte suivant sur le même téléphone ne
      voit aucun marqueur du précédent
- [ ] Deux boxes sur le même compte ne mélangent pas leurs marqueurs

## Notes

Le quatrième critère est le piège de ce ticket, et il est connu : un marqueur est
un état dérivé, et les états dérivés de cet écran ont déjà affiché le contraire
de la base deux fois (P1-003c, puis `D-016`). Le relire au retour d'écran n'est
pas une précaution, c'est la règle du dépôt.
