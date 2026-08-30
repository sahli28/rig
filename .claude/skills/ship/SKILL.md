---
name: ship
description: Prépare et crée le commit d'un ticket terminé, sur une branche dédiée.
argument-hint: [ticket-id]
disable-model-invocation: true
allowed-tools: Bash(git status *) Bash(git diff *) Bash(git add *) Bash(git commit *) Bash(git checkout -b *) Bash(git log *)
---

Prépare la livraison du ticket **$0**.

## Préalables — ne pas commiter si l'un échoue

1. `/check` est passé au vert dans cette session. Sinon, relance-le.
2. Le sous-agent `spec-keeper` rend `VERDICT: DONE` sur ce ticket.
3. Les critères d'acceptation sont cochés dans `docs/backlog/$0*.md`.

## Commit

- Si la branche courante est `main`, crée `feat/$0-<slug-court>` d'abord.
- `git add` uniquement les fichiers du ticket. Rien d'autre — pas de `git add -A`
  qui ramasserait des fichiers de travail.
- Message de commit :

```
<type>($0): <résumé impératif en une ligne>

<pourquoi ce changement, pas ce qu'il fait — le diff le dit déjà>

Décisions:
- <choix non évident et sa raison>

Dépendances ajoutées: <nom + justification, ou "aucune">
Vérifié: typecheck, lint, tests, test:db
Reste à vérifier à la main: <parcours mobile, rendu visuel, webhook réel, ou "rien">
```

Types : `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `db`.

## Après le commit

- **Ne pousse pas** (`git push` est refusé par les permissions du projet, volontairement :
  la poussée est une décision humaine).
- Affiche le résumé du commit et la commande de push à lancer à la main.
- Indique le ticket suivant recommandé dans `docs/backlog/`.
