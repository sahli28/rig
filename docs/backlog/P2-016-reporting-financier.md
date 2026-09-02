# P2-016 — Reporting financier et export comptable

**Phase** P2 · **Estimation** 5 j·h · **Dépend de** P2-006, P2-007, P2-008, P2-004 · **Spec** §2.3 (S6), §13.4 (S21–S22), §7.5

## Pourquoi ce ticket est en P2 alors que la spec le classe SHOULD

**La spec se contredit avec elle-même**, et c'est le §13 qui a raison.

- §2.3 range S6 « reporting financier détaillé + export comptable » dans les
  SHOULD, donc en v1, donc après le MVP.
- §13.4 le planifie en **S21–S22, dans la Phase 2**, et surtout le critère de
  sortie de cette phase est sans ambiguïté : « le rapprochement entre le
  reporting de l'app et le tableau de bord Stripe est **exact au centime** sur un
  mois complet ».

On ne peut pas franchir un critère de sortie avec une fonctionnalité qu'on a
décidé de reporter. S6 est un MUST déguisé, et il est traité comme tel ici.

C'est aussi ce qui complète deux items MUST marqués « couverts » à tort :
**M17** (le dashboard doit montrer « le CA du mois ») et **M21** (le back-office
doit porter « planning, membres, **finances** »).

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `ledger_entries` **avec des écritures dedans** | table depuis P0-004, écrivains depuis P2-006 | ⚠️ la table existe, **vide**. Sans P2-006/007/008, ce ticket rapporte zéro |
| `write_ledger()` comme porte unique | P2-006 | ❌ **à créer par P2-006.** Si des écritures entrent par plusieurs chemins, le rapprochement est impossible et ce ticket n'a pas de sol |
| `stripe_accounts`, pour lire les payouts | P2-001 | ❌ **à créer par P2-001** |
| Dashboard de la box, où loger le bloc CA | P2-004 | ❌ **à créer par P2-004** |
| `tenants.currency` figée dès la première écriture | `..._forbid_currency_change_with_ledger.sql` | ✅ existe — **c'est ce verrou qui rend le rapprochement possible** |
| Un export CSV côté web | `apps/web` | ⚠️ P1-001d a fait de l'**import** CSV. L'export est l'autre sens et ne réutilise rien, sauf l'expérience de l'encodage — voir les notes |
| Un composant graphique | `packages/ui` | ❌ **à créer, ou à éviter.** Un tableau de chiffres justes vaut mieux qu'une courbe approximative ; ajouter une bibliothèque de graphiques pour un histogramme mensuel est à peser explicitement |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `revenue_report(tenant, période)` | l'écran finances, le dashboard | celui-ci, **et P2-004** dont il remplit le KPI « CA du mois » |
| `export_accounting(tenant, période)` | le bouton d'export | celui-ci |

## Périmètre

- Écran `/box/[slug]/finances`, **OWNER seul** — cohérent avec la coupure par
  table établie en P1-001b : le chiffre d'affaires est au propriétaire.
- Vue par période : encaissements, remboursements, commission de plateforme,
  net, impayés en cours. Tout depuis `ledger_entries`, **jamais recalculé
  depuis Stripe à la volée** : le ledger est la source de vérité comptable
  (RM4.7), Stripe est la source de vérité des mouvements bancaires. Le
  rapprochement compare les deux, il n'en dérive pas un du second.
- Rapprochement : pour un mois donné, la somme des écritures du ledger contre la
  somme des `balance transactions` Stripe du compte connecté. **L'écart est
  affiché, même quand il est nul** — un écran qui n'affiche l'écart que s'il
  existe est un écran dont on ne sait pas s'il regarde.
- Export CSV : une ligne par écriture, colonnes stables, en-têtes en FR et EN.
  Format « FEC-friendly » au sens de la spec — lisible par un expert-comptable,
  **pas** un FEC réglementaire, qui est un autre métier (§2.5 exclut la
  comptabilité intégrée).
- Le KPI « CA du mois » du dashboard de P2-004, qui n'avait aucune source.

## Le point qu'un expert-comptable relèvera en premier

**La TVA.** RM4.2 est claire : la box est le vendeur, ses CGV, **sa TVA**, ses
factures. Le produit n'est donc pas responsable du calcul de la TVA — mais un
export qui ne porte pas de colonne de taux est inexploitable, et un export qui en
porte une fausse est pire.

À trancher au plan : soit on exporte des montants TTC bruts en le disant
explicitement dans l'en-tête, soit on stocke le taux appliqué sur la ligne de
ledger dès P2-006 — ce qui **remonte une exigence dans un ticket déjà écrit**, et
c'est exactement pourquoi ce ticket est lu avant, pas après.

## Hors périmètre

- Comptabilité intégrée, facturation légale, bilan (§2.5, exclusion explicite).
- Intégration Pennylane / Qonto : un CSV et un lien sortant suffisent.
- Reporting consolidé multi-box et règlements inter-box (S8, P3).
- Frais de no-show et pénalités (S5, P3).
- Analytics produit — funnel, rétention, cohortes (S10, P3). C'est de la mesure
  de **notre** produit, pas des finances d'une box : ne pas les mélanger dans un
  écran ni dans un ticket.

## Critères d'acceptation

- [ ] Le rapprochement sur un mois complet de données de test est **exact au
      centime** — c'est le critère de sortie de la Phase 2, pas une formalité
- [ ] Un écart non nul est affiché, chiffré, et attribuable à une écriture
- [ ] L'export s'ouvre correctement dans Excel **en français** — encodage vérifié
      de bout en bout, un accent inclus dans le jeu de test
- [ ] Un MANAGER n'atteint pas l'écran, et la page l'explique
- [ ] Le CA du mois du dashboard (P2-004) et le total de cet écran donnent le
      **même** nombre
- [ ] Une box sans aucune écriture voit un état vide qui explique, pas des zéros
- [ ] Aucun montant en float nulle part, du SQL au CSV

## Notes

**L'encodage, encore.** P1-001d a payé ce piège à l'import : un export Excel
français lu en UTF-8 perd ses accents. L'export est le même piège dans l'autre
sens — Excel sous Windows ouvre un CSV en `cp1252` sauf BOM UTF-8. Le critère
d'acceptation le dit ; le tester avec un vrai Excel, pas avec `cat`.

`money-reviewer` obligatoire.
