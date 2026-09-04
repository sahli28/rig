# P1-010 — L'annuaire des coachs, lisible par un membre

**Phase** P1 · **Estimation** 1 j·h · **Dépend de** P0-004 ✅, D-001 ✅ · **Spec** §5.2, §6.1

## Objectif

Un membre voit **qui anime** le cours sur son planning. Aujourd'hui il ne le
peut pas, et rien dans la base ne le lui permet.

## Le trou, tel qu'il a été trouvé

Découvert en écrivant P1-002b, à l'endroit exact où la règle 8 est censée
attraper les choses — sauf que le ticket, écrit par moi, avait supposé le
problème résolu : il listait le prénom du coach parmi les données à mettre en
cache, sans jamais demander **d'où il viendrait**.

L'état réel, vérifié en base :

| Source | Qui peut la lire | Ce qu'elle porte |
| ------ | ---------------- | ---------------- |
| `public.users` | policy `id = auth.uid()` — **soi-même uniquement** | tout le profil |
| `public.memberships` | `tenant_id in current_tenant_ids()` — tout membre de la box | rôle, statut, `user_id`. **Aucun nom** |
| `member_admin_directory` | `current_admin_tenant_ids()` — OWNER et MANAGER | nom, prénom, **et l'e-mail** |

Le back-office s'en sort parce qu'il est réservé au staff : sa grille de
planning lit `member_admin_directory`. Le mobile n'a pas cette porte, et il ne
doit pas l'avoir — cette vue porte les adresses de tous les membres.

## Pourquoi ce n'est pas la vue des pairs

À ne pas confondre avec la question que P1-003c doit trancher. Ce sont deux
objets différents :

- **la vue des pairs** — qui est inscrit à ce cours — expose des membres à
  d'autres membres. C'est la décision de confidentialité difficile, celle qui
  ajoute une finalité de consentement, et une valeur d'enum ne se retire pas ;
- **l'annuaire des coachs** — qui anime les cours de cette box — expose des
  personnes **dans l'exercice de leur fonction**, sur une information déjà
  affichée au mur de la salle et sur le site de la box. Le planning papier la
  porte depuis toujours.

Le second n'a pas besoin d'attendre le premier, et il ne le préempte pas.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `memberships` avec les rôles, lisible par un membre | P0-004 | ✅ existe — c'est la moitié qui marche |
| `member_admin_directory` comme précédent de vue restreinte | D-001 | ✅ existe, et **montre le patron à suivre** : une vue, ses grants, son test d'isolation |
| `current_tenant_ids()` | P0-004 | ✅ existe |
| Le patron « minimisation à l'intérieur d'une box » | `.claude/rules/privacy.md` | ✅ écrit, et il dit déjà qu'un coach n'a besoin que d'un prénom et d'une initiale |
| Un écran qui l'appelle | **P1-002b** | ⚠️ existe **sans le coach** : le planning mobile est livré avec le filtre par type seulement. C'est son appelant, et il l'attend |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `tenant_coaches` — vue restreinte des coachs de la box | le planning mobile (nom + filtre) | P1-002b |
| idem | l'écran de détail d'un cours | P1-003b |

## Périmètre

- Une vue `tenant_coaches` : `membership_id`, `first_name`, **initiale** du nom,
  `avatar_url`. Filtrée sur `current_tenant_ids()`, limitée aux rôles
  `OWNER` / `MANAGER` / `COACH` **actifs**.
- **Jamais d'e-mail, jamais de date de naissance, jamais de sexe** — c'est la
  différence avec `member_admin_directory`, et c'est tout l'objet d'une seconde
  vue plutôt que d'un élargissement de la première.
- Ses `grant` explicites : les privilèges par défaut ont été retirés (D-006).
- Un test pgTAP : un membre de Rueil lit les coachs de Rueil, **pas ceux de
  Nanterre**, et ne lit aucune adresse.

## Hors périmètre

- **La feuille d'inscrits** : P1-003c, et c'est une autre décision.
- Une fiche de coach, une bio, des photos : rien ne le demande.

## Critères d'acceptation

- [ ] Un membre lit le prénom du coach de sa box, et l'initiale de son nom
- [ ] Un membre ne lit **aucune** adresse e-mail par cette vue — contrôle négatif
- [ ] Un membre de Rueil ne voit aucun coach de Nanterre (`rls_leak_test.sql`)
- [ ] Un membre retiré (`status <> 'ACTIVE'`) ne figure pas dans l'annuaire
- [ ] Le planning mobile affiche le coach et le propose en filtre (P1-002b)

## Notes

**Ce ticket existe parce que la règle 8 a échoué une fois.** Elle demande de
vérifier chaque prérequis dans le dépôt ; j'ai listé le prénom du coach comme
une donnée à mettre en cache sans chercher d'où il viendrait. La section
« ce que ce ticket suppose » de P1-002b était complète sur tout le reste et
muette là-dessus — un prérequis qu'on ne pense pas à formuler ne se vérifie pas.

Le correctif de méthode tient en une phrase : **toute donnée listée comme
affichée ou mise en cache doit nommer sa source lisible par l'appelant.** Une
colonne n'est pas une source ; une policy en est une.
