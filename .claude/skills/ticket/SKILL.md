---
name: ticket
description: Implémente un ticket du backlog de bout en bout — lecture du ticket, plan, tests, code, vérification.
argument-hint: [ticket-id]
disable-model-invocation: true
---

Implémente le ticket **$0** du backlog.

## 1. Comprendre

- Ouvre `docs/backlog/$0*.md`. Si aucun fichier ne correspond, liste les tickets
  disponibles et arrête-toi.
- Lis les sections de `docs/spec/RIG-spec-produit-technique.md` que le ticket référence.
- Relis les règles applicables dans `CLAUDE.md` et `.claude/rules/`.

## 2. Planifier — avant toute écriture

Présente un plan court : fichiers à créer ou modifier, migrations nécessaires,
tests à écrire, et les décisions que tu prends là où le ticket est ambigu.

**Si le ticket touche la base, l'argent ou l'authentification, arrête-toi ici et
attends validation explicite.** Pour le reste, continue.

Si le ticket est plus gros qu'il n'en a l'air, dis-le et propose de le découper
plutôt que de tout faire d'un coup.

## 3. Tester d'abord

Pour chaque critère d'acceptation qui exprime une règle métier, écris le test
avant le code (délègue au sous-agent `test-writer` si le volume le justifie).
Lance-les, montre qu'ils échouent pour la bonne raison.

## 4. Implémenter

- Le plus petit code qui fait passer les tests. Pas d'anticipation, pas d'abstraction
  prématurée : ce projet est maintenu par une seule personne.
- Logique transactionnelle en SQL, pas en TypeScript.
- Chaînes en i18n, couleurs en tokens, montants en centimes.
- Reste dans le périmètre. Ce qui déborde devient un nouveau fichier dans
  `docs/backlog/`, pas du code en plus.

## 5. Vérifier

Lance `/check`. Puis, selon ce que le ticket touche :

- base de données → sous-agent `rls-auditor`
- paiement, crédits, ledger → sous-agent `money-reviewer`
- dans tous les cas → sous-agent `spec-keeper`

## 6. Rendre compte

Résume en quelques lignes : ce qui est fait, ce qui reste, les décisions prises,
et ce qui doit être vérifié à la main (parcours mobile, rendu visuel, webhook réel).
Coche les critères d'acceptation dans le fichier du ticket.
Ne commite pas : c'est `/ship` qui le fait.
