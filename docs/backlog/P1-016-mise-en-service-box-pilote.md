# `P1-016` — La mise en service chez la box pilote

**Phase** `P1` · **Estimation** `≈ 3` j·h de technique **à arbitrer** + `4` jours d'accompagnement, **qui ne sont pas des j·h** · **Dépend de** tout le reste de ① · **Spec** §18.3, §18.4 · **Origine** l'écart de date, 9 septembre 2026

## Objectif

Un lundi matin, dans une vraie box, un vrai membre ouvre l'app et réserve un
vrai cours — et personne de l'équipe produit n'est en train de taper une
commande.

## Pourquoi ce ticket existe : il était déjà dans la date, pas dans le backlog

Le 9 septembre 2026, quelqu'un a fait le calcul : **19,5 j·h restants ÷ 2,3 j·h
par semaine ≈ 8,5 semaines**, donc début novembre 2026 — contre « janvier 2027 »
annoncé en tête du backlog. Deux mois d'écart.

**Ce n'est pas le calcul qui est faux, et ce n'est pas la date.** Le jalon ne dit
pas « le code est fini », il dit **« mise en production chez la box pilote »**.
L'écart entre les deux, c'est ce ticket — et il n'existait nulle part.

C'est la forme la plus coûteuse d'un travail manquant : **pas un ticket
sous-estimé, un ticket absent**, qui ne se découvre qu'au moment où on croyait
avoir fini. La règle 8 le dit pour un ticket ; ici elle s'applique au jalon.

## Ce que ce ticket suppose et qui doit exister

*Chaque état est vérifié dans le dépôt, le 9 septembre 2026.*

| Prérequis | Où il vit | État |
| --- | --- | --- |
| **Un projet Supabase hébergé** | *rien* — tout tourne en local (`supabase/config.toml`) | ❌ **à créer.** Et `CLAUDE.md` porte déjà la case à cocher du jour où il naîtra : **le major du projet hébergé doit être 17**, comme `config.toml:41`. Une divergence ne se découvre pas à la migration, elle se découvre sur une fonction absente, en production |
| **Un hébergement pour `apps/web`** | *rien* — aucun `vercel.json`, aucun workflow de déploiement (`.github/workflows/` n'a que `ci.yml`) | ❌ **à créer.** Vercel est nommé dans l'ADR 0001 comme dépendance assumée ; aucun projet n'existe |
| **L'app sur les téléphones des membres** | Expo Go aujourd'hui, sur le réseau local | ❌ **à créer** : un *development build* iOS puis TestFlight. **Le compte Apple est actif depuis le 8 sept. 2026** ✅, donc rien ne bloque administrativement. Et ce build **ferme des critères de quatre tickets** — `P1-003b`, `D-013`, `P1-007b`, `D-008` — voir le README |
| Un import CSV de membres | `P1-001d` ✅ fusionné (PR #15) | ✅ **l'outil existe** ; ce qui manque est le fichier réel de la box |
| Un parcours d'invitation | `P0-005a`, `D-005` ✅ | ✅ — mais **jamais exercé à 80 personnes d'un coup**, et la relance des non-inscrits n'a aucun outil |
| Un planning récurrent réel | `P1-002` ✅ | ✅ — le seed en a un ; la box a le sien, et il faut le saisir |
| **Une sauvegarde restaurée au moins une fois** | *rien* | ❌ **à créer**, et ce n'est pas négociable : à partir de ce ticket, la base contient les données personnelles de ~80 personnes réelles (§18.4, item 10) |
| **Le registre des traitements et l'information des membres** | *rien* | ⚠️ **§18.4 items 2 et 3 sont marqués bloquants pour le lancement commercial.** Ce ticket n'est pas le lancement — mais **des données personnelles réelles arrivent**, et deux de ces items ne peuvent pas attendre le MVP. À trancher avant, pas pendant |

## Ce que ce ticket demande de vous

| Lot | Nature | Coût |
| --- | --- | ---: |
| Projet Supabase hébergé, migrations appliquées, **major 17 vérifié**, secrets | technique | **à arbitrer** |
| Déploiement du back-office web, un domaine ou l'URL du fournisseur | technique | **à arbitrer** |
| *Development build* iOS, TestFlight, et les 80 invitations qui vont avec | technique | **à arbitrer** |
| Sauvegarde quotidienne + **une restauration réellement testée** | technique | **à arbitrer** |
| Configuration en visio avec la box : types de cours, salles, règles, horaires récurrents réels (§18.3 : 1 h annoncée) | accompagnement | 0,5 j |
| Import du fichier de membres, invitations, relance des non-inscrits | accompagnement | 0,5 j |
| **Présence en salle la première semaine**, deux créneaux | accompagnement | 1 j |
| Suivi J+7, appel J+30 (§18.3), et les correctifs de première semaine | accompagnement | 1 j |
| Réserve — la première semaine d'une vraie box n'est jamais celle qu'on a prévue | accompagnement | 1 j |

**≈ 3 j·h de technique, à arbitrer** — le chiffre est une première estimation et
il n'est **pas** dans le total ① aujourd'hui. **4 jours d'accompagnement**, qui
ne sont pas des jours-homme de développement et ne doivent pas y entrer : les
mélanger rendrait les deux chiffres inutilisables.

> ### La partie technique est du développement, et il faut trancher où elle vit
>
> Trois des quatre premiers lots ci-dessus sont du travail d'ingénierie, pas de
> l'accompagnement. Les laisser hors du total ① reproduit **exactement** l'erreur
> que le recompte du 9 septembre vient de corriger — un travail réel qui ne
> figure dans aucun chiffre finit par ne figurer nulle part.
>
> **Deux issues, à choisir explicitement** : les faire entrer dans ① (+3 j·h,
> total 109), ou en faire un ticket séparé `P1-017` qui y entre. Ce qui n'est pas
> une issue, c'est de les laisser dans une colonne « à arbitrer » plus d'une
> revue.

## Ce que ce ticket demande de la box

**Écrit ici parce que rien de tout cela ne dépend de vous, et que tout peut
bloquer une date :**

- **son fichier de membres**, exporté de son outil actuel, avec les adresses
  e-mail — c'est la donnée d'entrée de tout le reste ;
- **son planning réel** : les cours qu'elle donne vraiment, aux heures où elle
  les donne, avec les capacités réelles ;
- **une décision sur le double-run** : combien de temps elle garde son outil
  actuel en parallèle (§19.1, R3 : « période de double-run d'un mois ») ;
- **une personne responsable côté box**, jointe et disponible la première
  semaine — sans elle, chaque question fait perdre un jour ;
- **son accord pour que ses membres reçoivent une invitation par e-mail**, et
  l'annonce qu'elle en fera. Une invitation qui arrive sans que la box en ait
  parlé se lit comme du spam.

## Périmètre

- La mise en production technique (les quatre premiers lots).
- La configuration de la box avec elle, en visio.
- L'import, les invitations, la relance.
- La présence en salle et le suivi.
- **Le journal de ce qui casse**, tenu pendant la première semaine : c'est la
  meilleure source d'apprentissage produit du projet (§18.3), et elle ne se
  reproduit pas.

## Hors périmètre

- **Le lancement commercial.** §18.4 et ses 14 items sont pour le MVP vendable,
  pas pour une box pilote qui ne paie pas dans l'app. **Deux exceptions
  nommées** : la restauration testée et l'information des membres, parce que des
  données personnelles réelles entrent en jeu.
- **Le paiement.** Il se fait hors app au pilote, assumé et expliqué à la box.
- **Une deuxième box.** Ce ticket est écrit pour une seule, et le refaire pour la
  suivante sera un autre travail — plus court, et c'est ce qu'il faudra mesurer.

## Critères d'acceptation

- [ ] Un membre de la box, sur **son** téléphone, réserve un cours réel — sans
      Expo Go, sans réseau local, sans nous
- [ ] Le coach écrit sa séance de la semaine dans Rack, et **n'ouvre pas Hustle
      Up** — c'est le repère de `P1-015`, et il ne se mesure qu'ici
- [ ] Le back-office est atteignable depuis l'ordinateur de la box, sur une
      adresse qu'elle peut mettre en favori
- [ ] Le major du projet hébergé est **17**, vérifié dans le projet et non
      supposé
- [ ] Une sauvegarde a été **restaurée**, une fois, pour de vrai
- [ ] Le journal de première semaine existe, daté, et chaque défaut qu'il contient
      a un ticket ou une raison écrite de ne pas en avoir
- [ ] **appareil** — tout ce ticket est un critère d'appareil. Il ne se coche
      dans aucune CI

## Notes

**Ce ticket est le seul du backlog dont l'unité n'est pas le jour-homme.** Une
box ne se met pas en service en travaillant plus vite, et les quatre jours
d'accompagnement ne se compressent pas : ils sont faits d'un créneau chez
quelqu'un d'autre, d'un fichier qu'on attend, et d'une semaine où il faut être
joignable.

**R1 dit « ne jamais construire plus de 6 semaines sans mise en service ».** Au 9
septembre 2026, la dernière mise en service est… aucune. Ce ticket est la
première, et c'est aussi ce qui rend son absence du backlog remarquable : le
risque le plus documenté du projet n'avait pas de ligne.
