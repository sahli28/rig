# P1-010 — L'annuaire des coachs, et la règle d'exposition d'identité

**Phase** P1 · **Estimation** 1 j·h · **Dépend de** P0-004 ✅, D-001 ✅ · **Spec** §5.2, §6.1

## Objectif

Un membre voit **qui anime** le cours sur son planning. Et, plus durablement :
le dépôt cesse de retrancher « qui peut lire le nom de qui » à chaque écran.

## Pourquoi ce ticket porte plus que son titre

C'est la **troisième fois** que la question se pose, et la quatrième arrive :

| Audience | Qui voit qui | Où c'est tranché |
| -------- | ------------ | ---------------- |
| Administrative | OWNER/MANAGER voient tous les membres, e-mail compris | D-001 — `member_admin_directory` ✅ |
| **Coachs** | un membre voit qui anime son cours | **ce ticket** |
| Pairs | un membre voit les autres inscrits d'un cours | P1-003c — non tranché |
| Présence | un coach voit qui est inscrit à **son** cours | pas encore de ticket |

Trois vues ad hoc aux règles différentes, ce serait trois surfaces d'exposition
d'identité qu'on ne compare jamais — la règle des sœurs, appliquée à des données
personnelles, donc avec une autorité de contrôle au bout. La quatrième
arriverait sans que personne ne relise les trois autres.

Ce ticket construit donc **la vue dont il a besoin, rien de plus**, et écrit la
règle une fois. `P1-003c` n'aura plus qu'à dire **en quoi un pair diffère d'un
coach** — et cette différence est réelle, elle mérite d'être discutée pour
elle-même plutôt que redécouverte.

## La règle d'exposition d'identité

**Elle vit dans `.claude/rules/privacy.md`**, parce qu'un ticket se ferme et
qu'une règle doit se charger au moment où on écrit la requête. Ce qui suit est
son raisonnement ; la version opérante est là-bas.

### 1. Ce qu'un membre voit d'un coach

**Prénom, initiale du nom.** Jamais l'e-mail, jamais le téléphone, jamais la
date de naissance, jamais le sexe.

L'initiale plutôt que le nom : c'est déjà ce que `privacy.md` impose au partage
inter-box, et une vue qui ne transporte qu'un caractère ne peut pas laisser
fuir un patronyme par inadvertance.

### 2. Sur quelle base — et pourquoi ce n'est pas du consentement

**Le coach exerce une fonction publique de la box.** Son nom est sur le planning
affiché au mur et sur le site de la salle ; l'afficher aux membres de sa propre
box relève de l'exécution de son contrat avec la box, pas d'un consentement
qu'il pourrait retirer sans cesser d'animer les cours.

Une conséquence à ne pas oublier, et qui est le prix de cette base :
**le coach doit en être informé**. Une base qui n'est pas le consentement ne
dispense pas de l'information — elle dispense de la case à cocher. La box est
responsable de traitement ; l'interface de ses droits est P2-002.

**La photo, elle, est du consentement** — et elle n'entre pas dans ce ticket
(voir plus bas).

### 3. L'identifiant d'appartenance entre dans la vue — je conteste ce point

La position initiale disait « jamais l'identifiant d'appartenance ». **Elle ne
tient pas, et pour deux raisons vérifiées en base plutôt que supposées.**

D'abord, il est **déjà exposé**. Léa, simple `MEMBER` de Rueil, lit aujourd'hui :

```sql
select distinct coach_membership_id from public.classes;   -- 1 ligne
select id, role, user_id from public.memberships;          -- toute sa box
select count(*) from public.users;                         -- 1 : elle-même
```

`classes.coach_membership_id` est en clair pour tout membre depuis P1-002, et
`memberships` lui rend `id`, `user_id`, `role`, `joined_at` et `left_at` pour
**tous** les membres de sa box. L'interdire dans la vue ne retirerait rien du
produit : ça rendrait seulement la vue impossible à joindre au planning, qui
part précisément de `coach_membership_id`.

Ensuite, ce n'est pas ce que la ligne cherchait à protéger. Un `membership_id`
est un identifiant **pseudonyme**, opaque, interne à une box dont on est déjà
membre. Ce qui distingue une personne d'un pseudonyme, c'est le **nom** et les
**moyens de la contacter** — et c'est là que la ligne doit tomber.

**Reformulation proposée** : jamais d'e-mail, de téléphone, de date de
naissance ni de sexe ; les identifiants techniques, oui, quand une jointure les
réclame et qu'ils sont déjà lisibles par l'appelant.

**Un angle mort trouvé en le vérifiant, et qui vaut plus que ce ticket** :
`memberships` est lisible en entier par tout membre de la box — `user_id`,
rôles, dates d'arrivée et de départ. On s'apprêtait à écrire une vue soignée à
côté d'une table grande ouverte. Ce n'est pas une fuite de noms, et ça mérite
d'être **regardé** plutôt que découvert : voir « ce qui n'est pas dans ce
ticket ».

### 4. Un membre d'une autre box ne voit pas plus

Le réseau inter-box est P3, et la règle s'y applique d'avance : prénom,
initiale, box d'origine, photo si consentie. C'est **déjà** la ligne de
`privacy.md`, mot pour mot — le coach n'invente donc pas un troisième standard,
il réutilise celui du partage inter-box.

### 5. Filtrée par appartenance, comme tout le reste

Un membre de Nanterre ne lit pas les coachs de Rueil. Même discipline que
`member_admin_directory` : `security_invoker = false`, un seul `WHERE` dérivé
d'`auth.uid()`, aucun paramètre du client, et un test pgTAP qui le prouve dans
les deux sens.

**Une vue par audience, jamais une vue unique à colonnes conditionnelles.** La
raison est déjà écrite dans la migration de D-001 : le contrôle doit être un
seul `WHERE`, pas un `case` par colonne sensible. Un `case` oublié sur une
colonne ajoutée plus tard est invisible en revue ; un `WHERE` faux rend zéro
ligne.

## La photo : non, et ce n'est pas qu'une question de périmètre

Le §6.1 dit « coach + photo ». Elle n'entre pas ici, pour une raison plus solide
que le périmètre : **elle n'a pas de producteur**.

`users.avatar_url` existe comme colonne et `ProfilePatchSchema` l'accepte — mais
il n'y a **aucune couche de stockage, aucun téléversement, aucune modération**.
P1-001f (logo et couche Storage) est encore à faire. Une photo de coach
aujourd'hui, c'est une colonne toujours nulle : on livrerait l'exposition d'une
donnée que personne ne peut produire, et le consentement qui va avec, pour rien.

Elle entrera quand elle aura un producteur — après P1-001f — et elle sera alors
**du consentement**, pas de l'exécution du contrat : une photo n'est pas
nécessaire pour animer un cours.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `memberships` avec les rôles, lisible par un membre | P0-004 | ✅ existe — et **trop largement**, voir plus bas |
| `member_admin_directory` comme patron de vue restreinte | D-001 | ✅ existe : la vue, ses grants, son test d'isolation, et le commentaire qui explique `security_invoker = false` |
| `current_tenant_ids()` | P0-004 | ✅ existe |
| `users.first_name` / `last_name` | P0-004 | ✅ existent ; la policy `id = auth.uid()` est **contournée par la vue**, d'où la discipline du `WHERE` |
| Le patron « minimisation à l'intérieur d'une box » | `.claude/rules/privacy.md` | ✅ écrit — et il dit déjà « prénom et initiale » pour l'inter-box |
| L'écran qui l'appelle | P1-002b ✅ | ⚠️ livré **sans le coach**. Il l'attend : nom sur chaque ligne, et filtre |
| `classes.coach_membership_id` lisible par un membre | P1-002 | ✅ vérifié en base — c'est la clé de jointure |
| Un stockage de photos | P1-001f | ❌ n'existe pas — d'où « pas de photo dans ce ticket » |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `tenant_coaches` — vue restreinte des coachs de la box | le planning mobile : nom sur la ligne, et filtre | **P1-002b** (rouvert d'un cheveu) |
| idem | le détail d'un cours | **P1-003b** |
| La règle d'exposition d'identité | `P1-003c`, qui n'aura plus qu'à dire ce qui change pour un pair | P1-003c |

## Périmètre

- Vue `tenant_coaches` : `tenant_id`, `membership_id`, `first_name`,
  `last_initial`. Filtrée sur `current_tenant_ids()`, limitée aux rôles
  `OWNER` / `MANAGER` / `COACH` **actifs et non partis**.
- Ses `grant` explicites : les privilèges par défaut ont été retirés (D-006),
  sans grant la vue est inaccessible.
- Test pgTAP : un membre lit les coachs de sa box, **pas ceux de l'autre**, et
  **aucune adresse** ne sort par ce chemin — contrôle négatif compris.
- La règle d'exposition écrite dans `.claude/rules/privacy.md`.
- Le planning mobile affiche le coach et le propose en filtre.

## Hors périmètre

- **La photo** : après P1-001f, et sur consentement.
- **La feuille d'inscrits** (ce qu'un membre voit des autres membres) : P1-003c.
- **La feuille de présence** (ce qu'un coach voit de son cours) : pas encore de
  ticket, et la règle l'attend.
- **Resserrer les colonnes de `memberships`** : voir ci-dessous.

## Ce qui n'est pas dans ce ticket, et qui mérite un regard

`memberships` rend à tout membre de la box, pour **tous** les autres :
`user_id`, `role`, `status`, `joined_at`, `left_at`. Aucun nom, donc aucune
fuite d'identité — mais de quoi compter l'effectif, lire les rôles et dater les
arrivées et les départs.

Ce n'est pas nécessairement faux : le planning a besoin de résoudre un coach, et
la vue des pairs en aura besoin aussi. C'est simplement **une surface que
personne n'a choisie** — elle vient des grants de table de P0-004, pas d'une
décision. Elle est notée ici pour que la prochaine relecture d'exposition la
compare aux trois vues, au lieu de la découvrir.

## Critères d'acceptation

- [x] Un membre lit le prénom du coach de sa box, et l'initiale de son nom —
      « Sarah D. », « Hugo P. » sur le planning, relevé dans l'arbre
- [x] Un membre ne lit **aucune** adresse e-mail par cette vue — trois
      `hasnt_column` : `email`, `last_name`, `birthdate`. La colonne **n'existe
      pas**, ce qui vaut mieux qu'une colonne vide : ce qui n'est pas dans la vue
      ne peut pas y revenir par un `select *` distrait
- [x] Un membre de Rueil ne voit aucun coach de Nanterre, et l'inverse — les
      deux sens, parce qu'un test d'isolation qui rend zéro des deux côtés ne
      prouve rien
- [x] Un membre dont l'appartenance n'est plus `ACTIVE` ne figure pas dans
      l'annuaire, et un membre parti non plus
- [x] Un simple `MEMBER` n'apparaît pas comme coach
- [x] Un visiteur anonyme n'a **aucun droit** sur la vue — critère reformulé en
      cours de route : la première version attendait « zéro ligne » et a échoué
      sur `permission denied`. C'était le bon comportement mal formulé, et un
      refus au niveau du droit est plus fort qu'un filtre qui rend vide
- [x] Le planning mobile affiche le coach sur chaque ligne et le propose en
      filtre — vérifié : sélectionner « Sarah D. » ne laisse que son cours
- [x] `.claude/rules/privacy.md` porte la règle, et `P1-003c` la cite

## Notes

**Ce ticket existe parce que la règle 8 a échoué une fois.** P1-002b listait le
prénom du coach parmi les données à mettre en cache sans chercher d'où il
viendrait. Le correctif de méthode tient en une phrase, et il rejoint la
section obligatoire du gabarit : **toute donnée listée comme affichée ou mise en
cache doit nommer sa source lisible par l'appelant.** Une colonne n'est pas une
source ; une policy en est une.
