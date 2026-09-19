# P2-004 — Dashboard box et mise en route

**Phase** P2 · **Estimation** 4 j·h · **Dépend de** P1-001b, P1-001c, P1-003 · **Spec** §6.2, §12.5

> **Revue du 16 septembre 2026 — la tuile « CA du mois » quitte cet écran.**
> Le paiement passe hors app (lien Stripe de la box, `P2-019`) et l'accès est
> attribué à la main (`P2-018`) : l'app ne voit aucun encaissement, donc aucune
> source de CA. Le dashboard garde présences, taux de remplissage et membres
> actifs ; le chiffre d'affaires se lit dans le Stripe de la box. `revenue_report()`
> et `P2-016` restent différés avec l'entité juridique.

> **Revue du 19 septembre 2026 — trois décisions gravées, et la fiche rattrape le réel.**
>
> **1. La création de box n'est plus dans ce ticket.** `P1-020` (PR #88, 12 sept.)
> a livré `/creer-une-box` + l'action serveur : `create_tenant()` a enfin un
> appelant. La section « Ce ticket porte le seul appelant manquant de
> `create_tenant()` » est donc **périmée** — le périmètre restant est
> l'**assistant 5 étapes**, le **dashboard** et la **checklist**, pas l'écran de
> création.
>
> **2. Graphique 30 jours : SVG fait main, pas de bibliothèque — et rien de
> basique.** L'app est en marque blanche : **une seule couleur par box**. Une
> bibliothèque de graphes trimballe une machinerie de palettes multi-séries
> inutile ici, pèse ~100 ko et se bat contre « Craie & acier ». Le bon rendu vient
> de la méthode, pas de la lib. Donc : un graphe **SVG fait main**, **une seule
> teinte** (la primaire de la box), **réservations par jour** (donnée automatique
> et toujours peuplée, contrairement aux présences qui dépendent du coach),
> **tooltip au survol** (la couche interactive est par défaut sur un graphe
> HTML/SVG), marques travaillées (bouts arrondis 4 px ou aire à dégradé, 2 px de
> respiration), et **sombre recalculé depuis les tokens, pas une inversion**.
> Réf. : compétence `dataviz` (forme d'abord, couleur calculée, survol, passe
> accessibilité). Toute dépendance ajoutée se justifie dans le commit.
>
> **3. Pas de « taux de churn ».** Sans visibilité sur les paiements (règlement
> hors app, `P2-019`), un churn serait un chiffre faux. Remplacé par une tuile
> **« abonnements expirant sous 30 j »** — actionnable, dérivée de
> `member_subscriptions.ends_on` (`P2-018`), en excluant les révoqués
> (`deleted_at`, `P2-026`). La tuile « CA du mois » reste dehors (déjà tranché le
> 16 sept.).
>
> **4. Nettoyer le faux constat.** `apps/web/app/box/[slug]/page.tsx` rend un
> `<Notice kind="coming_soon" />` avec un commentaire périmé « Vide jusqu'à
> P1-001 » (ticket clos). C'est ce qui fait dire à la relecture « écran à venir,
> aucun ticket ». Ce ticket **remplace ce Notice par le vrai dashboard** ; il ne
> reste ni coquille ni référence morte.

> **5. C'est l'écran phare — il doit être une élévation, pas un écran de plus.**
> Le dashboard est le premier écran à l'ouverture. Il doit se lire *au-dessus*
> des autres écrans du back-office : un **chiffre héros** (le KPI qui compte le
> plus, en grand), une hiérarchie nette, de l'espace, la texture « Craie & acier »
> utilisée avec parcimonie, et le taux de complétion de la checklist en **anneau
> de progression** (`ProgressRing` — prévu au kit, **jamais construit** ; il naît
> ici et rejoint `packages/ui`). **Un mockup viewable est validé avant toute
> implémentation**, comme pour P2-021/022.

## Pourquoi ce ticket existe

Il recueille **deux critères orphelins** de P1-001, qui pointaient vers un écran
lui-même orphelin — le mot « dashboard » n'apparaissait dans aucun ticket du
backlog, alors que la spec §6.2 en fait le premier écran du back-office.

- « Une box se configure entièrement en moins de 45 minutes sans aide »
- « Une checklist de mise en route persiste sur le dashboard avec son taux de
  complétion »

## Pourquoi en P2, et pas avant le pilote

L'assistant en cinq étapes sert la **vente en self-service** : il remplace la
personne qui accompagne. Au pilote, cette personne est la développeuse, assise à
côté du propriétaire. Même raisonnement que pour P2-002 (droits RGPD en
self-service) : l'obligation est réelle, le préalable ne l'est pas.

Ce qui suppose que les réglages soient atteignables **sans** assistant — c'est
exactement ce que P1-001b livre : un écran à cinq sections, pas un tunnel.

## Ce ticket porte le seul appelant manquant de `create_tenant()`

`create_tenant()` existe depuis P0-004, avec son quota, ses tests et ses gardes.
**Aucun écran ne l'appelle** : une box ne se crée aujourd'hui qu'en SQL. C'est le
quatrième cas du motif que `CLAUDE.md` §7 nomme désormais — une fonction sans
appelant n'est pas « faite », elle est en attente.

L'écran de création de box appartient à ce ticket : c'est la première étape de la
mise en route, avant les cinq autres.

## Ce que ce ticket suppose et qui doit exister

Section ajoutée le 2 septembre 2026 (règle 8 de `CLAUDE.md`), rétroactivement.
Ce ticket en avait plus besoin que les autres : **son KPI le plus vendeur
n'avait aucune source de données.**

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `create_tenant()`, avec son quota et ses gardes | P0-004 | ✅ existe, **sans aucun appelant** depuis P0-004. Ce ticket est celui qui la rend « faite » |
| Écran de réglages en cinq sections | P1-001b | ✅ existe — l'assistant les enchaîne, il ne les réécrit pas |
| `locations`, `rooms`, `class_types`, `opening_hours` | P1-001b | ✅ existent — la checklist se dérive de leur **présence réelle**, pas d'un drapeau |
| Invitations et annuaire des membres | P1-001c, D-001 | ✅ existent |
| Marque de la box | P1-001e | ✅ existe |
| **`classes` et `bookings`** (« taux de remplissage ») | P1-002, P1-003 | ❌ **à créer par P1-002 et P1-003** |
| **`checkins`** (« présences ») | P1-008a | ❌ **à créer par P1-008a.** Sans lui, « présences » voudrait dire « réservations » — ce n'est pas la même chose et il ne faut pas l'étiqueter ainsi |
| **`ledger_entries` avec des écritures** (« CA du mois ») | table depuis P0-004, écrivains depuis P2-006 | ❌ **c'était le trou.** Le KPI le plus vendeur de l'écran n'avait aucune source, et le ticket ne le disait pas. `revenue_report()` est livré par **P2-016** — d'où l'ordre P2-004 → P2-016, et un état vide honnête tant que P2-016 n'est pas là |
| **Un composant graphique** (« graphique 30 jours ») | `packages/ui` | ❌ **à créer, ou à éviter.** Même arbitrage qu'en P2-016 : un tableau juste vaut mieux qu'une courbe approximative, et ajouter une bibliothèque de graphiques se justifie dans le message de commit |
| Tests de rendu des composants | D-002 (dette ouverte) | ⚠️ **absente** |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| L'écran de création de box | la personne qui s'inscrit | celui-ci — **c'est l'appelant manquant de `create_tenant()`**, nommé par la règle 7 |
| La checklist dérivée de l'état réel | le dashboard | celui-ci |
| Le bloc « CA du mois » | — | il **consomme** `revenue_report()`, livré par **P2-016** |

## Périmètre

- Box Dashboard : KPI (CA, membres actifs, taux de remplissage, churn), alertes,
  graphique 30 jours.
- Checklist de mise en route, **dérivée de l'état réel** (des salles ? des types
  de cours ? des horaires ? un plan tarifaire ? un premier membre ?) plutôt que
  stockée — un drapeau `onboarding_step` se désynchronise le jour où quelqu'un
  supprime la donnée qu'il prétendait valider.
- **Création de la box** (`create_tenant()`), première étape de l'assistant.
- Assistant en cinq étapes qui enchaîne les sections de l'écran Réglages :
  infos, horaires, salles, types de cours, règles de réservation.

## Les briques affichées (arrêtées le 19 sept. 2026)

Chaque brique a une source livrée ; aucune n'invente de donnée.

| Brique | Ce qu'elle montre | Source (livrée) | État vide |
| --- | --- | --- | --- |
| **Mise en route** | Checklist dérivée de l'état réel + taux de complétion | `locations`/`rooms`/`class_types`/`opening_hours` (P1-001b), un plan (P2-018), un premier membre (P1-001c/D-001) | c'est l'état de départ ; elle guide, elle ne fait pas honte |
| **Membres actifs** | Compte des appartenances actives | `memberships` ACTIVE (P1-001c, D-001) | « aucun membre encore » + action inviter |
| **Taux de remplissage** | Réservations confirmées / capacité, sur 30 j | `classes` (P1-002) + `bookings` (P1-003) | « pas encore de cours au planning » |
| **Présences** | Réservations pointées présentes par le coach, sur 30 j — **distinct du remplissage** | horodatage de présence sur `bookings` (P1-008a) | « pas encore de pointage » |
| **Abonnements expirant sous 30 j** | Liste courte / compteur actionnable | `member_subscriptions.ends_on` (P2-018), hors révoqués (P2-026) | « aucune échéance proche » |
| **Activité 30 jours** | Graphe SVG fait main, une teinte (primaire), réservations/jour, tooltip au survol | `bookings` (P1-003) | tracé à plat lisible, pas d'erreur |

**Hors périmètre, et pourquoi :** tuile CA (l'app ne voit aucun encaissement),
taux de churn (faux sans visibilité paiement). Le CA se lit dans le Stripe de la
box ; `revenue_report()` / `P2-016` restent différés avec l'entité juridique.

## Critères d'acceptation

- [ ] Une box se configure entièrement en moins de 45 minutes sans aide
- [ ] La checklist reflète l'état réel de la base, y compris après suppression
      d'une donnée déjà cochée
- [ ] Le dashboard ne montre aucun KPI faux quand la box n'a encore rien : un
      état vide qui explique quoi faire, pas des zéros
- [ ] Le `<Notice coming_soon>` du dashboard est remplacé par l'écran réel ;
      aucune référence morte à P1-001 ne subsiste dans `page.tsx`
- [ ] Le graphe 30 j est en SVG fait main, une seule teinte (primaire de la
      box), tooltip au survol, sombre recalculé (pas une inversion) — aucune
      bibliothèque de graphes ajoutée
- [ ] Présences (pointées) et taux de remplissage (réservations) sont affichés
      comme deux mesures distinctes, jamais confondues
- [ ] Le dashboard se lit comme une élévation des autres écrans : un chiffre
      héros, hiérarchie et espace — un mockup est validé avant l'implémentation
- [ ] Le taux de complétion de la checklist utilise un `ProgressRing` versé
      dans `packages/ui`
