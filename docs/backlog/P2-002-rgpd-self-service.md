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

## Ce que ce ticket suppose et qui doit exister

Section ajoutée le 2 septembre 2026 (règle 8 de `CLAUDE.md`), rétroactivement :
la règle est née de deux tickets **déjà écrits** qui ont explosé, elle ne se
borne donc pas aux tickets à venir.

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| Session, profil, `me()` | P0-005a | ✅ existe |
| `consents` append-only, **sans FK vers `users`** | `..._compliance_and_ledger.sql` | ✅ existe — c'est **ce qui rend l'anonymisation possible** : sans FK, la preuve survit à la suppression |
| `forbid_orphaning_tenant` | P0-004 | ✅ existe — et c'est lui qui **impose** les deux issues « transmettre ou fermer » |
| `docs/procedures/effacement-manuel.md` | `docs/procedures/` | ✅ existe — condition de ce report |
| **Un job `pg_cron` pour l'anonymisation à J+30** | `supabase/config.toml` | ❌ **à vérifier.** Aucun job de fond n'existe encore ; P1-002 sera le premier à en poser un. S'il est fait, l'extension est là ; sinon ce ticket l'active |
| **Un canal e-mail** (accusé de demande, confirmation d'effacement) | P2-015 | ❌ **à créer par P2-015.** Une suppression de compte qui ne confirme rien par écrit est indéfendable devant la CNIL |
| **Transmettre la propriété d'une box** | — | ❌ **n'existe pas.** `set_member_role()` change un rôle ; rien ne transfère le statut d'OWNER **unique**. Fonction SQL à écrire ici, avec son test — c'est la moitié invisible du ticket |
| **Fermer une box** | — | ❌ **n'existe pas.** Ni écriture de `tenants.deleted_at`, ni réponse sur les réservations à venir, les abonnements en cours et les soldes de portefeuille. À cadrer au plan : c'est peut-être un ticket à part |
| Écran de réglages mobile (les « 3 taps ») | `apps/mobile` | ⚠️ existe, **jamais exécuté** (`docs/REPRISE.md` §2) |
| `consent_purpose` = `LEADERBOARD` | `..._compliance_and_ledger.sql:8` | ⚠️ la valeur existe, **aucun écran ne la recueille**. Le dernier critère (« retirer un consentement est aussi simple que le donner ») suppose un écran de consentements que personne n'a écrit — ici ou en P2-014, à trancher au plan |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `request_account_deletion()`, `anonymize_user()` | l'écran de réglages, le job `pg_cron` | celui-ci |
| `transfer_ownership()` | l'issue proposée au propriétaire unique | celui-ci |
| L'écran de consentements | le membre | celui-ci — il **débloque** `LEADERBOARD`, posé sans appelant depuis P0-004 |
| L'export | le membre, et le support en cas de réclamation | celui-ci |

**Deux `❌` sans ticket en face** — transmettre la propriété, fermer une box.
Ils sont dans le périmètre ci-dessous mais n'y étaient pas chiffrés : c'est le
signal que 5 j·h est bas. À re-estimer au plan, avant de partir.

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
