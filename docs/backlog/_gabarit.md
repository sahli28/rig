# `<ID>` — `<titre en une ligne>`

**Phase** `<P0|P1|P2|P3|dette>` · **Estimation** `<n>` j·h · **Dépend de** `<tickets>` · **Spec** `<§…>`

## Objectif

Une phrase : ce qui est vrai après ce ticket et ne l'était pas avant. Si la
phrase parle d'une fonction plutôt que d'un usage, le ticket est mal cadré.

## Ce que ce ticket suppose et qui doit exister

**Section obligatoire. Un ticket sans elle n'est pas prêt à être lancé.**

Trois explosions d'estimation ont la même cause, et une seule ligne écrite ici
les aurait attrapées toutes les trois :

| Ticket   | Ce qu'il supposait                        | Réalité                          | Coût     |
| -------- | ----------------------------------------- | -------------------------------- | -------- |
| P0-005   | un écran de connexion web                 | `apps/web` n'en avait aucun      | 5 → 17   |
| P1-001   | `class_types` en base                     | la table n'existait pas          | 4 → 11,5 |
| P1-001   | une bibliothèque de composants web        | rien au-delà des tokens          | idem     |

Lister **chaque** prérequis, avec son état **vérifié dans le dépôt**, pas
supposé. Trois colonnes, et la troisième est celle qui compte :

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `<table, fonction, écran, compte tiers, composant, variable d'environnement>` | `<chemin:ligne ou §spec>` | ✅ existe · ⚠️ existe mais partiel · ❌ **à créer — par quel ticket ?** |

Un `❌` sans ticket nommé en face est un ticket manquant dans le backlog. On
l'écrit **avant** de lancer celui-ci, on ne l'absorbe pas en cours de route.

Vérifier en particulier, dans cet ordre — ce sont les catégories qui ont déjà
coûté :

1. **Un écran par lequel un humain déclenche la chose.** Le cas le plus fréquent
   et le plus cher.
2. **Une table ou une colonne** que le ticket lit ou écrit.
3. **Un composant d'interface** qu'il faudra construire avant de composer l'écran.
4. **Un compte, une clé, un domaine, un délai administratif.** Ceux-là ne se
   rattrapent pas en codant plus vite.
5. **Un canal de sortie** — e-mail, push, webhook — que le ticket croit disponible.

## Ce que ce ticket rend possible, et qui l'appellera

Le pendant de la section précédente, et l'application de la règle « une fonction
sans appelant n'est pas faite ». Toute fonction SQL, tout helper, toute table
livrée ici nomme **l'appelant** et le ticket qui l'écrit.

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `<fonction / table / helper>` | `<écran, job, webhook>` | `<ID, ou « celui-ci »>` |

## Périmètre

Ce qui est fait. En puces, chacune vérifiable.

## Hors périmètre

Ce qui n'est pas fait, et **où c'est parti**. « Ce qui déborde devient un
nouveau ticket », pas une remarque en fin de session.

## Critères d'acceptation

- [ ] Formulés comme un comportement observable, pas comme une tâche accomplie
- [ ] Une règle métier (règles 1 à 6 de `CLAUDE.md`) a son test **avant** le code
- [ ] Ce qui doit être vérifié à la main est dit ici : parcours mobile, rendu
      visuel, webhook réel

### Trois états, et le troisième a une règle

`[ ]` à faire · `[x]` vérifié · **`[~]` non exerçable aujourd'hui**.

Le troisième existe parce que la seule autre issue était mauvaise : cocher par
raisonnement, ou effacer le critère. Cocher produit le faux vert que ce dépôt
passe son temps à traquer ; effacer fait disparaître une exigence qui reste
vraie. `[~]` la garde visible en disant pourquoi elle attend.

**Un `[~]` porte toujours deux choses** — sans elles, c'est un `[ ]` déguisé :

1. **la raison**, et une raison de fond, pas « pas eu le temps ». Un critère
   qu'on n'a pas encore fait reste un `[ ]` ;
2. **ce qui le rendra exerçable** : un ticket nommé, un compte tiers, un
   environnement. Si rien ne le rendra exerçable un jour, le critère est faux et
   il faut le réécrire, pas le marquer.

Trois exemples vivants, tous de P1-003b et D-013 : « membre sans droits »
(inatteignable tant que le droit *est* l'appartenance active → **P2-006**), le
p95 sur vingt appels (un Wi-Fi local donne un plancher, pas un p95 → **P1-004**
puis un environnement distant), le schéma `rack://` (Expo Go ouvre en `exp://` →
premier *development build*).

## Notes

Les pièges connus, les décisions déjà prises qu'il ne faut pas re-litiger, et ce
qu'on saura seulement en le faisant.
