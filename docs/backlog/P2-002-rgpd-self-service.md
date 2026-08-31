# P2-002 — Droits RGPD en self-service

**Phase** P2 · **Estimation** 5 j·h · **Dépend de** P0-005a · **Spec** §15.3

## Pourquoi en P2 et pas en P0

L'export et la suppression de compte sont des **obligations légales**, pas des
préalables à la connexion. Les garder dans le ticket d'authentification en
allongeait le chemin critique sans rien rendre plus sûr.

Deux garde-fous rendent ce report tenable :

1. Ce ticket doit être livré **avant la soumission aux stores** — la suppression
   de compte in-app est une exigence Apple autant qu'une obligation RGPD.
2. D'ici là, `docs/procedures/effacement-manuel.md` décrit le traitement manuel
   d'une demande. C'est ce qui rend le droit **exerçable pendant le pilote**, et
   c'est la condition de ce report.

## Périmètre

- `GET /v1/me/export` — archive JSON + CSV, lien signé expirant en 24 h.
- Suppression de compte in-app, atteignable en **3 taps** depuis les réglages.
- Anonymisation réelle à **J+30** (job `pg_cron`) : les écritures comptables sont
  conservées sous forme anonymisée (obligation de 10 ans), les consentements
  aussi — leur `user_id` est réécrit vers un pseudonyme, la ligne n'est pas
  supprimée (`consents` n'a plus de FK vers `users`, voir P0-004).
- Les deux options qu'exige le garde-fou anti-orphelin de P0-004 quand la personne
  est **propriétaire unique** d'une box active : transmettre la propriété, ou
  fermer la box. Sans elles, `forbid_orphaning_tenant` bloque la suppression sans
  proposer d'issue.

## Critères d'acceptation

- [ ] L'export produit une archive lisible en moins de 30 secondes
- [ ] La suppression est atteignable en 3 taps
- [ ] Un propriétaire unique se voit proposer transmettre ou fermer, jamais un
      refus sec
- [ ] À J+30, les données personnelles sont réellement anonymisées
- [ ] Les écritures comptables et les preuves de consentement survivent, anonymisées
- [ ] Retirer un consentement est aussi simple que le donner : un interrupteur,
      pas un e-mail au support
