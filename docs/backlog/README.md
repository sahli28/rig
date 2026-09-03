# Backlog exécutable

Un fichier par ticket. Un ticket = une session Claude Code = une branche = un commit.
On lance un ticket avec `/ticket P0-001`. Le gabarit est `_gabarit.md`, et sa
section « Ce que ce ticket suppose et qui doit exister » est **obligatoire**
(règle 8 de `CLAUDE.md`).

## Deux horizons, et il faut cesser de les confondre

Ce README n'en montrait qu'un — celui du pilote — et on pouvait croire que
c'était le produit. Ce n'est pas le produit : c'est **la moitié qui ne se vend
pas**.

| Horizon | Ce qu'il prouve | Ce qu'une box peut faire | Reste à faire |
| ------- | --------------- | ------------------------ | ------------: |
| **① Jalon pilote** | que l'outil sert, en vrai, tous les jours | réserver, annuler, faire la queue, pointer | **48,5 j·h** |
| **② MVP vendable** | qu'une box s'inscrit, encaisse et programme **sans nous** | payer, programmer, logguer, se classer, voir son CA | **+ 76 j·h** |

Au rythme de **2,3 j·h par semaine** (15–20 h effectives) : jalon pilote vers
**février 2027**, MVP vendable vers **octobre 2027**. Ces dates sont ce
qu'elles sont ; les connaître vaut mieux que les découvrir.

**La ligne de démarcation est celle de la spec §2.6** : une box doit pouvoir
créer son compte → configurer son planning → inviter ses membres → **vendre un
abonnement et un pack de 10** → voir réserver, annuler, pointer → **publier le
WOD avec Rx/Scaled** → voir logguer les scores → **consulter son CA**. Tout ce
qui est en gras était absent du backlog jusqu'au 2 septembre 2026.

## Chemin critique hors code

**Dernier examen : 3 septembre 2026.** À relire à chaque revue de backlog, et à
dater à nouveau — une échéance non relue est une échéance oubliée.

Quatre démarches administratives bloquent du code déjà écrit ou déjà chiffré.
**Aucune ne se rattrape en codant plus vite**, et aucune n'a bougé depuis une
semaine. Elles ne vivent nulle part ailleurs dans le dépôt : ni un ticket, ni un
test, ni la CI ne les rappellera.

| Quoi | Bloque | Pourquoi maintenant |
| --- | --- | --- |
| **Trois `client_id` Google** (web, iOS, Android) | P0-005b, puis P2-003 | Bloqué depuis cinq sessions. URI de redirection **exactement** `http://127.0.0.1:55321/auth/v1/callback` en local : Google compare au caractère près, et `localhost` n'est pas `127.0.0.1` pour lui |
| **Compte développeur Apple**, 99 $/an | P2-003, et toute publication | Vérification d'identité, délai d'enrôlement variable. Câbler Google engage sur Apple avant soumission (guideline 4.8) |
| **Activation de Stripe Connect** | P2-001, donc tout l'argent | Vérification d'identité de la société |
| **Un nom de domaine** (+ SPF, DKIM, DMARC) | P2-015, D-008, et le retour Apple | **Trois éléments bloqués par une seule absence** |

Le constat qui a fait écrire cette section : pendant quatre tickets d'affilée,
le choix du ticket suivant s'est fait par élimination — c'était le seul travail
non bloqué. Le chemin critique du projet est administratif, pas technique.

## Convention

- `P0-*` — Socle (fait)
- `P1-*` — v0 pilote — objectif : une box réelle réserve en production
- `P2-*` — MVP vendable — paiement, programmation, scores, stores
- `P3-*` — v1 — réseau inter-box, CrossFit avancé, finance avancée
- `D-*` — dette convertie en ticket

Estimations en **jours-homme de 7 h effectives**. Elles ne suivent plus celles de
la spec §2.2 : deux tickets ont explosé (P0-005 : 5 → 17, P1-001 : 4 → 11,5), et
la Phase 2 est estimée avec ce facteur en tête, pas avec les chiffres de 2026.

**P1-002 est le premier ticket où la règle 8 a payé avant le code** : sa section
de prérequis a fait apparaître `pg_cron` jamais activé, une grille de semaine à
construire et un cache mobile inexistant. Résultat — 7 → **9 j·h**, et le mobile
sorti dans **P1-002b** (3,5 j·h) plutôt qu'absorbé en silence. C'est le premier
des trois dérapages qui ne s'est pas produit.

---

## ① Jalon pilote — 83,75 j·h, dont **48,5 restants**

Objectif : une box réelle utilise l'app en production pendant deux semaines.
**Le paiement se fait hors app**, assumé et expliqué à la box pilote.

### Ordre

```
P0-005b                                (SSO Google)
P1-002 → P1-003 → P1-004 → P1-005      (planning, réservation, annulation, temps réel)
P1-002b                                (planning mobile + cache hors ligne)
P1-007 → P1-006 → P1-008               (push, waitlist, check-in)
P1-001f                                (logo — après la première démo)
        ↓
  ═══ JALON : mise en production chez la box pilote ═══
```

### État

| Ticket  | Titre                                             |    j·h | Statut               |
| ------- | ------------------------------------------------- | -----: | -------------------- |
| P0-001  | Monorepo, CI, outillage                           |      3 | ✅ fusionné (PR #2)  |
| P0-002  | Design tokens et thème tenant                     |      4 | ✅ fusionné (PR #1)  |
| P0-003  | i18n FR/EN                                        |      2 | ✅ fusionné (PR #3)  |
| P0-004  | Schéma de base, RLS, test anti-fuite              |      6 | ✅ fusionné (PR #4)  |
| P0-005a | Se connecter — code, session, `me()`              |      6 | ✅ fusionné (PR #6) — **reste la passe sur appareil** |
| P0-005b | SSO Google et linking d'identités                 |      4 | 🔒 bloqué — trois `client_id` Google à créer |
| P1-001a | Porte d'entrée du back-office web                 |    2,5 | ✅ fusionné (PR #11) |
| P1-001b | Réglages box, horaires, types de cours            |      3 | ✅ fusionné (PR #12) |
| P1-001c | Staff & Roles, invitations, journal d'audit       |   3,75 | ✅ fusionné (PR #13) |
| P1-001d | Import CSV de membres                             |      4 | ✅ fait, à fusionner |
| P1-001e | Apparence de la box (branding)                    |      1 | ✅ fusionné (PR #14) |
| P1-001f | Logo et couche Storage                            |      1 | à faire — après la démo |
| P1-002  | Planning récurrent (RRULE)                        |      9 | **en cours** — migration et test écrits |
| P1-002b | Planning mobile et cache hors ligne               |    3,5 | à faire — sorti de P1-002 |
| P1-003  | Réservation transactionnelle                      |      8 | à faire              |
| P1-004  | Annulation et fenêtres                            |      4 | à faire              |
| P1-005  | Places restantes en temps réel                    |      3 | à faire              |
| P1-006  | Liste d'attente et promotion                      |      6 | à faire              |
| P1-007  | Notifications push                                |      4 | à faire              |
| P1-008  | Check-in QR et mode kiosque                       |      6 | à faire              |
|         | **Total ①**                                       | **83,75** | dont **35,25 faits**, **48,5 restants** |

---

## ② MVP vendable — **76 j·h**

Objectif : « une box s'inscrit, se configure et **encaisse sans votre
intervention** » (spec §13.4). Rien de ce bloc n'existait dans le backlog avant
la réconciliation du 2 septembre 2026 : sept items MUST et un SHOULD y étaient
simplement absents.

### Ordre

```
P2-001 → P2-005 → P2-015 → P2-006 → P2-007 → P2-008     (l'argent)
P2-009 → P2-010 → P2-012 → P2-013 → P2-011 → P2-014     (la programmation, puis les scores)
P2-004 → P2-016                                         (dashboard, puis reporting)
P2-002 → P2-003                                         (RGPD, Apple — avant les stores)
```

Deux ordres méritent une explication, parce qu'ils **contredisent** la
numérotation de la spec :

- **P2-015 (e-mails) avant P2-006 (abonnements)**, sinon l'abonnement n'a pas de
  canal pour envoyer sa facture, et P2-008 n'a pas de canal pour relancer un
  impayé. Aucun ticket n'envoyait d'e-mail avant celui-là.
- **P2-013 (scores) avant P2-011 (scaling)**, alors que la spec ordonne M13 puis
  M14 : une charge « 75 % du 1RM » ne se résout pas sans `personal_records`.

### État

| Ticket | Titre                                          | j·h | MUST/SHOULD couvert |
| ------ | ---------------------------------------------- | --: | ------------------- |
| P2-001 | Stripe Connect Express, et la couche webhook   |   5 | **M9** |
| P2-005 | Formules : le catalogue de la box              |   3 | M8 (1/3) |
| P2-015 | E-mails transactionnels                        |   4 | **M19** (le tiers manquant) |
| P2-006 | Abonnements                                    |   7 | **M8** |
| P2-007 | Packs de crédits et portefeuille               |   6 | **M10** |
| P2-008 | Impayés, relances et suspension                |   5 | M8 (RM4.6) |
| P2-009 | Le modèle d'entraînement                       |   6 | socle M12 |
| P2-010 | Program Builder                                |   7 | **M12** |
| P2-012 | Le WOD du jour, côté membre                    |   3 | M12 (membre) |
| P2-013 | Saisie de score et records personnels          |   5 | **M14** |
| P2-011 | Rx / Scaled / Beginner, charges en % de 1RM    |   4 | **M13** |
| P2-014 | Leaderboard par WOD                            |   4 | **M15** |
| P2-004 | Dashboard box et mise en route                 |   4 | **M17**, M2 (`create_tenant()`) |
| P2-016 | Reporting financier et export comptable        |   5 | **S6**, M17 (CA), M21 (finances) |
| P2-002 | Droits RGPD en self-service                    |   5 | **M20** |
| P2-003 | Sign in with Apple                             |   3 | **M1** — bloquant de publication |
|        | **Total ②**                                    | **76** | |

**P2-001, P2-003, P2-015 et D-008 attendent tous une démarche administrative** —
Stripe Connect, le compte Apple, un nom de domaine. Voir « Chemin critique hors
code » en tête de ce fichier : c'est là que ces échéances vivent.

---

## ③ Différé explicitement — v1 et v2

Ces items sont dans la spec et **n'ont pas de ticket, volontairement**. Ils sont
listés ici pour qu'ils cessent d'être invisibles : un manque non écrit finit par
ressembler à un oubli.

| # | Item | Jalon | Pourquoi pas avant |
| - | ---- | ----- | ------------------ |
| S1 | Module Hyrox (8 épreuves, splits, PR par station) | v1 | Spec §13.5, bloc « Hyrox », 12 j·h. **Notre porte d'entrée commerciale** (§18.1) et la seule réponse écrite au risque R2 — donc pas repoussable en v2. Mais aucun ticket avant que le MVP encaisse : un différenciateur sur un produit qui ne se vend pas ne différencie rien |
| S2 | Événements Hyrox (heats, dossards, pairings) | v1 | Spec §13.5, bloc « Événements Hyrox », 8 j·h. Suppose S1 |
| S3 | Benchmarks CrossFit (Fran, Grace, Murph) | v1 | Peu coûteux **une fois P2-013 fait** : ce sont des PR sur des séances nommées |
| S4 | Notes de coach privées, suggestions de scaling | v1 | Données proches du sensible (règle 11). Mérite son propre cadrage |
| S5 | Frais d'annulation tardive / no-show | v1 | **Référencé par RM2.4 (P1-004) et RM3.4 (P1-008)** : les deux tickets P1 doivent dire qu'ils s'arrêtent avant. Politiquement sensible → configurable, donc à concevoir avec de vrais propriétaires |
| S7 | Partenariats inter-box | v1 | Le réseau est l'ambition, pas le MVP. Sans dix boxes, il n'a personne à connecter |
| S8 | Commissions et partage de revenus inter-box | v1 | Suppose S7 et un ledger éprouvé sur un an |
| S9 | Synchronisation calendrier (.ics, Google) | v1 | Demandé, pas bloquant |
| S10 | Analytics produit (funnel, rétention, cohortes) | v1 | Mesure **notre** produit, pas les finances d'une box. Ne pas mélanger avec P2-016 |
| S11 | Vente de programmes en marketplace | v1 | **La porte reste ouverte sans rien coûter** : `programs.tenant_id` est nullable dès P2-009 |
| C1–C8 | White-label N2, wearables, écran TV, IA, nutrition, stocks, SEPA | v2 | §2.4 |

`HYROX_PREP` **n'entre pas dans l'enum `programs.type` au jour 1** (P2-009) : c'est le ticket P3 qui l'implémente qui l'ajoutera, par un `alter type … add value` d'une ligne. Une valeur d'enum sans code derrière ne prouve rien et se périme.

**S12 (rôle Manager + journal d'audit) est déjà livré** — P1-001c, en P1. Un
SHOULD payé en avance, à ne pas recompter.

---

## ④ Dette convertie en tickets — 7,75 j·h ouverts

`CLAUDE.md` dit « ce qui déborde devient un nouveau ticket ». La dette accumulée
dans les tickets clos y échappait : un ticket clos ne se relit pas.

| Ticket | Titre                                          | j·h | Origine et état |
| ------ | ---------------------------------------------- | --: | --------------- |
| D-001  | Vue restreinte des membres d'une box           |   2 | P0-004 — ✅ fait, débloquait P1-001 |
| D-002  | Tests de rendu des composants                  |   2 | P0-002 — **devient gênante à P2-010**, l'écran le plus riche du produit |
| D-003  | SSR de l'i18n pour les pages publiques         |   2 | P0-003 |
| D-004  | **La langue** : source de vérité, persistance, repli |   2 | P0-003 — **élargi par la passe sur appareil du 3 sept. 2026** : l'app s'ouvre en anglais sur un iPhone français, `Intl` ne donne pas la langue de l'appareil sous Hermes, et `FALLBACK_LOCALE = 'en'` pour un produit vendu en France |
| D-005  | Empreintes des jetons d'invitation             |   1 | PR #4 — ✅ fait |
| D-006  | Défense en profondeur sur `public.users`       | 0,5 | P0-004 — ✅ fait |
| D-007  | Contraste de la page de démo                   | 0,25 | P0-002 |
| D-008  | Lien d'invitation qui survit à l'installation  | 1,5 | P0-005a — **attend un domaine**, comme P2-015 |
|        | **Ouvert**                                     | **7,75** | D-002, D-003, D-004, D-007, D-008 |

Ces 7,75 j·h ne sont dans **aucun** des deux totaux ci-dessus. C'est délibéré :
une dette qu'on additionne au chemin critique le rend indiscutable, une dette
qu'on cache le rend faux. Elle se paie quand un ticket la rend bloquante —
D-002 le sera à P2-010.

---

## Ce que la réconciliation spec ↔ backlog a montré (2 septembre 2026)

Sur les **21 MUST** de §2.2 : 13 couverts, 1 partiel, **7 manquants** — M8, M9,
M10 (toute la couche paiement) et M12 à M15 (toute la programmation et les
scores). Ils correspondent exactement aux sprints S13 à S22 de la Phase 2.

Sur les **12 SHOULD** de §2.3 : 1 déjà livré (S12), 10 différés, **1 manquant qui
appartenait au MVP** — S6, le reporting financier. La spec se contredit :
§2.3 le classe en v1, §13.4 le planifie en Phase 2, et le critère de sortie de
cette phase exige « un rapprochement exact au centime ». Le §13 a raison.

**Trois trous supplémentaires, tous de la même famille** — un prérequis que
plusieurs tickets croyaient acquis :

1. **Aucun ticket n'envoyait d'e-mail**, alors que M19 l'exige et que P1-007,
   P2-006 et P2-008 s'appuient dessus → **P2-015**.
2. **Le sous-domaine de M2** a été remplacé par `/box/[slug]/` — meilleur choix,
   consigné nulle part. Ni l'ADR 0002 ni un ticket ne le dit. Un amendement à
   l'ADR reste à écrire.
3. **Le consentement `LEADERBOARD`** existe dans l'enum depuis P0-004 et
   **aucun écran ne le recueille** — sixième occurrence du motif « livré sans
   appelant » (règle 7).

C'est ce qui a produit la règle 8 de `CLAUDE.md` et la section obligatoire du
gabarit. Les deux règles sont la même vue par deux bouts : la 7 traque ce qu'on
livre sans que personne l'appelle, la 8 ce qu'on appelle sans que personne l'ait
livré.

### Un quatrième cas, d'une autre nature : un critère au mauvais endroit

**RM5.8 — « dupliquer une semaine en moins de 5 secondes » — figurait dans
P1-002.** Il n'y avait rien à faire : la règle porte sur un **cycle
d'entraînement**, où recopier la semaine 3 en semaine 7 évite une ressaisie
complète. Sur un planning **récurrent**, elle n'a pas d'objet — une série se
répète déjà par définition, et la dupliquer reviendrait à en créer une seconde,
identique, que personne ne veut.

Retiré de P1-002 le 3 septembre 2026, **transféré à P2-010**, et inscrit ici pour
qu'on ne le retrouve pas dans six mois en croyant à un oubli.

Ce n'est pas un trou de couverture mais son symétrique, et il vaut d'être noté :
les règles 7 et 8 attrapent ce qui manque et ce qu'on suppose, aucune n'attrape
**ce qui est là sans raison d'y être**. Un critère recopié d'une section de spec
vers un ticket dont ce n'est pas le sujet passe tous les contrôles — il a même un
test possible, il est simplement sans objet. Le seul filtre reste de demander,
critère par critère : *à quoi sert-il ici ?*
