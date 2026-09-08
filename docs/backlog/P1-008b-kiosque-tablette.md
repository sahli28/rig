# `P1-008b` — Le kiosque à l'entrée

**Phase** `P1` · **Estimation** `3` j·h · **Dépend de** `P1-008a` · **Spec** §4-P3, RM3.1–3.6 · **Hors du pilote** — deux raisons, voir ci-dessous

*Découpé de `P1-008` le 8 septembre 2026, en même temps que `P1-008a`.*

## Objectif

Une tablette posée à l'entrée, caméra en plein écran : le membre scanne son QR
tout seul, sans mobiliser un coach.

## Pourquoi il sort du pilote, et pourquoi **deux** raisons valent mieux qu'une

Ce ticket est bloqué **deux fois, indépendamment**. Les nommer toutes les deux
n'est pas de la rigueur pour la rigueur : **acheter le domaine ne le débloquerait
pas**, et quelqu'un qui n'en verrait qu'une le croirait.

### 1. Pas d'HTTPS, donc pas de caméra

`getUserMedia` n'est pas exposée hors contexte sécurisé. Sur
`http://<IP>:3000` — ce qu'une tablette voit quand elle atteint le serveur par
son adresse locale — **l'API est absente de l'objet**, pas refusée. Le scan ne
peut donc pas exister, ce n'est pas un problème de test.

Le seul HTTPS qu'on aura passe par **le nom de domaine**, seconde des deux lignes
du chemin critique.

### 2. Pas d'identité pour une tablette, et pas de raison d'en inventer une

L'authentification du produit est un code à six chiffres envoyé par e-mail, **par
personne**. Une tablette posée à l'entrée n'est pas une personne. Trois issues
ont été pesées le 8 septembre 2026 :

| Issue | Verdict |
| --- | --- |
| Un **compte de staff laissé connecté** | ❌ **écarté net.** Une tablette non surveillée qui porte les droits d'un `MANAGER` dans un vestiaire est indéfendable, et **impossible à écrire dans le registre RGPD** |
| Un **jeton de kiosque révocable**, propre à la box | ✅ la bonne réponse, **mais pas maintenant** : nouvelle table, nouvelle notion, un secret à stocker — conçu sans qu'aucune box réelle l'ait demandé. C'est un mécanisme avant son appelant, et la **règle 7 vaut aussi dans ce sens-là** |
| **Pas de kiosque au pilote** | ✅ **retenu** |

**Et ça ne coûte rien au jalon.** La box pilote a un coach à la porte : il scanne
depuis son téléphone, ou coche à la main — **RM3.6 fait déjà du pointage manuel
le repli universel**. La capacité « pointer » du jalon est tenue sans kiosque,
par `P1-008a`.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | État |
| --- | --- |
| `checkins`, la fonction de pointage, le jeton signé | ❌ **`P1-008a`** |
| Un nom de domaine, donc de l'HTTPS servi à la tablette | ❌ **démarche administrative** — chemin critique du README |
| Une identité de tablette | ❌ **décision non prise, et volontairement** — voir ci-dessus |
| Un PWA web | ❌ `apps/web/public` **n'existe pas** : ni manifeste, ni service worker, ni icône |
| Une file hors ligne côté web | ❌ rien. Le cache mobile (`schedule-cache.ts`) ne s'y transpose pas |

## Périmètre

- Un PWA installable sur la tablette : manifeste, icône, service worker.
- Caméra plein écran, retour visuel **et sonore** immédiat.
- File hors ligne : on accepte et on met en file, **on ne vérifie pas** — même
  raison que dans `P1-008a`, et elle est écrite là-bas.
- L'identité de la tablette, dans la forme qui aura été tranchée.

## Hors périmètre

Tout ce que `P1-008a` livre. Ce ticket ne fait qu'ajouter une seconde porte
d'entrée à un pointage qui existe déjà.

## Critères d'acceptation

- [ ] La tablette scanne et valide en moins de 1,5 seconde, en plein écran
- [ ] Wifi coupé : le pointage passe et se synchronise ensuite sans doublon
- [ ] La tablette **ne porte aucun droit** au-delà du pointage — c'est le critère
      qui décide de la forme de son identité
- [ ] Retirer une tablette du parc coupe son accès immédiatement *(et à écrire
      quand ce sera vrai : une session révoquée reste utilisable jusqu'à quinze
      minutes, `.claude/rules/api.md`)*

## Notes

**Ce ticket se rouvre à deux conditions, pas une.** Le domaine acheté, et une box
réelle qui demande le kiosque. La seconde compte autant que la première : c'est
elle qui dira quelle forme d'identité mérite d'être construite.
