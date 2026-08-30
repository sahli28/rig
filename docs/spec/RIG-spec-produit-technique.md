# RIG — Spécification produit & technique

### Plateforme SaaS multi-tenant pour boxes CrossFit / Hyrox

**Réservation · Programmation · Coopération inter-box**

|                          |                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Version du document**  | 1.0 — 30 août 2026                                                                                               |
| **Nom de code produit**  | RIG (à valider marque, cf. §20)                                                                                  |
| **Priorité MVP retenue** | **CrossFit d'abord**, Hyrox en v1                                                                                |
| **Point de départ**      | Greenfield total (aucun design, API ou données à conserver)                                                      |
| **Capacité de delivery** | **Solo / side project (1 personne)** — toutes les estimations et la roadmap sont calibrées pour cette contrainte |
| **Langues**              | FR + EN dès le MVP                                                                                               |
| **Plateformes**          | iOS, Android (app native cross-platform), Web responsive                                                         |
| **Conformité**           | RGPD (France / UE), PCI-DSS SAQ-A via Stripe                                                                     |

---

## 0. Hypothèses structurantes (à contester si besoin)

Ces hypothèses conditionnent tout le reste du document. Elles sont issues de vos réponses + de la réalité du marché français.

| #   | Hypothèse                                                                                                           | Impact si fausse                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| H1  | Vous développez seule, à temps partiel (~15–20 h/semaine effectives)                                                | Roadmap ×2 ou ÷2 (§13 donne les deux bornes)                                                                 |
| H2  | La box « type » cible : 80–250 membres, 1–2 salles, 3–6 coachs, 25–45 cours/semaine, CA 8–25 k€/mois                | Si box > 400 membres : besoin d'un module RH/paie et de rapports avancés dès le MVP                          |
| H3  | Les boxes cibles utilisent aujourd'hui Wodify, SmartWOD, Resamania, Hustle, Mindbody ou… un Google Sheet + WhatsApp | La migration de données devient un **produit** à part entière (cf. §18)                                      |
| H4  | Le payeur est la box (B2B SaaS), pas le membre. Le membre est l'utilisateur mais pas le client                      | Un modèle B2C changerait radicalement le GTM et l'app mobile                                                 |
| H5  | La coopération inter-box (marketplace de cours) est un **différenciateur v1**, pas un besoin MVP                    | Si c'est le cœur de la proposition de valeur, il faut inverser §13 et livrer le réseau avant le SaaS         |
| H6  | Vous n'avez pas de licence de courtier ni d'entité juridique pour encaisser à la place des boxes                    | Confirmé : **Stripe Connect obligatoire**, jamais d'encaissement en propre (cf. §15)                         |
| H7  | Pas d'accès aux données officielles Hyrox (l'organisation ne publie pas d'API publique)                             | Le module Hyrox reste un outil d'entraînement + événements internes à la box, pas une intégration officielle |

> ⚠️ **Point de vigilance business, dit franchement dès le début.** Le marché du logiciel de gestion de box est **saturé et très concurrentiel** (Wodify, Mindbody, PushPress, TeamUp, Resamania, Hustle, Fitogram…), avec des acteurs financés qui ont 8 ans d'avance produit. En solo, viser le « Wodify français complet » est un piège à 3 ans. La stratégie qui a une chance de marcher : **entrer par un angle étroit et sous-servi** (la programmation Hyrox + le réseau inter-box), puis élargir vers la gestion. Le §17 et le §19 reviennent là-dessus avec des chiffres.

---

## 1. Résumé exécutif

RIG est une plateforme SaaS multi-tenant (mobile iOS/Android + web responsive) qui permet à une box de CrossFit ou de préparation Hyrox de gérer l'intégralité de son quotidien — planning et réservation de cours en temps réel, abonnements et packs de crédits, check-in par QR code, encaissement automatisé et reporting financier — tout en offrant à ses coachs un véritable outil de programmation (cycles de force, WOD récurrents, options Rx/Scaled, benchmarks, notes de coach) et à ses membres une app où ils logguent leurs scores, suivent leurs PR et se comparent au leaderboard de la box. Le public cible est double : le **propriétaire de box indépendante** (80 à 250 membres, en France puis en Europe francophone), qui paie un abonnement mensuel par box, et le **membre pratiquant** CrossFit ou Hyrox, qui utilise l'app gratuitement. La proposition de valeur tient en trois points que les acteurs installés ne couvrent pas ensemble : (1) un outil de **programmation réellement pensé pour les coachs** — la plupart des logiciels de gestion traitent le WOD comme un champ texte, (2) un **module Hyrox natif** (épreuves standardisées, splits, heats, pairings, PR par station) alors que le marché ne propose aujourd'hui que des adaptations CrossFit, et (3) une couche de **coopération inter-box** — planning partagé, passage de membres en visite, marketplace d'événements avec partage de revenus automatisé — qui transforme des boxes concurrentes en réseau et crée un effet de réseau défendable. Le tout en marque blanche, pour que chaque box livre l'app sous son propre nom et ses propres couleurs.

**En une phrase :** _le logiciel de gestion de box qui traite enfin la programmation et le Hyrox comme des citoyens de première classe, et qui relie les boxes entre elles._

---

## 2. MVP — backlog priorisé (MoSCoW)

### 2.1 Méthode d'estimation

- Unité : **jours-homme (j·h) effectifs de 7 h** pour une développeuse senior full-stack seule, incluant tests et intégration, **hors** design graphique poussé, hors support client.
- Les valeurs intègrent déjà une marge de réalisme side-project (contexte switching, reprises après une semaine d'interruption) : ce sont des jours _réels_, pas des jours optimistes.
- Story points donnés à titre indicatif (échelle Fibonacci, ≈ 1,7 SP par j·h sur ce projet).

### 2.2 MUST HAVE — le MVP livrable et vendable

| #   | Fonctionnalité                                                                                          | Rôle(s)               | SP      | j·h           | Justification business                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------- | --------------------- | ------- | ------------- | ---------------------------------------------------------------------------------------------------------------- |
| M1  | Auth e-mail + magic link, Sign in with Apple, Google                                                    | Tous                  | 8       | 4             | Apple **exige** Sign in with Apple si un autre SSO est proposé. Bloquant pour la publication App Store.          |
| M2  | Multi-tenant : création de box, sous-domaine, RLS Postgres, invitation de membres                       | Owner, Super-admin    | 13      | 7             | Socle non rétro-installable. Toute erreur ici se paie ×10 plus tard.                                             |
| M3  | Onboarding box (infos, horaires d'ouverture, salles, capacités)                                         | Owner                 | 8       | 4             | Sans self-onboarding, chaque client coûte 3 h de votre temps. Tueur de marge en solo.                            |
| M4  | Catalogue de types de cours + planning récurrent (RRULE)                                                | Owner, Manager        | 13      | 7             | Le planning est le cœur battant. La récurrence évite la saisie manuelle hebdomadaire.                            |
| M5  | Réservation temps réel avec capacité stricte (anti-surbooking transactionnel)                           | Membre                | 13      | 7             | LA fonction pour laquelle on achète le produit. Un double-booking = perte de confiance immédiate.                |
| M6  | Liste d'attente automatique + promotion + notification                                                  | Membre, Coach         | 8       | 5             | Différence perçue entre « appli qui marche » et « Google Form ». Remplit les cours = valeur directe pour la box. |
| M7  | Annulation avec fenêtre configurable (ex. J-4 h)                                                        | Membre, Owner         | 5       | 3             | Règle métier universelle en box. Sans ça, le planning est ingérable.                                             |
| M8  | Abonnements Stripe (mensuel/annuel) + packs de crédits (10/20 séances)                                  | Owner, Membre         | 21      | 12            | **C'est ce qui fait entrer l'argent.** Les deux modèles coexistent dans 90 % des boxes FR.                       |
| M9  | Stripe Connect (Express) : chaque box encaisse sur son compte, vous prélevez la commission              | Owner, Super-admin    | 13      | 7             | Vous ne pouvez **pas** encaisser à la place des boxes sans agrément. Non négociable juridiquement.               |
| M10 | Portefeuille de crédits : décompte à la réservation, remboursement à l'annulation                       | Membre                | 8       | 5             | Corollaire de M8. Les litiges de crédits sont la 1ʳᵉ source de tickets support.                                  |
| M11 | Check-in QR code (QR côté membre, scan côté box/tablette)                                               | Coach, Membre         | 8       | 5             | Attendu par le marché, valeur perçue élevée pour un coût faible. Alimente les stats de présence.                 |
| M12 | **Programmation CrossFit** : cycles, séances datées, blocs (échauffement / force / metcon / accessoire) | Coach                 | 21      | 12            | **Le différenciateur n°1.** C'est ce que les coachs détestent dans les outils actuels.                           |
| M13 | Rx / Scaled / Beginner : variantes de charges et de mouvements par WOD                                  | Coach, Membre         | 8       | 5             | Sans scaling, le WOD n'est pas exploitable par 60 % des membres.                                                 |
| M14 | Log de score membre (temps, reps, charge) + validation Rx/Scaled                                        | Membre                | 8       | 5             | Boucle d'engagement quotidienne. Ce qui fait revenir dans l'app hors réservation.                                |
| M15 | Leaderboard par WOD (filtres Rx/Scaled, sexe, catégorie d'âge)                                          | Membre                | 8       | 5             | Moteur social et viral. Coût faible une fois M14 fait.                                                           |
| M16 | Notifications push (rappel de cours, promotion waitlist, annulation)                                    | Tous                  | 8       | 5             | Sans push, le taux d'usage de l'app s'effondre.                                                                  |
| M17 | Dashboard box : présences, taux de remplissage, membres actifs, CA du mois                              | Owner                 | 8       | 5             | C'est l'écran qui justifie l'abonnement au renouvellement.                                                       |
| M18 | White-label niveau 1 : logo, couleur primaire, nom de la box dans l'app                                 | Owner                 | 5       | 3             | Argument commercial fort, coût technique faible si prévu dès le départ.                                          |
| M19 | i18n FR/EN complet (UI + e-mails + push)                                                                | Tous                  | 5       | 3             | Coût marginal si fait dès J1, coût x5 en rétro-fit.                                                              |
| M20 | RGPD : consentements, export et suppression de compte, politique de rétention                           | Tous                  | 8       | 5             | **Obligation légale.** La suppression de compte in-app est aussi une exigence Apple.                             |
| M21 | Web app box (back-office responsive) : planning, membres, finances                                      | Owner, Manager, Coach | 13      | 8             | Personne ne gère une box depuis un téléphone. Le back-office web est obligatoire.                                |
|     | **TOTAL MUST**                                                                                          |                       | **210** | **≈ 122 j·h** | ≈ 850 h → **10 à 13 mois** à 15–20 h/semaine                                                                     |

> 📌 **Le chiffre qui compte, dit sans enrobage.** 122 j·h à 7 h effectives font ~850 heures. À 15–20 h/semaine en side project, le MVP complet arrive **entre 10 et 13 mois**. C'est long, et c'est le vrai risque du projet (§19, R1). La parade n'est pas d'accélérer, c'est de **livrer une v0 pilote à ~62 j·h** (M1 à M7, M11, M16, M19, M20, M21 en version réduite : planning + réservation + waitlist + check-in + back-office minimal, **paiement encaissé hors app** pendant la phase pilote) chez une seule box partenaire vers le **mois 6**. Vous validez la valeur avec du vrai usage avant d'avoir écrit une ligne de Stripe Connect. Le §13 construit la roadmap autour de ça.

### 2.3 SHOULD HAVE — v1 (les 6 mois suivants)

| #   | Fonctionnalité                                                                  | SP  | j·h     | Justification                                                                    |
| --- | ------------------------------------------------------------------------------- | --- | ------- | -------------------------------------------------------------------------------- |
| S1  | **Module Hyrox** : 8 épreuves standard, roxzone, splits, chrono, PR par station | 21  | 12      | Votre angle de différenciation. Aucun concurrent ne le fait bien.                |
| S2  | Hyrox : heats, dossards, pairings (simple/double/relais), événement interne     | 13  | 8       | Permet à la box d'organiser sa « Hyrox simulation » — événement payant, donc CA. |
| S3  | Benchmarks CrossFit (Fran, Grace, Murph, Filthy 50, 1RM…) + suivi historique    | 8   | 5       | Peu coûteux, très aimé des membres, effet rétention.                             |
| S4  | Notes de coach privées par membre + suggestions de scaling                      | 8   | 5       | Fidélise le coach, qui est le prescripteur interne du logiciel.                  |
| S5  | Frais d'annulation tardive / no-show (facturation ou décrément de crédit)       | 8   | 5       | Demandé par tous les propriétaires. Sujet politiquement sensible → configurable. |
| S6  | Reporting financier détaillé + export comptable (CSV/FEC-friendly)              | 13  | 7       | Ce que l'expert-comptable réclame. Réduit le churn.                              |
| S7  | Partenariats inter-box : visibilité du planning partenaire, visite de membre    | 13  | 8       | Première brique du réseau. Effet de réseau = défense concurrentielle.            |
| S8  | Commissions & partage de revenus inter-box (Stripe transfers)                   | 13  | 8       | Rend le réseau économiquement viable, pas juste sympathique.                     |
| S9  | Synchronisation calendrier (Google / Apple / .ics)                              | 8   | 4       | Demande récurrente des membres, coût modéré.                                     |
| S10 | Analytics produit (funnel réservation, rétention, cohortes)                     | 5   | 3       | Sans mesure, vous pilotez à l'aveugle sur un marché saturé.                      |
| S11 | Programmes vendus en marketplace (programme Hyrox 12 semaines à 49 €)           | 13  | 8       | Nouvelle ligne de revenus, marge élevée, extensible au B2C.                      |
| S12 | Rôle Manager distinct d'Owner + journal d'audit                                 | 5   | 3       | Nécessaire dès la 2ᵉ salariée de la box.                                         |
|     | **TOTAL SHOULD**                                                                |     | **128** | **≈ 76 j·h**                                                                     |     |

### 2.4 COULD HAVE — v2 (12 mois et au-delà)

| #   | Fonctionnalité                                                                   | j·h | Justification                                                                                                                |
| --- | -------------------------------------------------------------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------- |
| C1  | White-label niveau 2 : app dédiée publiée sous le compte développeur de la box   | 12  | Argument premium à 150–300 €/mois, mais **coût de maintenance récurrent élevé** — ne le vendez pas avant d'avoir 30 clients. |
| C2  | Marketplace inter-box publique (drop-in visiteurs, événements ouverts)           | 15  | La vraie vision réseau. Nécessite une masse critique de boxes.                                                               |
| C3  | Intégrations wearables (Apple Health, Whoop, Garmin, Polar HR live)              | 12  | Le HR live affiché sur écran de salle est un « wow » commercial fort.                                                        |
| C4  | Générateur de programmation assisté par IA (à partir d'objectifs et de matériel) | 10  | Fort attrait marketing ; risque de qualité perçue si mal fait.                                                               |
| C5  | Module nutrition / macros                                                        | 10  | Souvent demandé, rarement utilisé. À valider avant de coder.                                                                 |
| C6  | Gestion du matériel et des stocks (boutique, shakers, tapes)                     | 8   | Marge faible pour vous, utile pour la box.                                                                                   |
| C7  | Contrats et mandats SEPA, gestion des impayés et relances                        | 10  | Le prélèvement SEPA reste le standard des salles françaises → à terme incontournable.                                        |
| C8  | Écran TV de salle (WOD du jour, timer, leaderboard live)                         | 6   | Visibilité quotidienne dans la box = marketing gratuit.                                                                      |

### 2.5 WON'T HAVE (explicitement hors périmètre)

| Exclusion                                                                 | Raison                                                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Paie, planning RH et contrats des coachs                                  | Métier différent, forte complexité juridique FR, faible différenciation                           |
| Contrôle d'accès physique (tourniquets, badges RFID, serrures connectées) | Hardware = SAV, stocks, déplacements. Incompatible avec un solo.                                  |
| Vente de matériel / e-commerce complet                                    | Shopify le fait mieux ; se contenter d'un lien sortant                                            |
| Réseau social complet (fil d'actualité, messagerie privée, stories)       | Coût de modération et de maintenance disproportionné. Se limiter aux commentaires sur les scores. |
| Application Apple Watch / Wear OS native                                  | À reconsidérer en v2 seulement ; le chrono en salle passe par la tablette et l'écran TV           |
| Comptabilité intégrée (facturation légale, TVA, bilan)                    | Sortie CSV + intégration Pennylane/Qonto suffisante et bien plus sûre juridiquement               |
| Multi-devise et multi-fuseaux avancé                                      | EUR / Europe au départ ; à ouvrir quand un client hors zone le paiera                             |

### 2.6 Ligne de démarcation « MVP vendable »

Le MVP est prêt à être vendu quand une box peut, **sans votre intervention** : créer son compte → configurer son planning de la semaine → inviter ses membres → vendre un abonnement et un pack de 10 séances → voir ses membres réserver, être en liste d'attente, annuler et pointer par QR → publier le WOD du jour avec Rx/Scaled → voir ses membres logguer leur score → consulter son CA et son taux de remplissage. Tout le reste est du confort.

---

## 3. Personas

### Persona 1 — Marc, propriétaire de box

|                              |                                                                                                                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Âge / profil**             | 38 ans, ex-coach devenu entrepreneur, CrossFit L2, a ouvert sa box il y a 4 ans                                                                                                                |
| **Contexte**                 | Box de 165 membres à Rueil-Malmaison, 2 salariés + 3 coachs indépendants, 34 cours/semaine, CA ≈ 16 k€/mois                                                                                    |
| **Outils actuels**           | Un logiciel américain à 129 €/mois qu'il trouve « lourd et en anglais », + Excel pour les vrais chiffres, + WhatsApp pour tout le reste                                                        |
| **Objectifs**                | Remplir ses cours creux (11 h et 14 h), réduire les impayés, savoir qui va churner **avant** qu'il churne, arrêter de passer 6 h/semaine en admin                                              |
| **Frustrations**             | « Je paie cher un truc dont j'utilise 20 % » · « Le support répond en anglais à J+2 » · « Je ne sais pas combien je gagne réellement ce mois-ci » · « Mes coachs programment sur Google Docs » |
| **Ce qui déclenche l'achat** | Un prix en euros, une facture française, un support qui répond en français dans la journée, et **la reprise de ses données existantes**                                                        |
| **Ce qui le fait partir**    | Une erreur de facturation vers un membre. Une seule.                                                                                                                                           |
| **KPI qu'il regarde**        | MRR, membres actifs, taux de remplissage, churn mensuel, no-show rate                                                                                                                          |

**Scénario d'usage.** Lundi 8 h 30, dans son bureau. Il ouvre le back-office web sur son laptop, voit que le cours de 11 h n'a que 3 inscrits sur 16, déclenche en deux clics une notification push ciblée sur les membres « abonnés mais inactifs depuis 10 jours ». Il consulte le rapport financier du mois : 14 200 € encaissés, 1 100 € de paiements en échec — il relance les 6 membres concernés depuis l'app. Puis il valide la programmation de la semaine que son head coach a préparée.

---

### Persona 2 — Sarah, head coach

|                                 |                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Âge / profil**                | 31 ans, coach à temps plein, CF-L2 + certifiée Hyrox, ancienne athlète régionale                                                                                                                                                                             |
| **Contexte**                    | Programme pour les 165 membres de la box, anime 18 cours/semaine, suit 8 membres en coaching individuel                                                                                                                                                      |
| **Outils actuels**              | Google Sheets pour les cycles, Notes iPhone pour les scaling, un groupe WhatsApp par créneau, Beyond the Whiteboard pour ses athlètes avancés                                                                                                                |
| **Objectifs**                   | Construire des cycles cohérents sur 8–12 semaines, savoir qui a fait quoi, avoir un scaling prêt pour la personne blessée du jour, préparer 12 membres pour la Hyrox de Paris                                                                                |
| **Frustrations**                | « Je réécris la même séance à trois endroits » · « Le logiciel ne comprend pas ce qu'est un EMOM » · « Je n'ai aucun historique quand un membre me demande son 1RM back squat » · « Impossible de programmer un cycle, seulement des séances jour par jour » |
| **Ce qui déclenche l'adoption** | Le premier cycle créé en 20 minutes au lieu de 2 heures                                                                                                                                                                                                      |
| **Ce qui la fait décrocher**    | Une saisie de WOD plus lente que dans Google Sheets. C'est le seul benchmark qui compte.                                                                                                                                                                     |
| **KPI qu'elle regarde**         | Progression des membres, participation, scores loggués, PR battus                                                                                                                                                                                            |

**Scénario d'usage.** Dimanche soir, sur son canapé, tablette en main. Elle duplique le cycle « Force — Squat Wave » de la semaine précédente, ajuste les pourcentages de 1RM (l'app calcule automatiquement les charges pour chaque membre à partir de leurs PR enregistrés), écrit le metcon du mardi, ajoute une variante Scaled (pull-up → ring row) et une variante Beginner, planifie la publication à lundi 6 h. Le mardi, en salle, elle ouvre la vue Coach du cours de 18 h, voit les 14 inscrits avec un badge « ⚠️ épaule droite » sur Léa, et lui prépare une alternative avant même qu'elle n'arrive.

---

### Persona 3 — Léa, membre (CrossFit régulière & prépa Hyrox)

|                                 |                                                                                                                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Âge / profil**                | 29 ans, cheffe de projet, 3–4 séances/semaine depuis 2 ans, premier Hyrox prévu dans 4 mois                                                                                                                                     |
| **Contexte**                    | Abonnement illimité à 89 €/mois, réserve la veille au soir, vient surtout à 18 h 30 et le samedi matin                                                                                                                          |
| **Outils actuels**              | L'app de la box (qu'elle trouve « moche mais ça marche »), Strava, Notes iPhone pour ses PR, un groupe WhatsApp « Team Hyrox »                                                                                                  |
| **Objectifs**                   | Avoir une place au cours de 18 h 30 (souvent complet), suivre sa progression, battre son bar muscle-up, arriver prête à sa première Hyrox                                                                                       |
| **Frustrations**                | « Le cours est complet et je ne sais pas si je vais monter dans la liste d'attente » · « Je ne connais le WOD qu'en arrivant » · « Mes PR sont dans mes notes, mes temps dans ma tête » · « Rien dans l'app ne parle de Hyrox » |
| **Ce qui déclenche l'adoption** | Réserver en 2 taps depuis l'écran d'accueil. Littéralement 2 taps.                                                                                                                                                              |
| **Ce qui la fait désinstaller** | Perdre une place à cause d'un bug, ou être facturée à tort                                                                                                                                                                      |
| **KPI qu'elle regarde**         | Ses PR, son nombre de séances par mois, sa place au leaderboard, son temps sur les stations Hyrox                                                                                                                               |

**Scénario d'usage.** Dimanche 21 h, dans son lit. Notification : « Le WOD de lundi est publié 💪 ». Elle l'ouvre, voit un Fran, consulte son PR (7:42, Rx), réserve le cours de 18 h 30 — complet — se met en liste d'attente. Lundi 14 h : « Une place s'est libérée, tu es inscrite pour 18 h 30 ». Elle arrive, scanne le QR à l'entrée, fait le WOD, entre son score (7:19 Rx) : l'app affiche « 🎉 Nouveau PR, -23 s » et sa 4ᵉ place au leaderboard féminin de la semaine. Elle partage l'image du résultat en story.

---

## 4. Parcours utilisateurs clés

Format commun pour chacun : **étapes → écrans → données échangées → règles métier → critères d'acceptation (Gherkin simplifié) → user stories**.

---

### P1 — Inscription et onboarding d'un membre

**Étapes**

1. Le membre reçoit un lien d'invitation de la box (SMS / e-mail / QR affiché dans la salle) ou scanne le QR d'affiliation.
2. Écran de bienvenue **aux couleurs de la box** (le tenant est résolu depuis le token du lien, _avant_ l'authentification).
3. Authentification : Apple / Google / magic link e-mail.
4. Profil minimal : prénom, nom, date de naissance, sexe (pour les leaderboards par catégorie), téléphone (optionnel).
5. Consentements RGPD : CGU + politique de confidentialité (obligatoire), notifications push (optionnel), photos/leaderboard public (optionnel, granulaire).
6. Choix de formule : abonnement, pack de crédits, ou « je verrai plus tard » (compte prospect).
7. Paiement si formule payante (Stripe Payment Sheet native).
8. Tutoriel de 3 écrans max, skippable, puis atterrissage sur l'accueil avec un CTA unique : _Réserver ma première séance_.

**Écrans** : `Welcome (branded)` · `Auth` · `Profile Setup` · `Consents` · `Plan Picker` · `Checkout` · `Onboarding Carousel` · `Home`

**Données échangées**

| Sens      | Payload                                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| → serveur | `invite_token`, `provider`, `id_token`, `first_name`, `last_name`, `birthdate`, `gender`, `locale`, `consents[]`, `device_token` |
| ← client  | `session (JWT)`, `user`, `tenant` (branding : logo, couleurs, nom), `membership` (rôle, statut), `feature_flags`                 |

**Règles métier**

- RM1.1 — Un `user` est **global** (une identité, un e-mail) ; il peut avoir N `memberships` dans N boxes. Se réinscrire dans une 2ᵉ box ne recrée pas de compte.
- RM1.2 — Un lien d'invitation expire après 30 jours et est à usage unique s'il est nominatif ; le QR d'affiliation de la box est permanent et multi-usage.
- RM1.3 — Sans consentement CGU + confidentialité, aucune donnée n'est persistée au-delà de l'identifiant d'authentification.
- RM1.4 — Un mineur (< 18 ans) déclenche un flux d'autorisation parentale ; en dessous de 15 ans, le consentement du titulaire de l'autorité parentale est **obligatoire** (art. 8 RGPD, seuil français).
- RM1.5 — Le sexe et la date de naissance sont facultatifs pour l'usage de l'app, mais requis pour figurer dans un leaderboard catégorisé — dit explicitement à l'utilisateur.
- RM1.6 — La suppression de compte est accessible en 3 taps depuis les réglages (exigence Apple + RGPD).

**Critères d'acceptation**

```gherkin
Scénario: Inscription via lien d'invitation
  Étant donné un lien d'invitation valide de la box "CrossFit Rueil"
  Quand j'ouvre le lien sans avoir l'app installée
  Alors je suis redirigée vers le store, et après installation
       le contexte d'invitation est conservé (deferred deep link)
  Et l'écran de bienvenue affiche le logo et la couleur de "CrossFit Rueil"

Scénario: Identité réutilisée entre deux boxes
  Étant donné que j'ai déjà un compte avec l'e-mail lea@example.com
  Quand j'accepte l'invitation d'une seconde box
  Alors aucun nouveau compte n'est créé
  Et un sélecteur de box apparaît dans l'app
  Et mes PR et mon historique personnel me suivent, mes réservations restent par box

Scénario: Refus des notifications
  Quand je refuse les notifications push
  Alors l'inscription se termine normalement
  Et une bannière non bloquante propose de les réactiver depuis les réglages
```

**User stories**

- En tant que **membre**, je veux m'inscrire avec Apple/Google en moins de 60 secondes, afin de ne pas abandonner avant d'avoir réservé.
- En tant que **propriétaire**, je veux un QR d'affiliation à afficher à l'accueil, afin d'inscrire un nouveau membre sans saisir ses coordonnées moi-même.
- En tant que **membre**, je veux voir les couleurs de ma box dès le premier écran, afin de savoir que je suis au bon endroit.

---

### P2 — Réservation d'un cours (avec liste d'attente)

**Étapes**

1. Accueil → le prochain cours réservable est en tête, avec le WOD du jour si publié.
2. Onglet Planning : vue jour (mobile) / semaine (web), filtres par type de cours et par coach.
3. Tap sur un créneau → détail : coach, capacité, inscrits, WOD, matériel, salle.
4. Tap « Réserver » → vérification des droits (abonnement actif OU crédits disponibles OU forfait d'essai).
   5a. Place disponible → réservation confirmée, décompte du crédit le cas échéant, ajout au calendrier proposé.
   5b. Cours complet → « Rejoindre la liste d'attente (3ᵉ position) », aucun débit.
5. Promotion automatique depuis la liste d'attente à la première annulation → push + e-mail.
6. Annulation possible jusqu'à la fenêtre configurée ; au-delà, message explicite sur la conséquence (crédit perdu / frais).

**Écrans** : `Home` · `Schedule (jour/semaine)` · `Class Detail` · `Booking Confirmation` · `Waitlist Position` · `Cancel Sheet` · `My Bookings`

**Données échangées**

| Sens       | Payload                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| → serveur  | `class_id`, `membership_id`, `idempotency_key`                                                               |
| ← client   | `booking {id, status, position?, credit_debited, cancel_deadline_at}`, `class {spots_left, waitlist_length}` |
| temps réel | canal WebSocket par classe : `spots_left`, `waitlist_length`, `status`                                       |

**Règles métier**

- RM2.1 — **Anti-surbooking** : le décompte de place se fait dans une transaction Postgres unique (`SELECT … FOR UPDATE` sur la ligne `classes` + insertion de la réservation + contrainte unique `(class_id, membership_id)` sur les réservations actives). Aucune vérification côté client ne fait autorité.
- RM2.2 — Idempotence : toute requête de réservation porte une `Idempotency-Key` ; un double tap ne crée jamais deux réservations ni deux débits.
- RM2.3 — Fenêtre d'ouverture des réservations configurable par box (ex. J-7 à 00:00) et fermeture (ex. 15 min avant le début).
- RM2.4 — Fenêtre d'annulation configurable (défaut : 4 h avant). Avant : crédit restitué. Après : crédit consommé et/ou frais (cf. P4/S5).
- RM2.5 — Réservations simultanées maximum par membre : configurable (défaut 3 cours à venir) pour éviter les réservations « au cas où ».
- RM2.6 — Promotion de la liste d'attente en FIFO strict, avec **délai d'acceptation** : si le cours débute dans plus de 12 h, la personne promue a 60 min pour confirmer ; sinon promotion automatique sans confirmation.
- RM2.7 — Un membre sans droits valides voit un CTA « Choisir une formule » à la place de « Réserver » — jamais un message d'erreur brut.
- RM2.8 — Une réservation est bloquée si l'abonnement expire avant la date du cours.

**Critères d'acceptation**

```gherkin
Scénario: Deux membres réservent la dernière place simultanément
  Étant donné un cours avec 1 place restante
  Quand deux membres appuient sur "Réserver" dans la même seconde
  Alors exactement un est confirmé et l'autre reçoit "Cours complet — rejoindre la liste d'attente ?"
  Et aucun crédit n'est débité pour le second

Scénario: Promotion depuis la liste d'attente
  Étant donné que je suis 1ʳᵉ sur la liste d'attente d'un cours de demain 18h30
  Quand un membre inscrit annule
  Alors je reçois une notification push dans les 30 secondes
  Et j'ai 60 minutes pour confirmer avant que la place ne passe au suivant
  Et mon crédit n'est débité qu'à la confirmation

Scénario: Annulation hors délai
  Étant donné une fenêtre d'annulation de 4 h et un cours dans 2 h
  Quand j'annule
  Alors une confirmation explicite affiche "Ton crédit sera consommé"
  Et après validation le crédit est consommé et la place est rendue à la liste d'attente

Scénario: Mode dégradé réseau
  Quand je perds la connexion pendant la réservation
  Alors l'app affiche un état "en cours" et rejoue la requête avec la même Idempotency-Key
  Et aucune double réservation n'est créée
```

**User stories**

- En tant que **membre**, je veux réserver mon prochain cours en 2 taps depuis l'accueil, afin de ne pas y passer du temps.
- En tant que **membre**, je veux connaître ma position exacte en liste d'attente, afin de savoir si je dois prévoir un plan B.
- En tant que **coach**, je veux voir la liste des inscrits en temps réel, afin de préparer le matériel et les scalings.
- En tant que **propriétaire**, je veux paramétrer mes fenêtres d'ouverture et d'annulation, afin de refléter mes règles de salle.

---

### P3 — Check-in par QR code

**Étapes**

1. Le membre ouvre l'app → carte de membre avec QR **dynamique** (rotation toutes les 30 s, TOTP-like).
2. Il le présente à la tablette d'entrée (mode Kiosque) ou le coach scanne avec son téléphone.
3. Le serveur valide : QR non expiré, membership actif, réservation existante pour un cours dans la fenêtre ±30 min.
4. Retour visuel + sonore immédiat : ✅ vert (validé) / 🟠 orange (pas de réservation → proposition de drop-in) / 🔴 rouge (droits expirés).
5. La présence est enregistrée et alimente le leaderboard, les statistiques et la facturation à la séance.

**Écrans** : `Member Card (QR)` · `Kiosk Scanner` · `Coach Roster` · `Check-in Result` · `Drop-in Prompt`

**Données échangées** : `{qr_token, scanned_at, device_id, location_id}` → `{status, member_name, member_photo, class_title, warning?}`

**Règles métier**

- RM3.1 — Le QR encode un jeton signé à durée de vie courte (30 s) lié au `membership_id` : une capture d'écran partagée ne fonctionne pas.
- RM3.2 — Le check-in est possible de 30 min avant à 15 min après le début du cours (configurable).
- RM3.3 — Sans réservation, le check-in propose un drop-in : décompte d'un crédit ou paiement à l'unité, selon les réglages de la box.
- RM3.4 — Absence de check-in = **no-show** si le cours a eu lieu et que la réservation n'a pas été annulée → alimente la règle de frais (S5).
- RM3.5 — Mode dégradé : le scanner en mode Kiosque fonctionne hors ligne pendant 4 h (cache local des membres attendus) et synchronise ensuite. **Ne jamais bloquer l'entrée d'un membre pour un problème réseau.**
- RM3.6 — Un coach peut cocher manuellement une présence dans la feuille de cours (fallback universel).

**Critères d'acceptation**

```gherkin
Scénario: Check-in nominal
  Étant donné une réservation pour le cours de 18h30 et qu'il est 18h12
  Quand je présente mon QR à la tablette
  Alors la validation prend moins de 1,5 seconde
  Et l'écran affiche mon prénom et une coche verte

Scénario: QR expiré ou capture d'écran
  Quand je présente un QR généré il y a plus de 60 secondes
  Alors le check-in est refusé avec le message "Rafraîchis ton code dans l'app"

Scénario: Coupure internet dans la box
  Étant donné que la box a perdu sa connexion
  Quand un membre attendu se présente
  Alors le check-in est accepté hors ligne et synchronisé au retour du réseau
```

**User stories**

- En tant que **membre**, je veux pointer en une seconde, afin de ne pas faire la queue à l'entrée.
- En tant que **coach**, je veux voir qui est arrivé et qui manque, afin de démarrer le cours à l'heure.
- En tant que **propriétaire**, je veux détecter les no-shows, afin d'appliquer ma politique et de libérer les places.

---

### P4 — Paiement : abonnement, crédits, drop-in

**Étapes**

1. Le membre choisit une formule dans le catalogue de la box (`Plan Picker`).
2. Récapitulatif : prix TTC, période d'engagement, date du premier prélèvement, conditions de résiliation.
3. Paiement via Stripe Payment Sheet (Apple Pay / Google Pay / carte). **Aucune donnée carte ne transite par vos serveurs.**
4. Confirmation → activation immédiate des droits + facture PDF par e-mail.
5. Renouvellement automatique ; en cas d'échec : relance (dunning) J+1, J+3, J+5, puis suspension des droits de réservation.
6. Résiliation en self-service, avec date de fin de droits clairement affichée.

**Écrans** : `Plan Picker` · `Plan Detail` · `Checkout (Stripe Sheet)` · `Payment Success` · `My Membership` · `Invoices` · `Payment Failed Banner` · `Cancel Subscription Flow`

**Données échangées**

| Sens             | Payload                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| → serveur        | `plan_id`, `payment_method_id`, `promo_code?`, `idempotency_key`                                                                   |
| ← client         | `subscription {id, status, current_period_end, cancel_at}` ou `credit_wallet {balance, expires_at}`                                |
| Stripe → serveur | webhooks : `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated/deleted`, `charge.refunded`, `account.updated` |

**Règles métier**

- RM4.1 — **Stripe Connect Express** : chaque box est un compte connecté. Les fonds vont directement à la box ; RIG prélève une `application_fee` (commission plateforme). Vous n'êtes jamais détentrice des fonds → pas d'agrément établissement de paiement requis.
- RM4.2 — La box est le vendeur au sens juridique : ses CGV, sa TVA, ses factures. RIG facture séparément son abonnement SaaS.
- RM4.3 — Les crédits ont une date d'expiration configurable (défaut 6 mois) ; **prévenir 14 j et 3 j avant expiration** (loyauté commerciale, et ça évite les litiges).
- RM4.4 — Un remboursement de crédit à l'annulation se fait dans le portefeuille, jamais en monnaie, sauf action explicite du propriétaire.
- RM4.5 — Droit de rétractation : la vente à distance de services de loisir à date déterminée en est exemptée (art. L221-28 code de la consommation) — **mais** un abonnement sans date fixe ne l'est pas. Formule à faire valider par un juriste (cf. §19).
- RM4.6 — Échecs de paiement : la suspension du droit de réservation ne survient qu'après la 3ᵉ tentative et une notification claire, jamais silencieusement.
- RM4.7 — Toute mutation financière est journalisée dans un `ledger` append-only (aucune ligne modifiée, seulement des contre-écritures).
- RM4.8 — Le webhook Stripe fait foi, pas le retour client : les droits ne s'activent que sur `invoice.paid`.

**Critères d'acceptation**

```gherkin
Scénario: Souscription réussie
  Quand je souscris à l'abonnement "Illimité 89€"
  Alors mes droits de réservation sont actifs en moins de 5 secondes après le webhook Stripe
  Et je reçois une facture PDF avec les informations légales de la box
  Et la commission plateforme apparaît dans le reporting de la box

Scénario: Échec de prélèvement
  Étant donné un renouvellement dont la carte est refusée
  Quand la 1ʳᵉ tentative échoue
  Alors je reçois un e-mail et une bannière in-app avec un lien de mise à jour de carte
  Et je conserve mes droits de réservation jusqu'à la 3ᵉ tentative échouée

Scénario: Expiration de crédits
  Étant donné un pack de 10 séances expirant dans 14 jours avec 3 séances restantes
  Alors je reçois une notification à J-14 et à J-3
  Et le solde et la date d'expiration sont visibles en permanence sur ma carte de membre
```

**User stories**

- En tant que **membre**, je veux payer avec Apple Pay en 3 secondes, afin de ne pas ressaisir ma carte.
- En tant que **propriétaire**, je veux que l'argent arrive sur mon compte sans passer par un tiers, afin de garder ma trésorerie et ma responsabilité juridique.
- En tant que **propriétaire**, je veux voir mes paiements en échec et relancer en un clic, afin de réduire mes impayés.

---

### P5 — Création d'une feuille de route d'entraînement CrossFit (cycle + WOD)

**Étapes**

1. Le coach crée un **programme** (ex. « Cycle Force Automne ») : objectif, durée 8 semaines, populations cibles.
2. Il définit la structure hebdomadaire (jours et types de séance : Force + Metcon, Gymnastics, Long WOD…).
3. Pour chaque séance, il compose des **blocs** : Échauffement · Force / Skill · Metcon · Accessoire · Cooldown.
4. Chaque bloc reçoit un format (`FOR_TIME`, `AMRAP`, `EMOM`, `TABATA`, `STRENGTH`, `INTERVAL`, `CHIPPER`) et des mouvements issus d'une **bibliothèque normalisée** (nom FR/EN, catégorie, charges Rx H/F).
5. Il déclare les variantes **Rx / Scaled / Beginner** — soit manuellement, soit via des règles de scaling par défaut de la bibliothèque.
6. Les charges en pourcentage (`75 % 1RM Back Squat`) sont résolues **par membre** à partir de ses PR au moment de l'affichage.
7. Il rattache la séance à un ou plusieurs créneaux du planning, et programme la publication (ex. la veille à 18 h).
8. Publication → notification aux membres inscrits → affichage sur l'écran TV de la salle.
9. Après le cours, il consulte les scores, ajoute des notes de coach et ajuste la semaine suivante.

**Écrans** : `Programs List` · `Program Builder (web, drag & drop)` · `Session Editor` · `Block Editor` · `Movement Library` · `Scaling Editor` · `Publish Scheduler` · `WOD of the Day (membre)` · `Score Entry` · `Coach Notes` · `Leaderboard`

**Données échangées**

```
Program → Cycle(s) → Session(s) [datée, rattachée à class_id] → Block(s) → Movement(s) + Variant(s)
Résultat membre : Score {session_id, membership_id, variant, value, unit, notes, verified}
```

**Règles métier**

- RM5.1 — Un programme est **versionné** : le modifier après publication crée une nouvelle version, sans casser les scores déjà enregistrés.
- RM5.2 — Une séance n'est visible des membres qu'après sa `published_at` (permet de préparer 8 semaines à l'avance sans divulgation).
- RM5.3 — Le score n'est saisissable que dans une fenêtre configurable (défaut : jour du cours + 48 h) — sinon les leaderboards perdent tout sens.
- RM5.4 — Un score Rx et un score Scaled ne sont **jamais** comparés dans le même classement.
- RM5.5 — Un PR est détecté automatiquement par (mouvement × type de mesure) : temps sur benchmark, charge max, reps max.
- RM5.6 — Les notes de coach sont privées par défaut (visibles coach + propriétaire) ; le coach peut les partager avec le membre concerné.
- RM5.7 — La bibliothèque de mouvements est **globale et partagée** (référentiel), mais chaque box peut ajouter ses mouvements privés.
- RM5.8 — Duplication : dupliquer une semaine ou un cycle entier doit prendre moins de 5 secondes et décaler automatiquement les dates.

**Critères d'acceptation**

```gherkin
Scénario: Saisie d'un WOD plus rapide que Google Sheets
  Quand je crée un metcon "21-15-9 Thruster 43kg / Pull-up"
  Alors je peux le saisir en moins de 45 secondes, au clavier, sans souris
  Et une saisie en texte libre est reconnue et structurée automatiquement

Scénario: Charges personnalisées
  Étant donné un bloc "5x3 Back Squat @ 80% 1RM"
  Et que mon 1RM enregistré est de 90 kg
  Quand j'ouvre la séance
  Alors l'app affiche "72 kg" avec la mention "80 % de ton 1RM (90 kg)"
  Et si aucun 1RM n'est enregistré, elle affiche le pourcentage et propose de le renseigner

Scénario: Publication planifiée
  Étant donné une séance programmée pour publication à 18h00
  Alors aucun membre ne peut la voir avant 18h00, même en manipulant l'API
  Et à 18h00 les membres inscrits reçoivent une notification

Scénario: Duplication de cycle
  Quand je duplique un cycle de 4 semaines vers le mois suivant
  Alors toutes les séances, blocs, variantes et charges sont copiés, dates décalées
  Et les scores de l'original ne sont pas dupliqués
```

**User stories**

- En tant que **coach**, je veux construire un cycle de 8 semaines et le dupliquer, afin de ne pas repartir d'une feuille blanche chaque saison.
- En tant que **coach**, je veux définir Rx/Scaled/Beginner en une fois, afin que chaque membre voie sa version.
- En tant que **membre**, je veux voir mes charges déjà calculées à partir de mes PR, afin de ne pas faire des maths avec une barre dans les mains.
- En tant que **membre**, je veux logguer mon score en moins de 20 secondes, afin de le faire vraiment.

---

### P6 — Création d'un programme Hyrox (v1)

**Étapes**

1. Le coach crée un programme de type `HYROX_PREP` : date de la course cible, format (Simple / Double / Relais / Pro), niveau.
2. Le générateur propose une structure périodisée (Base → Build → Peak → Taper) sur 8/12/16 semaines.
3. Chaque semaine mêle : **compromised running**, travail par station, force, et une simulation partielle.
4. Les blocs Hyrox utilisent les **8 stations officielles** : SkiErg 1000 m · Sled Push 50 m · Sled Pull 50 m · Burpee Broad Jump 80 m · Rowing 1000 m · Farmers Carry 200 m · Sandbag Lunges 100 m · Wall Balls 100 reps — chacune précédée d'un run de 1 km.
5. Le membre enregistre ses **splits** par station et par run, plus le temps de roxzone (transition).
6. Analyse : temps cumulé projeté, station la plus faible, comparaison à ses PR et aux temps de référence par catégorie.
7. La box organise une **simulation** : heats, dossards, pairings, chronométrage, leaderboard.

**Écrans** : `Hyrox Program Builder` · `Station Library` · `Simulation Setup` · `Heat Manager` · `Live Timer` · `Split Entry` · `Station PR Dashboard` · `Race Projection` · `Event Leaderboard`

**Données échangées**

```json
{
  "attempt_id": "att_9f2",
  "format": "SINGLE",
  "division": "WOMEN_OPEN",
  "total_time_s": 4783,
  "splits": [
    { "segment": "RUN_1", "order": 1, "time_s": 312 },
    { "segment": "SKI_ERG", "order": 2, "time_s": 268, "roxzone_s": 41 },
    { "segment": "RUN_2", "order": 3, "time_s": 328 },
    { "segment": "SLED_PUSH", "order": 4, "time_s": 195, "roxzone_s": 38 }
  ]
}
```

**Règles métier**

- RM6.1 — Les 8 stations et leurs distances/charges standard sont un **référentiel système** non modifiable ; la box peut créer des variantes d'entraînement clairement étiquetées « non officiel ».
- RM6.2 — Les charges Rx diffèrent par division (Open / Pro, Femmes / Hommes, Doubles, Relais) → table de référence par division.
- RM6.3 — Le temps total doit être cohérent avec la somme des splits + roxzones ; un écart > 2 % lève un avertissement de saisie.
- RM6.4 — Un heat a une capacité, une heure de départ et un intervalle ; **aucun athlète ne peut être dans deux heats qui se chevauchent**.
- RM6.5 — En format Double, les deux équipiers partagent un temps total et un dossard ; le PR individuel n'est pas mis à jour à partir d'un temps de double.
- RM6.6 — Les leaderboards Hyrox sont segmentés par division ET par format. Jamais de mélange.
- RM6.7 — Mention légale : « HYROX » est une marque déposée. L'app doit parler de _préparation à la Hyrox_ / _format Hyrox_, sans laisser croire à un partenariat officiel (cf. §19).

**Critères d'acceptation**

```gherkin
Scénario: Génération d'un plan 12 semaines
  Quand je crée un programme Hyrox pour une course dans 12 semaines
  Alors un plan périodisé est proposé avec taper sur les 7 derniers jours
  Et je peux modifier chaque séance individuellement

Scénario: Détection de la station faible
  Étant donné 3 simulations enregistrées avec splits
  Alors le tableau de bord identifie la station où mon écart au temps de référence est le plus grand
  Et propose 2 séances ciblées issues de la bibliothèque

Scénario: Planification de heats
  Étant donné 48 athlètes inscrits et des heats de 12 places toutes les 20 minutes
  Quand je génère les heats
  Alors 4 heats sont créés sans doublon d'athlète
  Et chaque athlète reçoit son numéro de dossard et son heure de départ par notification
```

**User stories**

- En tant que **membre Hyrox**, je veux enregistrer mes splits par station, afin de savoir où je perds du temps.
- En tant que **coach**, je veux générer un plan de préparation périodisé, afin de préparer 12 membres sans écrire 12 plans.
- En tant que **propriétaire**, je veux organiser une simulation payante avec heats et leaderboard, afin de créer un événement rentable et fédérateur.

---

### P7 — Gestion du planning avec une box partenaire (coopération inter-box)

**Étapes**

1. La box A envoie une **demande de partenariat** à la box B depuis le back-office (recherche par nom ou code box).
2. La box B accepte et les deux paramètrent l'accord : périmètre (cours ouverts / événements uniquement), quotas, tarif visiteur, commission, réciprocité.
3. Les créneaux de B marqués « ouverts au réseau » apparaissent dans l'app des membres de A, avec un badge visuel distinct **et le nom de B toujours affiché**.
4. Un membre de A réserve chez B : vérification du quota (ex. 2 visites/mois), débit d'un crédit A ou paiement du tarif visiteur.
5. Check-in chez B avec le même QR (le scanner de B reconnaît un visiteur du réseau).
6. Règlement financier : le tarif visiteur est réparti automatiquement (part B, part A, commission RIG) via des transferts Stripe Connect.
7. Reporting consolidé mensuel pour chaque box : visiteurs reçus / envoyés, revenus, solde net.

**Écrans** : `Partners List` · `Partnership Request` · `Partnership Settings` · `Shared Schedule (badge réseau)` · `Cross-box Booking Confirmation` · `Visitor Roster (coach)` · `Network Revenue Report`

**Données échangées**

| Sens      | Payload                                                                          |
| --------- | -------------------------------------------------------------------------------- |
| → serveur | `partner_tenant_id`, `class_id`, `visiting_membership_id`, `settlement_mode`     |
| ← client  | `booking {is_visitor: true, host_tenant, price, credits_used}`                   |
| interne   | `settlement {gross, host_share, origin_share, platform_fee, stripe_transfer_id}` |

**Règles métier**

- RM7.1 — Un partenariat est **bilatéral et explicitement accepté** des deux côtés ; il est révocable à tout moment, avec effet sur les réservations futures uniquement (les réservations déjà payées sont honorées).
- RM7.2 — La box hôte garde **toujours** le contrôle : capacité réservée aux visiteurs (ex. max 3 places par cours), types de cours éligibles, plages horaires autorisées.
- RM7.3 — Les données personnelles partagées entre boxes sont **minimales** : prénom, initiale du nom, box d'origine, photo si consentie. Jamais l'e-mail, le téléphone, l'historique de paiement ou les notes de coach. Base légale RGPD : intérêt légitime + information claire, avec opt-out.
- RM7.4 — Le visiteur reste membre de A ; il n'apparaît pas dans la base membres de B, seulement dans sa feuille de présence et son reporting.
- RM7.5 — Répartition par défaut : 80 % hôte / 15 % origine / 5 % plateforme — entièrement paramétrable par accord.
- RM7.6 — Quota par défaut : 2 visites/membre/mois, plafonné par accord. Au-delà, le membre paie le tarif drop-in plein.
- RM7.7 — Un membre suspendu ou en impayé chez A ne peut pas réserver chez B.
- RM7.8 — Conflit d'agenda : impossible de réserver un cours chez B qui chevauche une réservation existante chez A.

**Critères d'acceptation**

```gherkin
Scénario: Réservation cross-box avec quota
  Étant donné un partenariat A↔B avec un quota de 2 visites/mois
  Et que j'ai déjà utilisé 2 visites ce mois-ci
  Quand je tente de réserver un 3ᵉ cours chez B
  Alors l'app propose le tarif drop-in visiteur au lieu du quota
  Et affiche clairement le montant avant validation

Scénario: Répartition des revenus
  Étant donné un drop-in visiteur à 20 € et un accord 80/15/5
  Quand le paiement est capturé
  Alors 16 € sont transférés à la box hôte, 3 € à la box d'origine, 1 € à la plateforme
  Et l'écriture apparaît dans le reporting des deux boxes le jour même

Scénario: Rupture de partenariat
  Quand la box B révoque le partenariat
  Alors les créneaux de B disparaissent de l'app des membres de A sous 60 secondes
  Et les réservations déjà payées restent valides et honorées

Scénario: Minimisation des données
  Quand un coach de B ouvre sa feuille de présence
  Alors il voit "Léa M. — CrossFit Rueil" et rien d'autre
  Et aucun accès aux coordonnées ou à l'historique de la visiteuse
```

**User stories**

- En tant que **propriétaire**, je veux ouvrir quelques places aux boxes partenaires, afin de remplir mes créneaux creux et de générer du revenu marginal.
- En tant que **propriétaire**, je veux garder le contrôle du nombre de visiteurs par cours, afin de ne pas dégrader l'expérience de mes propres membres.
- En tant que **membre**, je veux m'entraîner dans une box partenaire quand je voyage, afin de ne pas rater ma semaine.
- En tant que **propriétaire**, je veux un reporting consolidé du réseau, afin de savoir si le partenariat me rapporte ou me coûte.

---

## 5. Spécification fonctionnelle par rôle

### 5.1 Modèle de rôles

Cinq rôles, dont quatre **scopés au tenant** (un utilisateur peut avoir un rôle différent dans chaque box) et un global.

| Rôle          | Scope      | Description                                                                           |
| ------------- | ---------- | ------------------------------------------------------------------------------------- |
| `SUPER_ADMIN` | Plateforme | Vous. Support, facturation SaaS, feature flags, modération.                           |
| `OWNER`       | Tenant     | Propriétaire de la box. Accès total, y compris finances et suppression.               |
| `MANAGER`     | Tenant     | Gère le quotidien : planning, membres, réservations. Vue financière en lecture seule. |
| `COACH`       | Tenant     | Programmation, cours qui lui sont assignés, notes. Aucun accès financier.             |
| `MEMBER`      | Tenant     | Réserve, paie, logue ses scores.                                                      |

### 5.2 Matrice de permissions

Légende : ✅ complet · 👁 lecture seule · 🔸 partiel/conditionnel · ❌ aucun accès

| Capacité                                      |      SUPER_ADMIN      |   OWNER    |        MANAGER        |     COACH      |             MEMBER             |
| --------------------------------------------- | :-------------------: | :--------: | :-------------------: | :------------: | :----------------------------: |
| Créer / supprimer une box                     |          ✅           | 🔸 (créer) |          ❌           |       ❌       |               ❌               |
| Paramètres box, branding, white-label         |          ✅           |     ✅     |  🔸 (hors branding)   |       ❌       |               ❌               |
| Gérer les rôles et invitations staff          |          ✅           |     ✅     | 🔸 (coachs seulement) |       ❌       |               ❌               |
| Créer / modifier le planning                  |          ✅           |     ✅     |          ✅           | 🔸 (ses cours) |               ❌               |
| Assigner un coach à un cours                  |          ✅           |     ✅     |          ✅           |       ❌       |               ❌               |
| Voir la liste des inscrits                    |          ✅           |     ✅     |          ✅           | 🔸 (ses cours) |    🔸 (prénoms si consenti)    |
| Réserver / annuler pour un membre             |          ✅           |     ✅     |          ✅           | 🔸 (ses cours) |         🔸 (soi-même)          |
| Forcer une inscription au-delà de la capacité |          ✅           |     ✅     |          ✅           |       ❌       |               ❌               |
| Créer / éditer des programmes et WOD          |          ✅           |     ✅     |          🔸           |       ✅       |               ❌               |
| Publier un WOD                                |          ✅           |     ✅     |          ✅           |       ✅       |               ❌               |
| Notes de coach                                |          ✅           |     👁      |          ❌           |       ✅       | 🔸 (celles partagées avec soi) |
| Saisir / corriger un score                    |          ✅           |     ✅     |          🔸           |   ✅ (tous)    |          🔸 (le sien)          |
| Voir le leaderboard                           |          ✅           |     ✅     |          ✅           |       ✅       |               ✅               |
| Créer des formules et tarifs                  |          ✅           |     ✅     |          ❌           |       ❌       |               ❌               |
| Voir le CA et le reporting financier          |          ✅           |     ✅     |           👁           |       ❌       |               ❌               |
| Rembourser / créditer un membre               |          ✅           |     ✅     |     🔸 (< seuil)      |       ❌       |               ❌               |
| Configurer Stripe Connect                     |          ✅           |     ✅     |          ❌           |       ❌       |               ❌               |
| Gérer les partenariats inter-box              |          ✅           |     ✅     |     🔸 (proposer)     |       ❌       |               ❌               |
| Envoyer une notification de masse             |          ✅           |     ✅     |          ✅           |       ❌       |               ❌               |
| Exporter les données membres                  |          ✅           |     ✅     |          ❌           |       ❌       |        🔸 (les siennes)        |
| Supprimer un compte membre                    |          ✅           |     ✅     |          ❌           |       ❌       |          🔸 (le sien)          |
| Consulter le journal d'audit                  |          ✅           |     ✅     |          ❌           |       ❌       |               ❌               |
| Se connecter en tant que (impersonation)      | 🔸 (tracé + consenti) |     ❌     |          ❌           |       ❌       |               ❌               |

### 5.3 Vues principales et notifications par rôle

| Rôle          | Vue d'atterrissage                                                                             | Notifications reçues                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `OWNER`       | Dashboard : CA du mois, membres actifs, taux de remplissage, alertes (impayés, désabonnements) | Paiement en échec · Résiliation · Objectif de remplissage non atteint · Demande de partenariat · Récap hebdo lundi 8 h                        |
| `MANAGER`     | Planning de la semaine + tâches du jour                                                        | Cours sans coach assigné · Liste d'attente saturée · Nouveau membre inscrit                                                                   |
| `COACH`       | Mes cours du jour + WOD à publier                                                              | Cours dans 1 h avec liste des inscrits · Score inhabituel/PR d'un membre · Rappel de publication de WOD                                       |
| `MEMBER`      | Accueil : prochain cours, WOD du jour, solde                                                   | Rappel J-1 18 h · Promotion waitlist · Annulation d'un cours par la box · WOD publié · PR battu · Crédits bientôt expirés · Paiement en échec |
| `SUPER_ADMIN` | Console : tenants, MRR, erreurs, webhooks en échec                                             | Webhook Stripe en échec · Nouveau tenant · Erreur 5xx en pic · Signalement de contenu                                                         |

**Règles transverses de notification**

- Quiet hours par défaut 21 h–7 h (heure locale du membre), sauf annulation d'un cours imminent.
- Toutes les notifications sont désactivables par catégorie ; les notifications transactionnelles (paiement, annulation) restent en e-mail même si le push est coupé.
- Fréquence max de notifications marketing : 2/semaine par membre, avec opt-in explicite (obligation e-privacy).

---

## 6. Catalogue d'écrans

Priorité : **P0** = MVP · **P1** = v1 · **P2** = v2. Plateforme : 📱 mobile · 💻 web · 🖥 kiosque/TV.

### 6.1 Application membre (📱 + 💻 responsive léger)

| Écran                | Objectif                    | Éléments UI essentiels                                                                         | Prio | Variation white-label           |
| -------------------- | --------------------------- | ---------------------------------------------------------------------------------------------- | :--: | ------------------------------- |
| Splash / Welcome     | Poser l'identité de la box  | Logo box, dégradé couleur primaire, CTA connexion/inscription                                  |  P0  | Logo + couleurs + nom           |
| Auth                 | Se connecter sans friction  | Boutons Apple/Google, champ e-mail, lien magic link                                            |  P0  | Logo uniquement                 |
| Profile Setup        | Collecter le minimum        | Prénom, nom, date de naissance, sexe, photo (opt.)                                             |  P0  | —                               |
| Consents             | Conformité RGPD             | Cases distinctes CGU / confidentialité / push / leaderboard, liens documents                   |  P0  | Textes légaux de la box         |
| Home                 | Faire agir en 2 taps        | Carte « prochain cours » + CTA, WOD du jour, solde crédits, bandeau alerte paiement            |  P0  | Couleur d'accent, image de fond |
| Schedule             | Trouver et réserver         | Sélecteur de jour, liste de créneaux (heure, type, coach, X/Y places, pastille), filtres       |  P0  | Couleur des pastilles           |
| Class Detail         | Décider et réserver         | Coach + photo, capacité, liste d'inscrits (si consenti), WOD, matériel, bouton d'action unique |  P0  | —                               |
| Booking Confirmation | Rassurer                    | Coche animée, récap, « Ajouter au calendrier », « Annuler »                                    |  P0  | —                               |
| Waitlist Position    | Réduire l'anxiété           | Position, probabilité estimée, bouton quitter                                                  |  P0  | —                               |
| My Bookings          | Gérer ses réservations      | Onglets À venir / Passés, swipe pour annuler                                                   |  P0  | —                               |
| Member Card (QR)     | Entrer dans la box          | QR animé, nom, statut, solde, compte à rebours de rafraîchissement                             |  P0  | Carte aux couleurs de la box    |
| WOD of the Day       | Consulter la séance         | Blocs pliables, sélecteur Rx/Scaled/Beginner, charges personnalisées, bouton « Logger »        |  P0  | —                               |
| Score Entry          | Enregistrer un résultat     | Clavier numérique adapté au type de mesure, variante, notes, photo (opt.)                      |  P0  | —                               |
| Leaderboard          | Se comparer                 | Onglets Rx/Scaled, filtres sexe/âge, ma position épinglée                                      |  P0  | Couleur du podium               |
| Plan Picker          | Convertir                   | Cartes de formules, prix TTC, badge recommandé, comparateur                                    |  P0  | Couleurs et libellés box        |
| Checkout             | Payer                       | Stripe Payment Sheet native, Apple/Google Pay                                                  |  P0  | —                               |
| My Membership        | Comprendre ses droits       | Formule active, prochaine échéance, solde et expiration des crédits, factures, résilier        |  P0  | —                               |
| Settings             | Contrôler                   | Langue, notifications par catégorie, confidentialité, export de données, suppression de compte |  P0  | —                               |
| Profile / PR         | Suivre sa progression       | PR par mouvement, historique, graphiques, badges                                               |  P1  | —                               |
| Hyrox Dashboard      | Piloter sa prépa            | Radar des 8 stations, temps projeté, station faible, prochaine simulation                      |  P1  | —                               |
| Split Entry          | Chronométrer une simulation | Chrono grand format, boutons de segment, roxzone auto                                          |  P1  | —                               |
| Benchmarks           | Se situer                   | Liste de benchmarks, mon meilleur temps, évolution                                             |  P1  | —                               |
| Partner Schedule     | Réserver ailleurs           | Carte + liste des boxes partenaires, badge réseau, quota restant                               |  P1  | Badge réseau neutre             |
| Box Switcher         | Multi-appartenance          | Liste des boxes, changement de contexte                                                        |  P1  | —                               |
| Programs Store       | Acheter un programme        | Vignettes, prix, description, avis                                                             |  P2  | —                               |

### 6.2 Back-office box (💻 principalement, 📱 en consultation)

| Écran                  | Objectif               | Éléments UI essentiels                                                                           | Prio |
| ---------------------- | ---------------------- | ------------------------------------------------------------------------------------------------ | :--: |
| Box Dashboard          | Piloter                | KPI (CA, membres actifs, remplissage, churn), alertes, graphique 30 j                            |  P0  |
| Schedule Manager       | Construire le planning | Grille semaine drag & drop, création récurrente (RRULE), duplication de semaine                  |  P0  |
| Class Editor           | Paramétrer un cours    | Type, coach, salle, capacité, fenêtres de résa/annulation, places visiteurs                      |  P0  |
| Class Roster           | Gérer un cours         | Inscrits, liste d'attente, check-in manuel, ajout/retrait forcé                                  |  P0  |
| Members List           | Administrer            | Recherche, filtres (statut, formule, activité), actions groupées                                 |  P0  |
| Member Detail          | Traiter un cas         | Fiche, formule, historique de présence, paiements, crédits, notes, actions (créditer, suspendre) |  P0  |
| Plans & Pricing        | Vendre                 | CRUD formules, prix, engagement, packs de crédits, codes promo                                   |  P0  |
| Finance Overview       | Suivre l'argent        | Encaissements, impayés, remboursements, commissions, export CSV                                  |  P0  |
| Program Builder        | Programmer             | Timeline de cycle, grille semaine, éditeur de blocs, bibliothèque de mouvements                  |  P0  |
| Session Editor         | Composer une séance    | Blocs ordonnables, format, mouvements, variantes Rx/Scaled/Beginner, planification               |  P0  |
| Box Settings           | Configurer             | Infos, horaires, salles, règles de réservation, branding, langue par défaut                      |  P0  |
| Staff & Roles          | Déléguer               | Invitations, rôles, périmètres                                                                   |  P0  |
| Notifications Composer | Communiquer            | Segment cible, message FR/EN, aperçu, envoi ou planification                                     |  P1  |
| Hyrox Event Manager    | Organiser              | Épreuves, heats, dossards, pairings, chrono, résultats                                           |  P1  |
| Partners               | Coopérer               | Liste, demandes, conditions, quotas, commissions                                                 |  P1  |
| Network Revenue        | Mesurer le réseau      | Visiteurs reçus/envoyés, revenus, solde net, détail par partenaire                               |  P1  |
| Reports                | Analyser               | Assiduité, cohortes, prévision de churn, remplissage par créneau                                 |  P1  |
| Audit Log              | Tracer                 | Qui a fait quoi, quand, sur quoi — filtrable, exportable                                         |  P1  |

### 6.3 Kiosque et écran de salle (🖥)

| Écran                | Objectif            | Éléments                                                       | Prio |
| -------------------- | ------------------- | -------------------------------------------------------------- | :--: |
| Kiosk Check-in       | Pointer sans humain | Caméra plein écran, retour visuel géant, mode hors ligne       |  P0  |
| Gym TV — WOD         | Afficher la séance  | WOD du jour en très gros, Rx/Scaled côte à côte, rotation auto |  P2  |
| Gym TV — Timer       | Chronométrer        | AMRAP/EMOM/For Time, sons, compte à rebours                    |  P2  |
| Gym TV — Leaderboard | Motiver             | Top du jour, PR récents, anniversaires                         |  P2  |

### 6.4 Console plateforme (💻, `SUPER_ADMIN`)

| Écran                     | Objectif                                                  | Prio |
| ------------------------- | --------------------------------------------------------- | :--: |
| Tenants                   | Lister, créer, suspendre les boxes ; MRR par tenant       |  P0  |
| Billing SaaS              | Abonnements plateforme, factures, relances                |  P0  |
| Ops Health                | Webhooks en échec, jobs, erreurs 5xx, latence             |  P0  |
| Feature Flags             | Activer une fonction par tenant                           |  P1  |
| Support Console           | Impersonation tracée et consentie, historique des tickets |  P1  |
| Movement Library (global) | Maintenir le référentiel de mouvements et de scalings     |  P1  |

**Note de conception white-label.** Toute la personnalisation passe par un **objet thème unique** (`logo_url`, `primary`, `on_primary`, `surface`, `radius`, `font`, `app_name`) résolu au démarrage et injecté dans les design tokens. **Aucun composant ne doit contenir une couleur en dur.** Cette discipline dès le premier écran est ce qui rend le white-label gratuit plus tard — et impossible si on l'oublie.

---

## 7. Modèle de données et API

### 7.1 Principes

1. **Un seul schéma Postgres, `tenant_id` sur presque toutes les tables**, isolation par Row Level Security (RLS). C'est le seul modèle tenable en solo (cf. §11.1).
2. `users` et quelques référentiels (`movements`, `hyrox_stations`, `benchmarks`) sont **globaux**, sans `tenant_id`.
3. Identifiants : **UUID v7** (triables chronologiquement, pas d'énumération possible).
4. Toutes les dates en **`timestamptz` UTC**, avec le fuseau du tenant stocké séparément pour l'affichage et les règles métier (une fenêtre d'annulation « 4 h avant » se calcule en heure locale de la box).
5. Aucune suppression physique sur les entités métier : `deleted_at` (soft delete) — sauf sur demande RGPD, qui déclenche une anonymisation réelle.
6. Argent : **entiers en centimes** (`amount_cents int`, `currency char(3)`). Jamais de float.

### 7.2 Schéma ER simplifié (relations)

```
════════ IDENTITÉ & TENANCY ════════
users (global)                1 ──< memberships >── 1        tenants
tenants                       1 ──< tenant_settings (1-1)
tenants                       1 ──< locations ──< rooms
tenants                       1 ──< theme (1-1, white-label)
memberships                   N ──1 users, N ──1 tenants, has role

════════ PLANNING & RÉSERVATION ════════
tenants        1 ──< class_types            (WOD, Haltéro, Hyrox, Open Gym…)
class_types    1 ──< class_schedules        (RRULE + coach + salle + capacité)
class_schedules 1 ──< classes               (occurrences matérialisées, datées)
classes        N ──1 rooms,  N ──1 memberships (coach)
classes        1 ──< bookings >── 1 memberships
classes        1 ──< waitlist_entries >── 1 memberships
bookings       1 ──0..1 checkins
classes        1 ──0..1 sessions            (la séance programmée rattachée au cours)

════════ ARGENT ════════
tenants        1 ──< plans                  (abonnements + packs de crédits)
plans          1 ──< subscriptions >── 1 memberships
memberships    1 ──1 credit_wallets 1 ──< credit_transactions
tenants        1 ──< payments ──< refunds
payments       N ──1 memberships
tenants        1 ──1 stripe_accounts        (Connect Express)
tenants        1 ──< payouts
tenants        1 ──< ledger_entries         (append-only, source de vérité comptable)

════════ PROGRAMMATION ════════
tenants        1 ──< programs               (type: CROSSFIT_CYCLE | HYROX_PREP | CUSTOM)
programs       1 ──< program_weeks ──< sessions
sessions       1 ──< blocks ──< block_movements >── 1 movements (référentiel global)
blocks         1 ──< variants               (RX | SCALED | BEGINNER)
sessions       1 ──< scores >── 1 memberships
movements      1 ──< personal_records >── 1 users     (le PR suit la personne, pas la box)
sessions       1 ──< coach_notes >── 1 memberships
benchmarks (global) 1 ──< benchmark_results >── 1 users

════════ HYROX ════════
hyrox_stations (global, 8 stations officielles)
tenants        1 ──< hyrox_events ──< heats ──< heat_entries >── 1 memberships
heat_entries   1 ──< splits >── 1 hyrox_stations
hyrox_events   1 ──< pairings              (SINGLE | DOUBLE | RELAY)
heat_entries   1 ──0..1 race_results       (temps total, division, rang)

════════ RÉSEAU INTER-BOX ════════
tenants        N ──< partnerships >── N tenants   (bilatéral, avec conditions)
partnerships   1 ──< partnership_rules      (quotas, commissions, types de cours ouverts)
bookings       0..1 ──> visiting_context    (tenant d'origine, accord appliqué)
bookings       1 ──0..1 settlements         (répartition + transferts Stripe)

════════ TRANSVERSE ════════
users          1 ──< devices                (push tokens)
tenants        1 ──< notifications ──< notification_deliveries
tenants        1 ──< audit_logs
users          1 ──< consents               (versionnés, horodatés)
tenants        1 ──< feature_flags
```

### 7.3 Tables principales (colonnes clés)

| Table                 | Colonnes essentielles                                                                                                                                                        | Index / contraintes critiques                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `tenants`             | `id`, `slug` (unique), `name`, `country`, `timezone`, `currency`, `status`, `plan_saas`, `created_at`                                                                        | `unique(slug)`                                                                             |
| `users`               | `id`, `email` (citext unique), `auth_provider`, `first_name`, `last_name`, `birthdate`, `gender`, `locale`, `deleted_at`                                                     | `unique(lower(email))`                                                                     |
| `memberships`         | `id`, `tenant_id`, `user_id`, `role`, `status`, `joined_at`, `left_at`                                                                                                       | `unique(tenant_id, user_id)`                                                               |
| `classes`             | `id`, `tenant_id`, `schedule_id`, `class_type_id`, `coach_membership_id`, `room_id`, `starts_at`, `ends_at`, `capacity`, `booked_count`, `visitor_capacity`, `status`        | `index(tenant_id, starts_at)` · `check(booked_count <= capacity)`                          |
| `bookings`            | `id`, `tenant_id`, `class_id`, `membership_id`, `status`, `credit_txn_id`, `booked_at`, `cancelled_at`, `origin_tenant_id`, `idempotency_key`                                | **`unique(class_id, membership_id) where status='CONFIRMED'`** · `unique(idempotency_key)` |
| `waitlist_entries`    | `id`, `class_id`, `membership_id`, `position`, `promoted_at`, `expires_at`                                                                                                   | `unique(class_id, membership_id)` · `index(class_id, position)`                            |
| `plans`               | `id`, `tenant_id`, `kind` (`SUBSCRIPTION`\|`CREDIT_PACK`\|`DROP_IN`), `name_i18n`, `price_cents`, `interval`, `credits`, `credit_validity_days`, `stripe_price_id`, `active` |                                                                                            |
| `subscriptions`       | `id`, `tenant_id`, `membership_id`, `plan_id`, `stripe_subscription_id`, `status`, `current_period_end`, `cancel_at`                                                         | `index(status, current_period_end)`                                                        |
| `credit_wallets`      | `id`, `membership_id`, `balance`, `updated_at`                                                                                                                               | `unique(membership_id)`                                                                    |
| `credit_transactions` | `id`, `wallet_id`, `delta`, `reason`, `booking_id`, `expires_at`, `created_at`                                                                                               | append-only, `index(wallet_id, created_at)`                                                |
| `ledger_entries`      | `id`, `tenant_id`, `type`, `amount_cents`, `currency`, `direction`, `ref_type`, `ref_id`, `stripe_object_id`, `occurred_at`                                                  | append-only, **jamais d'UPDATE ni de DELETE**                                              |
| `programs`            | `id`, `tenant_id`, `type`, `name`, `weeks`, `target_date`, `status`, `version`                                                                                               |                                                                                            |
| `sessions`            | `id`, `tenant_id`, `program_id`, `week_no`, `day_no`, `date`, `class_id`, `title`, `published_at`, `notes`                                                                   | `index(tenant_id, date)`                                                                   |
| `blocks`              | `id`, `session_id`, `order`, `kind` (WARMUP/STRENGTH/METCON/ACCESSORY/COOLDOWN), `format`, `time_cap_s`, `rounds`, `description_i18n`                                        |                                                                                            |
| `block_movements`     | `id`, `block_id`, `movement_id`, `order`, `reps`, `distance_m`, `calories`, `load_kg`, `load_pct_1rm`, `load_ref_movement_id`                                                |                                                                                            |
| `variants`            | `id`, `block_id`, `level` (RX/SCALED/BEGINNER), `overrides jsonb`                                                                                                            | `unique(block_id, level)`                                                                  |
| `scores`              | `id`, `tenant_id`, `session_id`, `block_id`, `membership_id`, `level`, `value_num`, `unit`, `is_pr`, `verified_by`, `created_at`                                             | `unique(session_id, block_id, membership_id)`                                              |
| `personal_records`    | `id`, `user_id`, `movement_id`, `metric`, `value_num`, `unit`, `achieved_at`, `source_score_id`                                                                              | `index(user_id, movement_id, metric)`                                                      |
| `hyrox_events`        | `id`, `tenant_id`, `name`, `date`, `format`, `divisions[]`, `status`                                                                                                         |                                                                                            |
| `heats`               | `id`, `event_id`, `name`, `starts_at`, `capacity`, `interval_s`                                                                                                              |                                                                                            |
| `heat_entries`        | `id`, `heat_id`, `membership_id`, `bib`, `division`, `partner_entry_id`, `total_time_s`                                                                                      | `unique(heat_id, bib)`                                                                     |
| `splits`              | `id`, `heat_entry_id`, `segment`, `order`, `time_s`, `roxzone_s`                                                                                                             | `unique(heat_entry_id, order)`                                                             |
| `partnerships`        | `id`, `tenant_a_id`, `tenant_b_id`, `status`, `accepted_at`, `revoked_at`                                                                                                    | `unique(least(a,b), greatest(a,b))`                                                        |
| `partnership_rules`   | `id`, `partnership_id`, `direction`, `monthly_quota`, `visitor_price_cents`, `host_share_bps`, `origin_share_bps`, `platform_fee_bps`, `allowed_class_type_ids[]`            | somme des `*_bps` = 10000                                                                  |
| `settlements`         | `id`, `booking_id`, `gross_cents`, `host_cents`, `origin_cents`, `platform_cents`, `stripe_transfer_ids[]`, `status`                                                         |                                                                                            |
| `consents`            | `id`, `user_id`, `tenant_id`, `purpose`, `granted`, `policy_version`, `granted_at`, `revoked_at`, `ip`, `user_agent`                                                         | append-only                                                                                |
| `audit_logs`          | `id`, `tenant_id`, `actor_membership_id`, `action`, `target_type`, `target_id`, `diff jsonb`, `ip`, `created_at`                                                             | rétention 24 mois                                                                          |

### 7.4 API — conventions

- **REST + JSON**, versionnée par préfixe : `/api/v1/…`. (GraphQL écarté : en solo, le surcoût de tooling, de cache et de sécurité par champ n'est pas rentable. Une exception envisageable : un endpoint GraphQL en lecture seule pour le back-office si les écrans agrègent beaucoup — à décider en v1, pas maintenant.)
- **Résolution du tenant** : en-tête `X-Tenant-Id` (ou sous-domaine côté web), **toujours re-vérifiée** contre le JWT côté serveur. Un `tenant_id` fourni par le client n'accorde jamais de droit par lui-même.
- Auth : JWT court (15 min) + refresh token rotatif (30 j), révocable par appareil.
- Écritures sensibles : en-tête `Idempotency-Key` obligatoire (réservation, paiement, annulation).
- Pagination par curseur : `?cursor=…&limit=…`.
- Erreurs normalisées : `{ "error": { "code": "CLASS_FULL", "message_i18n": {...}, "details": {...} } }` — le client affiche selon le `code`, jamais selon le texte.
- Rate limiting : 100 req/min par utilisateur, 20/min sur les écritures financières.
- Temps réel : WebSocket / Realtime sur `class:{id}` (places, waitlist) et `event:{id}` (leaderboard live).

### 7.5 Endpoints essentiels

| Domaine           | Méthode & chemin                                  | Rôle min.   | Description                                                       |
| ----------------- | ------------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| **Auth**          | `POST /v1/auth/social`                            | public      | Échange un `id_token` Apple/Google contre une session             |
|                   | `POST /v1/auth/magic-link`                        | public      | Envoie un lien de connexion                                       |
|                   | `POST /v1/auth/refresh`                           | auth        | Rotation du refresh token                                         |
|                   | `POST /v1/auth/logout`                            | auth        | Révoque la session de l'appareil                                  |
|                   | `GET /v1/me`                                      | auth        | Profil + memberships + branding du tenant courant                 |
|                   | `DELETE /v1/me`                                   | auth        | Suppression RGPD (anonymisation différée 30 j)                    |
|                   | `GET /v1/me/export`                               | auth        | Export RGPD (JSON + CSV, lien signé)                              |
| **Tenants**       | `POST /v1/tenants`                                | auth        | Créer une box (l'appelant devient OWNER)                          |
|                   | `GET /v1/tenants/{slug}/public`                   | public      | Branding + infos publiques (avant login)                          |
|                   | `PATCH /v1/tenants/{id}`                          | OWNER       | Paramètres, règles, thème                                         |
|                   | `POST /v1/tenants/{id}/invitations`               | MANAGER     | Inviter un membre ou un staff                                     |
| **Planning**      | `GET /v1/classes?from=&to=&type=&coach=`          | MEMBER      | Planning (inclut les cours partenaires si `include_network=true`) |
|                   | `GET /v1/classes/{id}`                            | MEMBER      | Détail + WOD publié + places restantes                            |
|                   | `POST /v1/class-schedules`                        | MANAGER     | Créer une récurrence (RRULE)                                      |
|                   | `POST /v1/classes/{id}/cancel`                    | MANAGER     | Annuler un cours + notifier + rembourser                          |
| **Réservation**   | `POST /v1/classes/{id}/bookings`                  | MEMBER      | Réserver (idempotent, transactionnel)                             |
|                   | `DELETE /v1/bookings/{id}`                        | MEMBER      | Annuler (applique la fenêtre et les frais)                        |
|                   | `POST /v1/classes/{id}/waitlist`                  | MEMBER      | Rejoindre la liste d'attente                                      |
|                   | `POST /v1/waitlist/{id}/accept`                   | MEMBER      | Confirmer une promotion                                           |
|                   | `GET /v1/me/bookings?status=`                     | MEMBER      | Mes réservations                                                  |
| **Check-in**      | `GET /v1/me/qr`                                   | MEMBER      | Jeton QR à durée de vie 30 s                                      |
|                   | `POST /v1/checkins`                               | COACH/kiosk | Valider un scan                                                   |
|                   | `POST /v1/classes/{id}/checkins/manual`           | COACH       | Pointage manuel                                                   |
| **Paiement**      | `GET /v1/plans`                                   | MEMBER      | Catalogue de la box                                               |
|                   | `POST /v1/subscriptions`                          | MEMBER      | Souscrire (retourne un `client_secret` Stripe)                    |
|                   | `DELETE /v1/subscriptions/{id}`                   | MEMBER      | Résilier à échéance                                               |
|                   | `POST /v1/credit-packs/{id}/purchase`             | MEMBER      | Acheter un pack                                                   |
|                   | `GET /v1/me/wallet`                               | MEMBER      | Solde et expirations                                              |
|                   | `POST /v1/tenants/{id}/stripe/onboarding-link`    | OWNER       | Lien d'onboarding Connect                                         |
|                   | `POST /v1/webhooks/stripe`                        | signature   | Webhooks (source de vérité)                                       |
|                   | `POST /v1/payments/{id}/refund`                   | OWNER       | Rembourser                                                        |
| **Membres**       | `GET /v1/members?query=&status=`                  | MANAGER     | Recherche et filtres                                              |
|                   | `GET /v1/members/{id}`                            | MANAGER     | Fiche complète                                                    |
|                   | `POST /v1/members/{id}/credits`                   | OWNER       | Créditer/débiter manuellement                                     |
|                   | `POST /v1/members/{id}/suspend`                   | MANAGER     | Suspendre les droits                                              |
| **Programmes**    | `GET /v1/programs` · `POST /v1/programs`          | COACH       | Lister / créer                                                    |
|                   | `POST /v1/programs/{id}/duplicate`                | COACH       | Dupliquer (décalage de dates)                                     |
|                   | `GET /v1/sessions?date=`                          | MEMBER      | Séances publiées du jour                                          |
|                   | `POST /v1/sessions/{id}/publish`                  | COACH       | Publier (immédiat ou planifié)                                    |
|                   | `POST /v1/sessions/{id}/scores`                   | MEMBER      | Enregistrer un score                                              |
|                   | `GET /v1/sessions/{id}/leaderboard?level=RX`      | MEMBER      | Classement                                                        |
|                   | `GET /v1/movements?q=&locale=`                    | COACH       | Bibliothèque de mouvements                                        |
|                   | `GET /v1/me/records`                              | MEMBER      | Mes PR                                                            |
| **Hyrox**         | `POST /v1/hyrox/events`                           | MANAGER     | Créer un événement                                                |
|                   | `POST /v1/hyrox/events/{id}/heats/generate`       | MANAGER     | Générer les heats                                                 |
|                   | `POST /v1/hyrox/entries/{id}/splits`              | MEMBER      | Enregistrer des splits                                            |
|                   | `GET /v1/hyrox/events/{id}/leaderboard?division=` | MEMBER      | Classement par division                                           |
|                   | `GET /v1/me/hyrox/projection`                     | MEMBER      | Temps projeté + station faible                                    |
| **Réseau**        | `POST /v1/partnerships`                           | OWNER       | Demander un partenariat                                           |
|                   | `POST /v1/partnerships/{id}/accept`               | OWNER       | Accepter                                                          |
|                   | `PATCH /v1/partnerships/{id}/rules`               | OWNER       | Quotas, tarifs, commissions                                       |
|                   | `GET /v1/network/classes?from=&to=`               | MEMBER      | Cours partenaires réservables                                     |
|                   | `GET /v1/network/report?period=`                  | OWNER       | Reporting consolidé                                               |
| **Reporting**     | `GET /v1/reports/attendance?from=&to=`            | MANAGER     | Assiduité et remplissage                                          |
|                   | `GET /v1/reports/revenue?period=`                 | OWNER       | CA, impayés, commissions                                          |
|                   | `GET /v1/reports/export?type=&format=csv`         | OWNER       | Export comptable                                                  |
| **Notifications** | `POST /v1/devices`                                | MEMBER      | Enregistrer un token push                                         |
|                   | `POST /v1/notifications/broadcast`                | MANAGER     | Envoi ciblé                                                       |

### 7.6 Exemples JSON

#### (a) Authentification — `POST /v1/auth/social`

**Requête**

```json
{
  "provider": "apple",
  "id_token": "eyJraWQiOiJXNldjT0tCIiwiYWxnIjoiUlMyNTYifQ...",
  "invite_token": "inv_7Kd93JsQ",
  "locale": "fr-FR",
  "device": {
    "platform": "ios",
    "os_version": "19.2",
    "app_version": "1.0.3",
    "push_token": "c3f0a1b2d4e5f6..."
  }
}
```

**Réponse `200 OK`**

```json
{
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 900,
    "refresh_token": "rt_9f83bc41e2a7...",
    "refresh_expires_in": 2592000
  },
  "user": {
    "id": "0192f3a1-7c4e-7b2a-9e11-4c8d2f0a1b33",
    "email": "lea.m@example.com",
    "first_name": "Léa",
    "last_name": "Martin",
    "locale": "fr-FR",
    "avatar_url": null,
    "onboarding_completed": false
  },
  "memberships": [
    {
      "id": "0192f3a1-8b10-7c33-a001-9de4f1220ab5",
      "tenant_id": "0192f0aa-1111-7000-8000-000000000001",
      "role": "MEMBER",
      "status": "ACTIVE",
      "joined_at": "2026-08-30T09:12:44Z"
    }
  ],
  "current_tenant": {
    "id": "0192f0aa-1111-7000-8000-000000000001",
    "slug": "crossfit-rueil",
    "name": "CrossFit Rueil",
    "timezone": "Europe/Paris",
    "currency": "EUR",
    "theme": {
      "app_name": "CF Rueil",
      "logo_url": "https://cdn.rig.app/t/crossfit-rueil/logo@3x.png",
      "primary": "#E4572E",
      "on_primary": "#FFFFFF",
      "surface": "#0F1115",
      "radius": 16,
      "font": "Inter"
    },
    "booking_rules": {
      "open_days_before": 7,
      "close_minutes_before": 15,
      "cancel_window_minutes": 240,
      "max_upcoming_bookings": 3
    }
  },
  "required_actions": ["ACCEPT_CONSENTS", "COMPLETE_PROFILE"]
}
```

**Erreur `409 Conflict`**

```json
{
  "error": {
    "code": "EMAIL_ALREADY_LINKED_TO_OTHER_PROVIDER",
    "message_i18n": {
      "fr": "Cet e-mail est déjà associé à une connexion Google. Utilise Google pour te connecter.",
      "en": "This email is already linked to a Google sign-in. Please continue with Google."
    },
    "details": { "existing_provider": "google" }
  }
}
```

#### (b) Réservation — `POST /v1/classes/{id}/bookings`

**Requête** (en-têtes : `Authorization: Bearer …`, `X-Tenant-Id: …`, `Idempotency-Key: bk_2026-08-30_lea_18h30_a1`)

```json
{
  "payment_source": "AUTO",
  "accept_late_cancel_policy": true,
  "add_to_calendar": true
}
```

**Réponse `201 Created`** — place obtenue

```json
{
  "booking": {
    "id": "0192f4b2-2c31-7a44-9f10-77ab31c90de2",
    "status": "CONFIRMED",
    "class_id": "0192f4a0-0d21-7c00-8f00-1a2b3c4d5e6f",
    "membership_id": "0192f3a1-8b10-7c33-a001-9de4f1220ab5",
    "booked_at": "2026-08-30T20:14:02Z",
    "cancel_deadline_at": "2026-08-31T14:30:00Z",
    "is_visitor": false,
    "payment": {
      "source": "CREDIT_PACK",
      "credits_debited": 1,
      "wallet_balance_after": 6,
      "credit_transaction_id": "0192f4b2-2c99-7000-b000-0a1b2c3d4e5f"
    }
  },
  "class": {
    "id": "0192f4a0-0d21-7c00-8f00-1a2b3c4d5e6f",
    "title": "WOD",
    "starts_at": "2026-08-31T16:30:00Z",
    "local_start": "2026-08-31T18:30:00+02:00",
    "coach": { "name": "Sarah D.", "avatar_url": "https://cdn.rig.app/u/sarah.jpg" },
    "room": "Salle principale",
    "capacity": 16,
    "spots_left": 0,
    "waitlist_length": 2,
    "session_id": "0192f4c0-1a2b-7d00-9000-abcdef012345"
  },
  "calendar": {
    "ics_url": "https://api.rig.app/v1/bookings/0192f4b2.../calendar.ics"
  }
}
```

**Réponse `409 Conflict`** — cours complet (contrat : le client bascule sur la waitlist)

```json
{
  "error": {
    "code": "CLASS_FULL",
    "message_i18n": {
      "fr": "Ce cours est complet. Tu peux rejoindre la liste d'attente.",
      "en": "This class is full. You can join the waitlist."
    },
    "details": {
      "waitlist_available": true,
      "waitlist_length": 3,
      "estimated_promotion_probability": 0.62
    }
  }
}
```

**Réponse `402 Payment Required`** — droits insuffisants

```json
{
  "error": {
    "code": "NO_VALID_ENTITLEMENT",
    "message_i18n": {
      "fr": "Il te faut un abonnement actif ou des crédits pour réserver.",
      "en": "You need an active plan or credits to book."
    },
    "details": {
      "wallet_balance": 0,
      "subscription_status": "PAST_DUE",
      "suggested_plan_ids": ["0192f0bb-2222-7000-8000-000000000010"]
    }
  }
}
```

#### (c) Programme / séance publiée — `GET /v1/sessions/{id}?level=RX`

```json
{
  "session": {
    "id": "0192f4c0-1a2b-7d00-9000-abcdef012345",
    "program": { "id": "0192f4bb-...", "name": "Cycle Force Automne", "week_no": 3, "day_no": 2 },
    "date": "2026-08-31",
    "title_i18n": { "fr": "Force + Metcon", "en": "Strength + Metcon" },
    "published_at": "2026-08-30T16:00:00Z",
    "class_ids": ["0192f4a0-0d21-7c00-8f00-1a2b3c4d5e6f"],
    "selected_level": "RX",
    "available_levels": ["RX", "SCALED", "BEGINNER"],
    "blocks": [
      {
        "id": "blk_01",
        "order": 1,
        "kind": "WARMUP",
        "format": "FREE",
        "description_i18n": {
          "fr": "3 tours : 200 m row, 10 air squats, 10 PVC pass-through",
          "en": "3 rounds: 200 m row, 10 air squats, 10 PVC pass-throughs"
        }
      },
      {
        "id": "blk_02",
        "order": 2,
        "kind": "STRENGTH",
        "format": "STRENGTH",
        "rounds": 5,
        "movements": [
          {
            "movement_id": "mv_back_squat",
            "name_i18n": { "fr": "Back Squat", "en": "Back Squat" },
            "reps": 3,
            "load_pct_1rm": 80,
            "load_ref_movement_id": "mv_back_squat",
            "resolved_load": {
              "value_kg": 72,
              "basis": "1RM 90 kg (2026-06-14)",
              "is_estimated": false
            },
            "video_url": "https://cdn.rig.app/mv/back-squat.mp4"
          }
        ],
        "rest_s": 120
      },
      {
        "id": "blk_03",
        "order": 3,
        "kind": "METCON",
        "format": "FOR_TIME",
        "time_cap_s": 600,
        "scheme": "21-15-9",
        "score_definition": { "metric": "TIME", "unit": "s", "lower_is_better": true },
        "movements": [
          {
            "movement_id": "mv_thruster",
            "name_i18n": { "fr": "Thruster", "en": "Thruster" },
            "load_kg": 43,
            "rx_load_by_gender": { "male": 43, "female": 30 }
          },
          { "movement_id": "mv_pull_up", "name_i18n": { "fr": "Tractions", "en": "Pull-ups" } }
        ],
        "variants": {
          "SCALED": {
            "load_kg": 30,
            "substitutions": [
              {
                "from": "mv_pull_up",
                "to": "mv_ring_row",
                "note_i18n": { "fr": "Ring row", "en": "Ring row" }
              }
            ]
          },
          "BEGINNER": {
            "scheme": "15-12-9",
            "load_kg": 20,
            "substitutions": [{ "from": "mv_pull_up", "to": "mv_banded_pull_up" }]
          }
        },
        "benchmark": { "id": "bm_fran", "name": "Fran" },
        "my_best": { "value_num": 462, "unit": "s", "level": "RX", "achieved_at": "2026-05-11" }
      }
    ],
    "coach_notes_public_i18n": {
      "fr": "Objectif : rester en séries non brisées sur les 21 premiers thrusters.",
      "en": "Goal: keep the first 21 thrusters unbroken."
    },
    "my_score": null,
    "leaderboard_preview": [
      { "rank": 1, "display_name": "Thomas B.", "value_num": 198, "unit": "s", "level": "RX" },
      { "rank": 2, "display_name": "Julie K.", "value_num": 224, "unit": "s", "level": "RX" }
    ]
  }
}
```

---

## 8. Intégrations tierces recommandées

| Domaine                             | Recommandation                                                                       | Alternatives                               | Pourquoi / points d'attention                                                                                                                                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Paiement**                        | **Stripe + Stripe Connect Express**                                                  | Mollie, Adyen, GoCardless (SEPA)           | Connect Express fait l'onboarding, le KYC et les paiements de la box à votre place. Vous ne détenez jamais les fonds → pas d'agrément DSP2. Coût : ~1,4 % + 0,25 € (cartes EU) + frais Connect. Prévoir **GoCardless ou Stripe SEPA Debit en v1** : le prélèvement reste dominant dans les salles françaises. |
| **Facturation SaaS (votre revenu)** | Stripe Billing, compte séparé du flux Connect                                        | Paddle (MoR, gère la TVA UE à votre place) | Paddle coûte plus cher mais supprime le casse-tête de la TVA intracommunautaire — pertinent en solo si vous vendez hors France.                                                                                                                                                                               |
| **Auth / SSO**                      | **Apple Sign-In (obligatoire) + Google + magic link**                                | Auth0, Clerk                               | Ne codez pas l'auth vous-même. Si Supabase Auth : gratuit et suffisant. Attention : Apple exige Sign in with Apple dès qu'un autre SSO est présent.                                                                                                                                                           |
| **Push**                            | **Expo Push** (proxifie APNs + FCM) au MVP → **FCM + APNs directs** en v1            | OneSignal, Firebase Messaging              | Expo Push économise plusieurs jours de setup. OneSignal apporte segmentation et A/B testing mais héberge hors UE (à documenter au RGPD).                                                                                                                                                                      |
| **E-mail transactionnel**           | **Resend** ou **Postmark**                                                           | SendGrid, Mailgun, Brevo (FR, EU)          | Postmark = meilleure délivrabilité transactionnelle. **Brevo** est français et hébergé en UE : argument RGPD utile face aux boxes. Séparez impérativement les domaines transactionnel et marketing.                                                                                                           |
| **SMS**                             | Twilio ou Brevo                                                                      | OVH SMS                                    | Réservez le SMS aux cas critiques (promotion waitlist J-0) : c'est cher et intrusif.                                                                                                                                                                                                                          |
| **Calendrier**                      | Export **.ics** signé + Google Calendar API (v1)                                     | CalDAV Apple                               | Le .ics couvre 90 % du besoin pour 5 % de l'effort. La synchro bidirectionnelle Google est un piège à bugs — ne la faites qu'en pull.                                                                                                                                                                         |
| **Analytics produit**               | **PostHog Cloud EU**                                                                 | Mixpanel, Amplitude                        | PostHog EU : hébergement européen, session replay et feature flags inclus, gratuit jusqu'à ~1 M d'événements. Mixpanel/Amplitude sont excellents mais US → complexité RGPD (TIA, clauses contractuelles types). En solo, PostHog EU est le meilleur rapport conformité/effort.                                |
| **Erreurs & performance**           | **Sentry** (mobile + backend)                                                        | Bugsnag, Datadog                           | Indispensable en solo : Sentry est votre équipe de QA. Activer le scrubbing des PII.                                                                                                                                                                                                                          |
| **Logs & monitoring**               | Better Stack ou Axiom                                                                | Grafana Cloud, Datadog                     | Prévoir une alerte SMS sur : webhook Stripe en échec, taux d'erreur 5xx > 1 %, job de promotion waitlist bloqué.                                                                                                                                                                                              |
| **Stockage média**                  | S3 / Cloudflare R2 + CDN, **région UE**                                              | Supabase Storage                           | R2 : pas de frais de sortie. Photos de profil, logos, vidéos de mouvements.                                                                                                                                                                                                                                   |
| **Géolocalisation**                 | Google Places (autocomplétion d'adresse) + calcul de distance côté serveur (PostGIS) | Mapbox, Adresse.data.gouv.fr (gratuit, FR) | Pour « boxes partenaires autour de moi ». L'API Adresse française est gratuite et suffisante pour la France.                                                                                                                                                                                                  |
| **CRM / marketing**                 | Brevo ou Customer.io                                                                 | HubSpot, Mailchimp                         | Uniquement en v1. Au MVP, un tableur et des e-mails écrits à la main suffisent — et vous apprendrez plus.                                                                                                                                                                                                     |
| **Comptabilité**                    | **Export CSV** au MVP → Pennylane / Qonto en v1                                      | Sage, Cegid                                | Ne construisez jamais de comptabilité. Sortez des données propres et laissez l'expert-comptable faire son métier.                                                                                                                                                                                             |
| **Documents & signature**           | Yousign (FR) en v2                                                                   | DocuSign                                   | Pour les contrats d'abonnement signés électroniquement.                                                                                                                                                                                                                                                       |
| **Support client**                  | Crisp (français, abordable)                                                          | Intercom, Zendesk                          | Crisp : widget web + mobile, très bon rapport qualité/prix pour un solo.                                                                                                                                                                                                                                      |
| **Traduction**                      | fichiers JSON versionnés + DeepL API pour les brouillons                             | Lokalise, Crowdin                          | En solo, deux fichiers `fr.json` / `en.json` suffisent jusqu'à la 3ᵉ langue.                                                                                                                                                                                                                                  |
| **Réservation de salles/matériel**  | Interne (`rooms`, `equipment`)                                                       | —                                          | Pas d'intégration tierce : le besoin est trop spécifique et trop simple pour justifier une dépendance.                                                                                                                                                                                                        |

**Règle de survie en solo :** chaque intégration ajoute une dépendance, un compte, un webhook, une facture et un point de panne. **Au MVP : Stripe, Auth, Push, E-mail, Sentry. Cinq. Pas six.** Tout le reste attend la v1.

---

## 9. Spécificités Hyrox vs CrossFit

Les deux disciplines partagent l'infrastructure (planning, réservation, paiement, membres) mais divergent totalement sur le **modèle de la performance**. C'est le point que les logiciels existants ratent : ils appliquent le modèle CrossFit au Hyrox, ce qui ne marche pas.

| Dimension                | CrossFit                                                 | Hyrox                                                                           |
| ------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Unité de programmation   | Le **WOD du jour**, varié à l'infini, dans un cycle      | Le **format fixe** : 8 stations + 8 runs de 1 km, invariable                    |
| Variabilité              | Maximale, c'est le principe même                         | Nulle : la compétition est standardisée mondialement                            |
| Mesure de la performance | Temps / reps / charge sur une infinité de mouvements     | Temps total + **splits par station** + **roxzone**                              |
| Comparabilité            | Difficile hors benchmarks nommés                         | Directe et universelle : votre SkiErg vaut celui de Berlin                      |
| Scaling                  | Rx / Scaled / Beginner sur les charges et les mouvements | Divisions officielles : Open / Pro, H/F, Simple / Double / Relais               |
| Structure d'entraînement | Cycles de force + metcons variés                         | Périodisation vers une **date de course** : Base → Build → Peak → Taper         |
| Compétence critique      | Technique (haltéro, gymnastique)                         | Endurance sous fatigue (_compromised running_) et gestion d'allure              |
| Événement                | Throwdown interne, Open CrossFit                         | Course officielle + simulations en salle, avec heats et dossards                |
| Données à modéliser      | `movements`, `blocks`, `variants`, `benchmarks`, `PR`    | `stations`, `splits`, `roxzone`, `divisions`, `heats`, `pairings`, `projection` |

### 9.1 Ce que le module CrossFit doit couvrir (MVP)

1. **WOD récurrent et cycles** — programme → semaines → séances → blocs, duplication, versionnement, publication planifiée.
2. **Formats normalisés** : `FOR_TIME`, `AMRAP`, `EMOM`, `TABATA`, `INTERVAL`, `STRENGTH`, `CHIPPER`, `LADDER`, `DEATH_BY` — chacun avec sa définition de score (temps, reps, rounds+reps, charge).
3. **Rx / Scaled / Beginner** : substitutions de mouvements et de charges par variante, avec des règles par défaut dans la bibliothèque (pull-up → ring row → banded pull-up).
4. **Charges en % de 1RM** résolues par membre depuis ses PR ; arrondi configurable au disque disponible (2,5 kg par défaut).
5. **Benchmarks nommés** : les Girls (Fran, Grace, Helen, Diane…), les Heroes (Murph, DT, Chad…), les Open workouts, les 1RM. Suivi historique et écart au meilleur.
6. **Notes de coach** par membre, privées, avec suggestions de scaling contextuelles (blessure déclarée, niveau, historique).
7. **Cycles de programmation** avec vue macro : volume hebdo par filière (haltéro / gymnastique / monostructural), pour éviter les déséquilibres.
8. **Leaderboard** par WOD et par période, segmenté Rx/Scaled, sexe et catégorie d'âge, avec option d'anonymat.

### 9.2 Ce que le module Hyrox doit couvrir (v1)

1. **Référentiel des 8 stations** (système, non modifiable) avec charges par division :

| #   | Station           | Distance / volume | Charge Open H | Charge Open F | Pro H   | Pro F   |
| --- | ----------------- | ----------------- | ------------- | ------------- | ------- | ------- |
| 1   | SkiErg            | 1000 m            | —             | —             | —       | —       |
| 2   | Sled Push         | 50 m              | 152 kg        | 102 kg        | 202 kg  | 152 kg  |
| 3   | Sled Pull         | 50 m              | 103 kg        | 78 kg         | 153 kg  | 103 kg  |
| 4   | Burpee Broad Jump | 80 m              | —             | —             | —       | —       |
| 5   | Rowing            | 1000 m            | —             | —             | —       | —       |
| 6   | Farmers Carry     | 200 m             | 2×24 kg       | 2×16 kg       | 2×32 kg | 2×24 kg |
| 7   | Sandbag Lunges    | 100 m             | 20 kg         | 10 kg         | 30 kg   | 20 kg   |
| 8   | Wall Balls        | 100 / 75 reps     | 6 kg          | 4 kg          | 9 kg    | 6 kg    |

> ⚠️ Ces valeurs (traîneaux inclus/hors chariot, hauteurs de cible, volumes Pro) **évoluent selon les saisons et les divisions** et doivent être vérifiées sur les règlements officiels en vigueur avant implémentation. À stocker en base comme un référentiel versionné (`ruleset_version`), jamais en dur dans le code.

2. **Chronométrage et splits** : temps par run, par station, et **roxzone** (transition) — la roxzone est la métrique que personne ne mesure et où tout le monde perd 4 à 8 minutes.
3. **Projection de temps** : à partir des splits d'entraînement, estimation du temps total sur course complète, avec intervalle de confiance et identification de la station la plus coûteuse.
4. **Heat scheduling** : génération de heats (capacité, intervalle de départ), attribution de dossards, contrôle des chevauchements, export des listes de départ.
5. **Pairings** : Simple / Double / Relais. En Double, les équipiers alternent — le modèle de données doit porter le temps au niveau de l'équipe et non de l'individu.
6. **Leaderboard segmenté** par division ET format, avec vue par station (« qui est le meilleur au sled pull de la box »).
7. **PR par station** et par segment de run, distincts des PR CrossFit.
8. **Programmes de préparation périodisés** : Base (volume aérobie + technique station) → Build (compromised running, intervalles) → Peak (simulations partielles et complètes) → Taper (7–10 j).
9. **Événement payant** : la simulation Hyrox interne est un produit vendable par la box (25–45 € par participant) — donc rattachée à un `plan` de type événement, avec billetterie, dossards et résultats.

### 9.3 Le socle commun

Réservation, capacité, waitlist, check-in, paiement, membres, notifications, leaderboard générique, PR, notes de coach, i18n, white-label. **Une seule fois, pour les deux.** Ce qui diverge est encapsulé dans le type de `program` et le type de `block` — pas dans deux applications parallèles.

---

## 10. Fonctionnalités « Hustle-like » à reproduire

| Fonctionnalité                    | Périmètre attendu                                                                                            | Prio | Difficulté | Piège à éviter                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ | :--: | :--------: | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Réservation temps réel**        | Places restantes à jour sans rafraîchir, via WebSocket/Realtime, avec fallback polling 30 s                  |  P0  |    ●●●○    | Faire confiance au client. Le décompte fait autorité **uniquement** en base, dans une transaction.                                      |
| **Liste d'attente**               | FIFO, position visible, promotion auto, fenêtre de confirmation, notification                                |  P0  |    ●●●○    | Promouvoir quelqu'un qui ne verra pas la notif avant le cours → prévoir la promotion en cascade automatique.                            |
| **Passes / crédits**              | Achat de packs, décompte à la réservation, remboursement à l'annulation dans les délais, expiration, alertes |  P0  |    ●●●●    | Les arrondis et les cas limites (annulation après expiration du pack). Tenir un **ledger append-only** dès le début.                    |
| **Abonnements**                   | Mensuel/annuel, engagement, pause, résiliation self-service, dunning                                         |  P0  |    ●●●●    | La pause d'abonnement est réclamée en été. Le modéliser dès le départ évite une refonte.                                                |
| **Frais d'annulation / no-show**  | Configurable : gratuit, crédit perdu, ou montant facturé. Fenêtre paramétrable, exceptions manuelles         |  P1  |    ●●●○    | Facturer automatiquement sans confirmation explicite = litiges et désabonnements. Prévoir toujours une annulation manuelle par l'Owner. |
| **Check-in QR**                   | QR dynamique côté membre, mode kiosque, mode coach, hors ligne, drop-in au scan                              |  P0  |    ●●○○    | Le QR statique se partage en capture d'écran. Jeton court obligatoire.                                                                  |
| **Marketplace / co-op multi-box** | Planning partagé, réservation croisée, quotas, tarif visiteur, révocation                                    |  P1  |    ●●●●    | Le RGPD (partage de données entre responsables de traitement distincts) et l'équité de la répartition financière.                       |
| **Reporting financier par box**   | Encaissements, impayés, remboursements, commissions, MRR, export comptable                                   |  P0  |    ●●●○    | Que le chiffre de l'app diffère du relevé Stripe. Rapprochement automatique à prévoir.                                                  |
| **Partage de revenus**            | Répartition automatique hôte / origine / plateforme via Stripe transfers, traçable des deux côtés            |  P1  |    ●●●●    | Les remboursements après répartition : prévoir des contre-écritures (`reversal`) dès la conception.                                     |
| **Notifications intelligentes**   | Rappels, promotions waitlist, WOD publié, PR, relances de paiement, campagnes ciblées                        |  P0  |    ●●○○    | Le sur-envoi. Quiet hours + plafond hebdomadaire + granularité de désabonnement.                                                        |
| **Profil et historique membre**   | Présences, scores, PR, paiements, badges                                                                     |  P0  |    ●●○○    | Mélanger données de box et données personnelles : les PR suivent la personne entre les boxes, les paiements non.                        |
| **Communauté légère**             | Kudos et commentaires sur les scores, classements amicaux                                                    |  P2  |    ●●○○    | Toute fonction sociale = modération. Ne l'ouvrez qu'avec un bouton « signaler » (exigence Apple sur l'UGC).                             |

**Ce qu'il faut faire mieux que Hustle et les autres, sinon il n'y a pas de raison de changer d'outil :**

1. **La programmation** : un vrai builder de cycles, pas un champ texte. C'est là que se joue l'adhésion du coach, qui est le prescripteur interne.
2. **Le Hyrox** : le seul outil qui modélise les stations, la roxzone et les heats nativement.
3. **La vitesse de réservation** : 2 taps, chargement < 1 s, fonctionnement hors ligne en lecture.
4. **Le français** : interface, support, factures, TVA, conditions — et un interlocuteur qui répond dans la journée.

---

## 11. Multi-tenancy et coopération entre boxes

### 11.1 Choix d'architecture de tenancy

| Modèle                            | Description                                                     | Isolation                      | Coût & ops                                        | Verdict solo                                             |
| --------------------------------- | --------------------------------------------------------------- | ------------------------------ | ------------------------------------------------- | -------------------------------------------------------- |
| **Shared DB + `tenant_id` + RLS** | Un schéma, une colonne `tenant_id`, Row Level Security Postgres | Bonne si la RLS est rigoureuse | Très faible                                       | ✅ **Retenu**                                            |
| Schéma par tenant                 | Un schéma Postgres par box                                      | Très bonne                     | Migrations × N schémas, douloureux dès 50 tenants | ❌                                                       |
| Base par tenant                   | Une base par box                                                | Excellente                     | Ingérable seule ; réservé à l'entreprise          | ❌ (sauf demande contractuelle d'un grand compte, en v2) |

**Décision : shared DB + RLS**, avec ces garde-fous non négociables :

- `tenant_id` sur **toutes** les tables métier, `NOT NULL`, avec index en tête de clé composite.
- **RLS activée par défaut sur toutes les tables** (`FORCE ROW LEVEL SECURITY`), policies basées sur `current_setting('app.tenant_id')` et le rôle porté par le JWT.
- Un **test automatisé de fuite inter-tenant** dans la CI : pour chaque table, une requête depuis le tenant A ne doit jamais retourner une ligne du tenant B. Ce test échoue = build rouge, sans exception.
- Le rôle applicatif Postgres n'est **jamais** superuser et ne peut pas contourner la RLS.
- Les jobs de fond (promotion waitlist, webhooks) fixent explicitement le tenant de contexte avant toute requête.
- Sauvegardes : PITR global + capacité d'export par tenant (pour la réversibilité contractuelle et le RGPD).

### 11.2 Niveaux de white-label

| Niveau                       | Contenu                                                                                                               | Effort                                       | Tarif indicatif                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------- |
| **N0 — Co-brandé** (MVP)     | Logo, couleur primaire, nom de la box dans l'app RIG ; sous-domaine web `box.rig.app`                                 | Inclus                                       | Inclus                                   |
| **N1 — Marque étendue** (v1) | + domaine personnalisé (`app.crossfitrueil.fr`), e-mails et factures aux couleurs de la box, écran de démarrage dédié | 3 j·h de setup, ~0 récurrent                 | +29 €/mois                               |
| **N2 — App dédiée** (v2)     | Binaire iOS/Android publié sous le compte développeur **de la box**, icône et nom propres, fiches store               | 2 j·h par box + maintenance à chaque release | +99 à 199 €/mois, **engagement 12 mois** |

> ⚠️ **Avertissement N2.** Chaque app dédiée démultiplie vos publications, vos revues Apple, vos incidents et vos rollbacks. Avec 20 apps dédiées et une seule développeuse, une mise à jour urgente devient une journée entière. Ne vendez le N2 qu'à partir de 30 clients, avec un pipeline de build automatisé (EAS Build + soumission automatique) et un engagement annuel.

### 11.3 Modèle de coopération inter-box

**Trois niveaux de coopération, activables indépendamment :**

| Niveau              | Ce qui est partagé                                                        | Flux financier                                |
| ------------------- | ------------------------------------------------------------------------- | --------------------------------------------- |
| **A — Visibilité**  | Le planning de la box partenaire est visible dans l'app, sans réservation | Aucun                                         |
| **B — Réciprocité** | Les membres peuvent réserver chez le partenaire dans la limite d'un quota | Compensation forfaitaire mensuelle ou aucune  |
| **C — Marketplace** | Drop-in payant, événements ouverts, programmes vendus                     | Répartition automatique par transferts Stripe |

**Règles métier du réseau**

| #   | Règle                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Le partenariat est **bilatéral et explicitement accepté** ; chaque direction a ses propres règles (A peut ouvrir 3 places à B sans que B en ouvre à A).                                                                            |
| R2  | La box hôte contrôle : types de cours éligibles, nombre de places visiteurs par cours, plages horaires, tarif.                                                                                                                     |
| R3  | Le quota de visite est mensuel, par membre, glissant, avec dépassement possible au tarif drop-in plein.                                                                                                                            |
| R4  | **Minimisation des données** : la box hôte reçoit prénom + initiale + box d'origine + photo si consentie. Rien d'autre. Formalisé dans un accord de partage entre responsables conjoints (art. 26 RGPD), fourni en modèle par RIG. |
| R5  | Répartition par défaut 80 / 15 / 5 (hôte / origine / plateforme), paramétrable, somme obligatoirement = 100 %.                                                                                                                     |
| R6  | Toute réservation cross-box génère une écriture dans les ledgers des **deux** boxes, avec le même identifiant de règlement.                                                                                                        |
| R7  | Révocation à effet immédiat sur les réservations futures non payées ; les réservations payées sont honorées.                                                                                                                       |
| R8  | Un membre suspendu, en impayé ou banni chez lui ne peut pas réserver chez un partenaire.                                                                                                                                           |
| R9  | Reporting consolidé mensuel : visiteurs reçus/envoyés, revenus bruts, part reversée, solde net, par partenaire.                                                                                                                    |
| R10 | Anti-cannibalisation : une box peut exclure des créneaux (ex. les heures de pointe) et plafonner le nombre total de visiteurs par semaine.                                                                                         |

**Schéma des flux financiers (drop-in visiteur à 20 €)**

```
Membre de A réserve chez B (20 €)
        │
        ▼
Stripe PaymentIntent sur le compte connecté de B  (destination charge)
        │
        ├─► 16,00 €  reste chez B         (host_share_bps = 8000)
        ├─►  3,00 €  transfert vers A     (origin_share_bps = 1500)
        └─►  1,00 €  application_fee RIG  (platform_fee_bps = 500)
        │
        ▼
3 écritures ledger : B (+16), A (+3), RIG (+1) — même settlement_id
Remboursement éventuel → 3 contre-écritures + reversals Stripe
```

**Reporting consolidé — colonnes minimales**

| Période | Partenaire | Visiteurs reçus | Revenu brut reçu | Part reversée | Visiteurs envoyés | Revenu reçu en origine | Solde net |
| ------- | ---------- | --------------- | ---------------- | ------------- | ----------------- | ---------------------- | --------- |

---

## 12. UI/UX — principes, microcopy et accessibilité

### 12.1 Principes directeurs

| #   | Principe                                         | Traduction concrète                                                                                                                                                        |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **La réservation en 2 taps**                     | L'accueil affiche le prochain cours réservable avec un bouton unique. Tap 1 : le cours. Tap 2 : réserver. Aucun écran intermédiaire, aucune confirmation modale superflue. |
| 2   | **Une seule action primaire par écran**          | Un bouton plein par écran, le reste en secondaire ou en texte. Si vous hésitez entre deux actions primaires, l'écran a un problème.                                        |
| 3   | **Optimiste, mais honnête**                      | L'UI répond instantanément (optimistic update) puis se corrige si le serveur refuse, avec un message clair. Jamais de spinner bloquant sur une réservation.                |
| 4   | **Le pouce d'abord**                             | Actions primaires dans les 40 % inférieurs de l'écran. La box se consulte dans les transports, debout, à une main.                                                         |
| 5   | **Lisible à bout de bras et en sueur**           | Corps de texte 16 px minimum, chiffres de score 32 px+, contraste élevé. L'écran est consulté entre deux séries.                                                           |
| 6   | **Mobile pour les membres, web pour la gestion** | On ne construit pas un planning hebdomadaire au doigt. Le back-office est web-first et responsive en consultation seulement.                                               |
| 7   | **Zéro état vide muet**                          | Chaque état vide explique quoi faire et propose l'action. « Aucune réservation » → « Ton prochain WOD t'attend → Voir le planning ».                                       |
| 8   | **Le mode hors ligne en lecture**                | Planning, WOD du jour et carte de membre disponibles hors ligne (cache local). Le réseau est mauvais dans les sous-sols de box.                                            |
| 9   | **Le thème sombre par défaut sur mobile**        | Standard de fait dans le fitness, et plus lisible en salle sombre. Les deux thèmes doivent respecter les couleurs de la box.                                               |
| 10  | **Aucune couleur en dur**                        | Tout passe par des design tokens alimentés par le thème du tenant. C'est ce qui rend le white-label possible.                                                              |

### 12.2 Système de design (à poser avant le premier écran)

- **Tokens** : `color.primary`, `color.on-primary`, `color.surface`, `color.surface-2`, `color.text`, `color.text-muted`, `color.success`, `color.warning`, `color.danger`, `radius.sm/md/lg`, `space.1→8` (échelle 4 px), `font.display/body/mono`.
- **Typographie** : une seule famille variable (Inter ou équivalent système). 5 tailles maximum : 12 / 14 / 16 / 20 / 32.
- **Composants du kit minimal (≈ 22)** : Button, IconButton, Card, ListRow, Avatar, Badge/Chip, Tabs, SegmentedControl, DatePicker, TimeSlot, Sheet/Modal, Toast, Banner, Input, Select, Stepper, Switch, EmptyState, Skeleton, ProgressRing, ScoreInput, QRCard. **Rien d'autre au MVP.**
- Sur le web, une base de composants existante (shadcn/ui, Radix) évite de recoder l'accessibilité des menus, dialogues et combobox. En solo, ne recodez jamais un `<Select>` accessible.

### 12.3 Microcopy FR / EN

Ton : tutoiement en FR côté membre (norme du milieu, les boxes se tutoient), vouvoiement côté back-office professionnel. Direct, court, jamais de jargon technique, jamais de point d'exclamation en double.

| Contexte                    | FR                                                                                          | EN                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| CTA réserver                | `Réserver`                                                                                  | `Book`                                                                        |
| Cours complet               | `Complet — 3 en liste d'attente`                                                            | `Full — 3 on the waitlist`                                                    |
| Rejoindre la waitlist       | `Rejoindre la liste d'attente`                                                              | `Join the waitlist`                                                           |
| Position waitlist           | `Tu es 2ᵉ sur la liste. On te prévient dès qu'une place se libère.`                         | `You're #2 on the waitlist. We'll ping you as soon as a spot opens.`          |
| Promotion waitlist (push)   | `Une place s'est libérée pour le WOD de 18h30 🎉 Tu as 60 min pour confirmer.`              | `A spot just opened for the 6:30 PM WOD 🎉 You have 60 min to confirm.`       |
| Confirmation de réservation | `C'est réservé. Rendez-vous mardi à 18h30.`                                                 | `You're in. See you Tuesday at 6:30 PM.`                                      |
| Annulation dans les délais  | `Réservation annulée, ton crédit est retourné dans ton solde.`                              | `Booking cancelled — your credit is back in your balance.`                    |
| Annulation hors délai       | `Il reste moins de 4 h avant le cours : ton crédit sera consommé. Confirmer l'annulation ?` | `Less than 4 hours to go: this will use up your credit. Cancel anyway?`       |
| Pas de droits               | `Il te faut une formule active pour réserver.` + `Voir les formules`                        | `You need an active plan to book.` + `See plans`                              |
| Crédits bientôt expirés     | `3 séances expirent le 30 septembre.`                                                       | `3 sessions expire on September 30.`                                          |
| Échec de paiement           | `Ton paiement n'est pas passé. Mets à jour ta carte pour garder ton accès.`                 | `Your payment didn't go through. Update your card to keep your access.`       |
| WOD publié (push)           | `Le WOD de demain est en ligne 💪`                                                          | `Tomorrow's WOD is live 💪`                                                   |
| Nouveau PR                  | `Nouveau record 🔥 Fran en 7:19, tu gagnes 23 secondes.`                                    | `New PR 🔥 Fran in 7:19 — 23 seconds faster.`                                 |
| Score enregistré            | `Score enregistré. 4ᵉ au classement Rx de la semaine.`                                      | `Score saved. 4th on this week's Rx leaderboard.`                             |
| Check-in validé             | `Bienvenue, Léa ✅`                                                                         | `Welcome, Léa ✅`                                                             |
| QR expiré                   | `Ton code a expiré. Rafraîchis-le dans l'app.`                                              | `Your code expired. Refresh it in the app.`                                   |
| État vide — réservations    | `Aucune séance prévue. Ton prochain WOD t'attend.` + `Voir le planning`                     | `No sessions booked. Your next WOD is waiting.` + `See schedule`              |
| État vide — PR              | `Pas encore de record. Logue ton premier score pour démarrer.`                              | `No PRs yet. Log your first score to get started.`                            |
| Erreur générique            | `Ça n'a pas fonctionné. Réessaie dans un instant.`                                          | `That didn't work. Try again in a moment.`                                    |
| Hors ligne                  | `Pas de connexion — voici ta dernière version enregistrée.`                                 | `You're offline — showing your last saved version.`                           |
| Visite chez un partenaire   | `Cours chez CrossFit Nanterre · 1 visite restante ce mois-ci`                               | `Class at CrossFit Nanterre · 1 visit left this month`                        |
| Suppression de compte       | `Ton compte et tes données seront supprimés sous 30 jours. Cette action est définitive.`    | `Your account and data will be deleted within 30 days. This can't be undone.` |

**Règles de rédaction**

- Jamais de code d'erreur brut affiché à un membre. Toujours une phrase + une action.
- Les montants toujours en TTC, format français (`89,00 €`), anglais (`€89.00`).
- Les heures au format local de la box, jamais en UTC.
- Les dates relatives jusqu'à J+2 (« demain 18h30 »), absolues au-delà.
- Toute chaîne passe par le système i18n dès le premier commit. **Une seule chaîne en dur = la dette qui se propage.**

### 12.4 Accessibilité (cible RGAA / WCAG 2.2 AA)

| Exigence                  | Mise en œuvre                                                                                                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contraste                 | ≥ 4,5:1 pour le texte, ≥ 3:1 pour les composants. **Valider automatiquement la couleur primaire choisie par la box** : si le contraste est insuffisant, proposer une variante corrigée plutôt que de laisser une box livrer une app illisible. |
| Cibles tactiles           | 44 × 44 pt minimum (iOS) / 48 dp (Android)                                                                                                                                                                                                     |
| Taille de texte dynamique | Support de Dynamic Type / font scale jusqu'à 200 %, sans casse de mise en page                                                                                                                                                                 |
| Lecteurs d'écran          | Labels explicites sur tous les boutons et icônes, ordre de focus logique, annonce des changements d'état (place obtenue, promotion)                                                                                                            |
| Couleur seule             | Jamais porteuse d'information unique : le statut « complet » a un texte, pas seulement une pastille rouge                                                                                                                                      |
| Mouvement                 | Respect de `prefers-reduced-motion` ; le chrono reste lisible sans animation                                                                                                                                                                   |
| Web                       | Navigation clavier complète du back-office, `aria-live` sur les compteurs de places, skip links                                                                                                                                                |
| Formulaires               | Erreurs associées au champ, messages en texte, pas de validation uniquement à la soumission                                                                                                                                                    |

### 12.5 Onboarding

**Membre (objectif : première réservation en moins de 3 minutes)**

1. Écran de bienvenue aux couleurs de la box (rassure : « c'est bien mon club »).
2. Auth en un tap (Apple/Google).
3. 4 champs maximum, tout le reste plus tard.
4. Consentements clairs et séparés, sans dark pattern (le refus des notifications ne bloque rien).
5. Formule ou « je verrai plus tard ».
6. **Atterrissage direct sur le prochain cours réservable**, pas sur un tutoriel. Le tutoriel est un badge « ? » discret.
7. J+1 sans réservation → un rappel unique, jamais deux.

**Coach (objectif : premier WOD publié le jour de l'installation)**

1. Invitation par l'Owner → connexion.
2. Écran « Ton premier WOD » : un modèle pré-rempli (Fran) qu'il modifie plutôt que de partir d'une page blanche.
3. Import possible depuis un collage de texte (les coachs ont tous leurs WOD dans un Google Doc) → parsing automatique proposé en correction.
4. Publication → il voit immédiatement le rendu côté membre (aperçu).
5. Bibliothèque de 3 cycles types fournis (Force, Hyrox 12 semaines, Conditionnement) à dupliquer.

**Owner (objectif : box opérationnelle en moins de 45 minutes)**

1. Assistant en 5 étapes : infos box → horaires d'ouverture → types de cours → génération du planning récurrent → formules et tarifs.
2. **Import de membres par CSV** avec mapping de colonnes assisté et prévisualisation. Sans ça, aucune box existante ne migrera.
3. Onboarding Stripe Connect en différé (peut être fait après, l'app fonctionne en mode « paiement hors app »).
4. Invitation des membres par lien unique + QR à afficher + import d'e-mails.
5. Checklist de mise en route persistante sur le dashboard, avec taux de complétion.

---

## 13. Roadmap produit et plan de livraison

### 13.1 Hypothèse de capacité

**Solo, 15–20 h/semaine effectives ≈ 2,3 j·h/semaine ≈ 9 à 10 j·h/mois.** Sprints de 2 semaines, ~4,5 j·h par sprint. Les mois indiqués sont des mois calendaires depuis le démarrage.

### 13.2 Phase 0 — Socle (M1 → M2, ≈ 20 j·h)

| Sprint | Contenu                                                                                                                  | Livrable                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| S1–S2  | Repo monorepo, CI/CD, environnements, design tokens, kit de 22 composants, i18n FR/EN                                    | Une app qui affiche un écran thémé dans les 2 langues        |
| S3–S4  | Postgres + schéma complet + **RLS et test anti-fuite en CI**, auth Apple/Google/magic link, `/v1/me`, création de tenant | Deux boxes coexistent, aucune donnée ne fuit, on se connecte |

**Critères de sortie Phase 0** : le test de fuite inter-tenant passe sur 100 % des tables · une session mobile authentifiée récupère son thème et ses memberships · le déploiement est automatisé de bout en bout · Sentry remonte une erreur de test.

### 13.3 Phase 1 — v0 pilote (M3 → M6, ≈ 42 j·h)

| Sprint  | Contenu                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------- |
| S5–S6   | Types de cours, planning récurrent (RRULE), matérialisation des occurrences, back-office planning |
| S7–S8   | **Réservation transactionnelle** + idempotence + temps réel + annulation avec fenêtre             |
| S9–S10  | Liste d'attente + promotion automatique + notifications push (Expo)                               |
| S11–S12 | Check-in QR (membre + kiosque + fallback coach), roster coach, back-office membres minimal        |

**Critères de sortie Phase 1 (= go pilote)** :

- Une box réelle utilise l'app **en production** pour son planning et ses réservations pendant 2 semaines.
- Zéro double-réservation constatée sur 500 réservations (test de charge concurrentielle inclus).
- Le check-in fonctionne avec le wifi coupé.
- Le paiement se fait **hors app** (virement, espèces, prélèvement existant) — assumé et expliqué à la box pilote.
- Objectif chiffré : **1 box pilote, 60+ membres actifs, 200+ réservations/semaine.**

### 13.4 Phase 2 — MVP vendable (M7 → M11, ≈ 45 j·h)

| Sprint  | Contenu                                                                                                                           |
| ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| S13–S15 | Stripe Connect Express, formules, abonnements, packs de crédits, portefeuille, webhooks, dunning                                  |
| S16–S18 | **Program Builder CrossFit** : cycles, séances, blocs, mouvements, Rx/Scaled/Beginner, charges en % de 1RM, publication planifiée |
| S19–S20 | Saisie de score, PR, leaderboard, WOD du jour côté membre                                                                         |
| S21–S22 | Dashboard box, reporting financier, RGPD (export/suppression/consentements), white-label N0, soumission App Store + Play Store    |

**Critères de sortie Phase 2 (= go commercial)** :

- Une box s'inscrit, se configure et encaisse **sans votre intervention** (test réalisé avec une box qui ne vous connaît pas).
- Les apps sont publiées sur les deux stores et acceptées.
- Le rapprochement entre le reporting de l'app et le tableau de bord Stripe est exact au centime sur un mois complet.
- Les parcours P1 à P5 passent en tests end-to-end automatisés.
- Objectif chiffré : **3 boxes payantes, ~120 € de MRR.** Le chiffre est modeste, c'est normal et c'est le bon signal à ce stade — ce qui compte est que quelqu'un paie sans que vous ayez porté la vente à bout de bras.

### 13.5 Phase 3 — v1 « la différence » (M12 → M20, ≈ 76 j·h)

| Bloc             | Contenu                                                                                 | j·h |
| ---------------- | --------------------------------------------------------------------------------------- | --- |
| Hyrox            | Stations, splits, roxzone, projection, PR par station, programmes périodisés            | 12  |
| Événements Hyrox | Heats, dossards, pairings, chrono, leaderboard d'événement, billetterie                 | 8   |
| CrossFit avancé  | Benchmarks, notes de coach, suggestions de scaling                                      | 10  |
| Argent           | Frais d'annulation/no-show, reporting détaillé, export comptable, SEPA                  | 12  |
| Réseau           | Partenariats, planning partagé, réservation cross-box, commissions, reporting consolidé | 16  |
| Confort          | Calendrier .ics + Google, analytics produit, rôle Manager, journal d'audit              | 10  |
| Marketplace      | Vente de programmes                                                                     | 8   |

**Critères de sortie Phase 3** : **12 à 20 boxes payantes (~1 000 à 2 000 € de MRR)** · au moins 3 partenariats inter-box actifs avec des règlements financiers réels · un événement Hyrox organisé de bout en bout dans l'app · churn mensuel < 4 %.

### 13.6 Phase 4 — v2 (M21 → M36)

Marketplace publique, white-label N2, wearables, écran TV de salle, assistance IA à la programmation, ouverture Belgique/Suisse/Espagne. **À arbitrer selon ce que les 20 premiers clients demandent réellement**, pas selon ce document.

### 13.7 Vue synthétique

| Phase        | Fin | j·h  | Périmètre                               | Objectif commercial     |
| ------------ | --- | ---- | --------------------------------------- | ----------------------- |
| P0 Socle     | M2  | 20   | Auth, multi-tenant, design system       | —                       |
| P1 v0 pilote | M6  | 42   | Planning, résa, waitlist, check-in      | 1 box pilote gratuite   |
| P2 MVP       | M11 | 45   | Paiement, programmation, scores, stores | 3 boxes payantes        |
| P3 v1        | M20 | 76   | Hyrox, réseau, finance avancée          | 12–20 boxes, 1–2 k€ MRR |
| P4 v2        | M36 | 120+ | Marketplace, white-label N2, IA         | 50+ boxes, 6–10 k€ MRR  |

### 13.8 Comparaison des scénarios de capacité

| Scénario                            | Composition                                               | MVP (P0+P1+P2) | v1  | Coût annuel indicatif                          |
| ----------------------------------- | --------------------------------------------------------- | -------------- | --- | ---------------------------------------------- |
| **Solo side project** _(votre cas)_ | 1 dev full-stack, 15–20 h/sem                             | **M11**        | M20 | ~3–6 k€ (outils, stores, comptable, juridique) |
| Solo à temps plein                  | 1 dev full-stack, 35 h/sem                                | M5             | M9  | + coût d'opportunité du salaire                |
| Small team                          | 2–3 pers. (1 back, 1 mobile, 1 produit/design à mi-temps) | M4             | M8  | 150–250 k€                                     |
| Dedicated team                      | 6–8 pers. (2 back, 2 mobile, 1 web, 1 design, 1 QA, 1 PO) | M3             | M6  | 500–800 k€                                     |

> **Ce que le tableau dit vraiment.** Une équipe dédiée va 3,5 fois plus vite pour 100 fois le coût. En solo, votre avantage n'est pas la vitesse : c'est de pouvoir servir 20 boxes très bien, en français, avec un produit étroit et excellent, là où un concurrent financé doit en servir 2 000 pour exister. **Ne courez pas la course des autres.**

---

## 14. Architecture technique et stack recommandé

### 14.1 Recommandation, en une ligne

**Expo (React Native) + Next.js + Supabase (Postgres/Auth/RLS/Realtime/Storage, région UE) + Stripe Connect, hébergé sur Vercel + Supabase, monorepo Turborepo avec code métier partagé en TypeScript.**

### 14.2 Justification des choix structurants

| Couche               | Choix                                                                                                                                                                | Alternatives écartées            | Pourquoi                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mobile**           | **Expo / React Native**                                                                                                                                              | Flutter, natif Swift+Kotlin      | Une seule base de code, **TypeScript partagé avec le web et le backend** (types, validations Zod, logique métier). Expo apporte OTA updates (corriger un bug sans repasser par la revue Apple — vital en solo), EAS Build et le push. Flutter est techniquement excellent mais impose Dart, donc deux langages et zéro partage de code : disqualifiant à une personne. Le natif est hors de question ici (× 2 le travail).                                                                                                                                                        |
| **Web**              | **Next.js (App Router)**                                                                                                                                             | Vue/Nuxt, Remix, SPA Vite        | SSR utile pour les pages publiques (SEO : « box crossfit + ville », pages de programme, planning public). Même langage et mêmes types que le mobile. Vercel déploie en une commande.                                                                                                                                                                                                                                                                                                                                                                                              |
| **Backend**          | **Supabase (Postgres managé) + fonctions serveur Next.js / Edge Functions**                                                                                          | NestJS sur conteneur, Go, Django | Supabase donne d'emblée : Postgres, Auth (Apple/Google/magic link), **RLS native — exactement le bon outil pour le multi-tenant**, Realtime (places restantes), Storage, backups PITR, région **eu-west (Francfort/Paris)**. C'est ce qui rend un MVP multi-tenant faisable seule. Un NestJS maison est plus propre à 5 personnes ; à une, c'est 3 mois perdus en plomberie. **Écrire la logique métier critique (réservation, paiement, ledger) dans des fonctions Postgres ou une couche API explicite**, pas dans le client, pour pouvoir migrer plus tard sans tout réécrire. |
| **Logique critique** | Fonctions SQL/PLpgSQL transactionnelles pour `book_class`, `cancel_booking`, `promote_waitlist`, `debit_credits`                                                     | Logique applicative              | Une seule transaction, aucune fenêtre de course, testable en SQL. C'est la garantie anti-surbooking.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **BDD**              | **Postgres 16+** (Supabase) + extensions `pgcrypto`, `pg_cron`, `postgis` (v1)                                                                                       | MySQL, MongoDB                   | RLS, transactions, JSONB, RRULE via `pg_cron` pour la matérialisation des occurrences. Aucun argument pour autre chose ici.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Cache / files**    | **Redis (Upstash)** en v1 seulement                                                                                                                                  | Redis dès J1                     | Au MVP, Postgres suffit largement (< 50 boxes). Ajoutez Redis quand vous aurez un problème mesuré, pas avant. Files d'attente : `pg-boss` (jobs dans Postgres) au MVP, puis QStash/BullMQ.                                                                                                                                                                                                                                                                                                                                                                                        |
| **Hébergement**      | **Vercel (web + API) + Supabase (données), régions UE**                                                                                                              | AWS (ECS/RDS), GCP, Scaleway     | AWS est plus puissant et bien moins cher à grande échelle, mais coûte des semaines d'ops. Coût MVP : ~50–80 €/mois tout compris. **Migrez vers AWS/Scaleway quand la facture dépasse 500 €/mois**, pas avant. Scaleway/OVH sont un argument de souveraineté à garder en réserve pour les boxes sensibles au « hébergé en France ».                                                                                                                                                                                                                                                |
| **Temps réel**       | Supabase Realtime (Postgres logical replication)                                                                                                                     | Socket.io, Pusher, Ably          | Inclus, suffisant pour des compteurs de places.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Fichiers**         | Supabase Storage → Cloudflare R2 en v1                                                                                                                               | S3 direct                        | Logos, avatars, vidéos de mouvements.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Paiement**         | Stripe + Connect Express                                                                                                                                             | Mollie, Adyen                    | Cf. §8 et §15.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **CI/CD**            | GitHub Actions : lint → typecheck → tests unitaires → **test anti-fuite RLS** → tests E2E → migrations → déploiement ; EAS Build + soumission automatique aux stores | —                                | En solo, **la CI est votre binôme de relecture**. Ne jamais déployer à la main.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Tests**            | Vitest (unitaires), pgTAP ou tests SQL (règles métier), Playwright (web E2E), Maestro (mobile E2E)                                                                   | Jest, Detox                      | Maestro est nettement plus simple que Detox pour un flux mobile en solo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Monitoring**       | Sentry + Better Stack + Checkly (uptime sur `/health` et le parcours de réservation)                                                                                 | Datadog                          | Alerte SMS sur : 5xx > 1 %, webhook Stripe en échec, job waitlist bloqué, latence de réservation p95 > 800 ms.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Feature flags**    | PostHog (inclus)                                                                                                                                                     | LaunchDarkly                     | Permet de livrer une fonction à une seule box avant de la généraliser.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

### 14.3 Schéma d'architecture

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ App membre   │   │ Back-office  │   │ Kiosque /    │
│ Expo RN      │   │ Next.js web  │   │ TV de salle  │
│ iOS+Android  │   │ (SSR)        │   │ (web PWA)    │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │  HTTPS / JWT + X-Tenant-Id  │        │
       └────────────┬────────────────┴────────┘
                    ▼
        ┌───────────────────────────┐
        │   API /v1 (Next.js Route  │
        │   Handlers + Edge Funcs)  │  ← Zod validation, RBAC, rate limit,
        │   TypeScript partagé      │    idempotence, audit log
        └───────┬───────────┬───────┘
                │           │
       ┌────────▼──────┐  ┌─▼────────────────────┐
       │  Postgres     │  │ Jobs (pg-boss/pg_cron)│
       │  + RLS        │  │ waitlist, rappels,    │
       │  + fonctions  │  │ matérialisation RRULE,│
       │    métier     │  │ dunning, expirations  │
       │  + Realtime   │  └───────────────────────┘
       └───────┬───────┘
               │
   ┌───────────┼───────────┬────────────┬──────────┐
   ▼           ▼           ▼            ▼          ▼
 Stripe     Expo Push   Resend      Storage     Sentry
 Connect   (APNs/FCM)   (e-mail)    (R2/S3)    PostHog
   │
   └── webhooks signés ──► /v1/webhooks/stripe (source de vérité financière)
```

### 14.4 Décisions techniques à ne pas rater

| #   | Décision                                                                 | Conséquence si ratée                                                    |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| D1  | `tenant_id` + RLS **dès la première migration**                          | Rétro-ajouter le multi-tenant = réécriture complète                     |
| D2  | Réservation dans **une** transaction SQL avec verrou de ligne            | Double-booking en production = perte de confiance irréversible          |
| D3  | `Idempotency-Key` sur toutes les écritures financières et de réservation | Doubles débits, doubles réservations sur réseau instable                |
| D4  | Ledger financier **append-only**                                         | Impossible de rapprocher avec Stripe et de justifier un chiffre         |
| D5  | i18n dès le premier écran                                                | Rétro-fit = 3 semaines et des oublis pendant un an                      |
| D6  | Design tokens, zéro couleur en dur                                       | Le white-label devient infaisable                                       |
| D7  | Webhook Stripe = source de vérité, pas le retour client                  | Droits activés sans paiement, ou l'inverse                              |
| D8  | Tous les timestamps en UTC + timezone du tenant stockée                  | Bugs d'heure d'été sur les fenêtres d'annulation — classique et coûteux |
| D9  | OTA updates activées (Expo Updates)                                      | Chaque correctif attend la revue Apple (24–72 h)                        |
| D10 | Migrations versionnées et réversibles                                    | Impossible de revenir en arrière un dimanche soir, seule                |

---

## 15. Sécurité, conformité et RGPD

### 15.1 Rôles au sens RGPD — le point le plus important

| Traitement                                                            | Responsable de traitement                                             | Sous-traitant  |
| --------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------- |
| Données des membres d'une box (identité, présence, paiements, scores) | **La box**                                                            | **RIG** (vous) |
| Compte utilisateur global, PR personnels, préférences                 | **RIG**                                                               | —              |
| Réservation cross-box                                                 | **Responsables conjoints** (box d'origine + box hôte), accord art. 26 | RIG            |
| Données de facturation SaaS des boxes                                 | **RIG**                                                               | Stripe         |

**Conséquences opérationnelles obligatoires :**

1. Un **DPA (contrat de sous-traitance, art. 28 RGPD)** signé avec chaque box, intégré au parcours d'inscription (acceptation en ligne horodatée). Sans ce document, vous êtes en infraction dès le premier client.
2. Un **registre des activités de traitement** (art. 30) tenu à jour — un tableur suffit, mais il doit exister.
3. Une **liste publique de sous-traitants ultérieurs** (Stripe, Supabase, Sentry, Expo, Resend, PostHog…) avec leur localisation, et une clause de notification avant tout ajout.
4. Un **modèle d'accord de responsabilité conjointe** fourni aux boxes partenaires pour le réseau inter-box.
5. Une **analyse d'impact (AIPD)** : probablement non obligatoire au MVP (pas de données de santé, pas de profilage à effet juridique), mais **le suivi de performance physique + géolocalisation + scoring de churn peut basculer** dans le champ. À réévaluer en v1. Documentez la décision de ne pas en faire une, c'est ce que la CNIL vous demandera.

### 15.2 Données personnelles et rétention

| Catégorie                | Exemples                                                 | Base légale                                                     | Rétention                                                                            |
| ------------------------ | -------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Identité                 | Nom, e-mail, téléphone, date de naissance                | Exécution du contrat                                            | Durée du contrat + 3 ans (prospection)                                               |
| Présence et réservations | Check-ins, réservations, annulations                     | Exécution du contrat                                            | 3 ans, puis anonymisation                                                            |
| Paiement                 | Montants, statuts, 4 derniers chiffres                   | Obligation légale + contrat                                     | **10 ans** (obligation comptable) sous forme de pièces comptables                    |
| Performance              | Scores, PR, splits                                       | Consentement (leaderboard) / contrat (suivi coach)              | Durée du compte, export possible à tout moment                                       |
| Santé                    | ⚠️ Blessures, restrictions médicales, certificat médical | **Consentement explicite obligatoire** (donnée sensible art. 9) | Durée du contrat, chiffrement au niveau colonne, accès restreint aux coachs assignés |
| Photos                   | Avatar, photos d'événement                               | Consentement, révocable                                         | Jusqu'au retrait                                                                     |
| Traces techniques        | Logs, IP, device                                         | Intérêt légitime (sécurité)                                     | 6 mois (12 mois pour les logs de sécurité)                                           |
| Marketing                | Consentement newsletter                                  | Consentement (e-privacy)                                        | 3 ans sans interaction                                                               |

> ⚠️ **Le champ « blessure / restriction » est une donnée de santé.** C'est le piège classique de ce type d'app : un coach écrit « épaule droite, tendinite » dans une note et vous traitez une donnée sensible sans base légale. Mesures obligatoires : consentement explicite du membre, champ isolé et chiffré, accès limité aux coachs de la box, jamais transmis à une box partenaire, jamais dans les analytics, jamais dans les logs.

### 15.3 Droits des personnes — implémentation

| Droit                     | Implémentation                                                                                                                      | Délai                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Accès / portabilité       | `GET /v1/me/export` → archive JSON + CSV via lien signé expirant en 24 h                                                            | Immédiat (automatisé) |
| Rectification             | Éditable en self-service dans le profil                                                                                             | Immédiat              |
| Effacement                | `DELETE /v1/me` → suppression logique immédiate, anonymisation réelle à J+30, **conservation des écritures comptables anonymisées** | 30 j                  |
| Opposition / limitation   | Réglages granulaires (leaderboard, partage inter-box, marketing)                                                                    | Immédiat              |
| Retrait du consentement   | Aussi simple que le don : un interrupteur, pas un e-mail au support                                                                 | Immédiat              |
| Notification de violation | Procédure écrite : détection → qualification → notification CNIL sous **72 h** → information des personnes si risque élevé          | 72 h                  |

### 15.4 Sécurité technique

| Domaine           | Mesures                                                                                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transport         | TLS 1.3 partout, HSTS, certificate pinning sur mobile (v1)                                                                                                                                           |
| Au repos          | Chiffrement disque (AES-256, fourni par Supabase/AWS) + **chiffrement applicatif au niveau colonne** pour les données de santé et les notes de coach (`pgcrypto`)                                    |
| Authentification  | JWT 15 min + refresh rotatif 30 j révocable, MFA obligatoire pour `OWNER` et `SUPER_ADMIN` (v1), rate limiting sur l'auth, détection de credential stuffing                                          |
| Autorisation      | RBAC applicatif **+** RLS Postgres (défense en profondeur : une faille applicative ne suffit pas à faire fuiter un tenant)                                                                           |
| Secrets           | Jamais dans le repo ; variables d'environnement chiffrées, rotation semestrielle documentée                                                                                                          |
| Dépendances       | Dependabot + `npm audit` bloquant en CI sur les vulnérabilités critiques                                                                                                                             |
| Sauvegardes       | PITR 7 j (Supabase Pro) + **dump quotidien chiffré vers un stockage tiers** — un backup chez le même fournisseur que la base n'est pas un backup. Test de restauration **trimestriel, calendarisé**. |
| Journalisation    | Audit log applicatif sur toute action sensible (rôles, finances, données membres), immuable, 24 mois                                                                                                 |
| Anti-abus         | Rate limiting, CAPTCHA sur l'inscription si abus détecté, détection de QR rejoué                                                                                                                     |
| Tests d'intrusion | Auto-évaluation OWASP ASVS niveau 1 avant le lancement ; pentest externe (~4–8 k€) quand vous dépassez 20 boxes ou une box de plus de 500 membres                                                    |
| Réversibilité     | Export complet des données d'un tenant à la demande, dans un format ouvert — clause contractuelle                                                                                                    |

### 15.5 PCI-DSS et flux de paiement

**Objectif : rester en SAQ-A**, le niveau le plus léger. Cela signifie que **vous ne voyez, ne transmettez ni ne stockez jamais de numéro de carte.**

```
Membre ──► Stripe Payment Sheet (SDK natif, UI Stripe)
                    │
                    ├── Les données carte vont DIRECTEMENT à Stripe. Jamais à vous.
                    ▼
            Stripe tokenise ──► PaymentMethod (pm_xxx)
                    │
Votre backend ──────┴──► PaymentIntent (destination charge vers le compte connecté de la box)
                              + application_fee_amount (votre commission)
                    │
                    ▼
            Webhook signé ──► /v1/webhooks/stripe ──► activation des droits + ledger
```

**Règles absolues**

| #   | Règle                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Utiliser **exclusivement** les SDK Stripe officiels (Payment Sheet mobile, Elements web). Jamais de champ carte maison.                                                                 |
| 2   | Ne **jamais** logguer un PaymentMethod complet, un PAN, un CVV. Scrubbing PII activé dans Sentry, vérifié.                                                                              |
| 3   | Vérifier **systématiquement** la signature des webhooks (`Stripe-Signature`) et traiter chaque événement de façon idempotente (table `processed_webhook_events`).                       |
| 4   | Les droits ne s'activent que sur `invoice.paid` / `payment_intent.succeeded` côté serveur, jamais sur un retour client.                                                                 |
| 5   | Stripe Connect **Express** : le KYC/KYB des boxes est fait par Stripe, pas par vous. Vous ne détenez jamais les fonds → hors du champ de l'agrément d'établissement de paiement (DSP2). |
| 6   | Stocker uniquement : `stripe_customer_id`, `stripe_account_id`, `payment_method_id`, marque de carte, 4 derniers chiffres, date d'expiration. Rien d'autre.                             |
| 7   | Fournir le certificat d'attestation SAQ-A à toute box qui le demande (les franchises le réclament).                                                                                     |

### 15.6 Obligations françaises additionnelles

- **Mentions légales** et CGU/CGV distinctes (RIG ↔ box, box ↔ membre) — la box est le vendeur du service sportif, vous êtes le fournisseur de l'outil.
- **TVA** : 20 % sur votre abonnement SaaS en France ; autoliquidation en B2B intracommunautaire (validation du numéro de TVA via VIES) ; vigilance sur le seuil de la franchise en base si vous démarrez en micro-entreprise.
- **Facturation électronique** : la réforme française impose progressivement la réception puis l'émission de factures électroniques via des plateformes agréées — **calendrier à vérifier à l'approche du lancement** et à intégrer au choix de l'outil de facturation.
- **Accessibilité** : l'European Accessibility Act s'applique aux services numériques grand public. Viser WCAG 2.2 AA n'est pas une option de confort.
- **Cookies et traceurs** : bandeau conforme CNIL sur le web (refus aussi simple que l'acceptation), pas de traceur analytique avant consentement, ou configuration exemptée de consentement.
- **Certificat médical / questionnaire de santé** : si la box collecte un QS-SPORT ou un certificat via l'app, c'est de la donnée de santé → §15.2.
- **Assurance RC Pro** obligatoire avant le premier client, avec extension cyber recommandée.

---

## 16. Tests et QA

### 16.1 Pyramide de tests (adaptée au solo)

| Niveau          | Couverture cible               | Outils             | Quoi                                                                                                       |
| --------------- | ------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Unitaire        | 70 % sur le domaine métier     | Vitest             | Calculs de charges (% 1RM), fenêtres d'annulation, quotas, répartition de commissions, arrondis monétaires |
| Base de données | 100 % des règles critiques     | pgTAP / tests SQL  | Fonctions `book_class`, `cancel_booking`, `promote_waitlist`, `debit_credits` — **et les policies RLS**    |
| Intégration API | 100 % des endpoints d'écriture | Vitest + Supertest | Codes d'erreur, idempotence, permissions par rôle                                                          |
| E2E web         | 6 parcours critiques           | Playwright         | Création de box, planning, formule, réservation admin, reporting                                           |
| E2E mobile      | 5 parcours critiques           | Maestro            | Inscription, réservation, waitlist, check-in, saisie de score                                              |
| Charge          | Ponctuel avant chaque phase    | k6                 | 200 réservations concurrentes sur 1 place, pic de 18 h                                                     |
| Sécurité        | Continu                        | CI + OWASP ASVS L1 | Fuite inter-tenant, escalade de privilège, injection                                                       |

### 16.2 Scénarios de test prioritaires (les 15 qui comptent)

| #   | Scénario                                                 | Résultat attendu                                                                        |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| T1  | 200 réservations simultanées sur 1 place restante        | Exactement 1 confirmée, 199 en waitlist ou refusées, 0 débit erroné                     |
| T2  | Double tap sur « Réserver » avec la même Idempotency-Key | 1 seule réservation, 1 seul débit                                                       |
| T3  | Requête d'un tenant A ciblant une ressource du tenant B  | 404 (jamais 403 : ne pas révéler l'existence)                                           |
| T4  | Un COACH tente d'accéder au reporting financier          | 403, action journalisée                                                                 |
| T5  | Annulation à J-4 h 01 min puis à J-3 h 59 min            | Crédit remboursé dans le 1er cas, consommé dans le 2ᵉ                                   |
| T6  | Passage à l'heure d'hiver un dimanche à 3 h du matin     | Aucun décalage des cours, fenêtres d'annulation correctes                               |
| T7  | Webhook Stripe reçu deux fois                            | Traité une seule fois, ledger cohérent                                                  |
| T8  | Échec de paiement puis mise à jour de carte              | Droits restaurés sans intervention manuelle                                             |
| T9  | Promotion waitlist non confirmée en 60 min               | Passe automatiquement au suivant, aucune place perdue                                   |
| T10 | Check-in hors ligne puis retour du réseau                | Présence synchronisée sans doublon                                                      |
| T11 | QR capturé en écran, présenté 2 min plus tard            | Refusé                                                                                  |
| T12 | Réservation cross-box avec quota dépassé                 | Bascule sur le tarif drop-in, montant affiché avant validation                          |
| T13 | Suppression de compte RGPD                               | Données personnelles anonymisées à J+30, écritures comptables préservées et anonymisées |
| T14 | Charge en % de 1RM sans PR enregistré                    | Affiche le pourcentage et propose de renseigner le PR, ne plante pas                    |
| T15 | Rapprochement app ↔ Stripe sur 1 mois                    | Écart de 0 centime                                                                      |

### 16.3 Tests utilisateurs (5 sessions, avant le lancement commercial)

| #   | Profil                                         | Durée   | Tâches                                                                                | Critère de réussite                                                      |
| --- | ---------------------------------------------- | ------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | Propriétaire de box, jamais vu l'app           | 60 min  | Créer sa box, configurer une semaine de planning, créer 2 formules, inviter 3 membres | Termine sans aide en < 45 min                                            |
| 2   | Coach, non technique                           | 45 min  | Créer un cycle de 2 semaines, saisir 3 WOD avec Rx/Scaled, publier                    | Saisit un WOD en < 90 s et le déclare « plus rapide que mon Google Doc » |
| 3   | Membre, 45 ans, peu à l'aise avec le numérique | 30 min  | S'inscrire, réserver, se mettre en waitlist, annuler, pointer                         | Réserve sans aide, comprend son solde de crédits                         |
| 4   | Membre Hyrox                                   | 30 min  | Enregistrer une simulation avec splits, lire sa projection                            | Identifie seul(e) sa station faible                                      |
| 5   | Coach en salle, en conditions réelles          | 1 cours | Ouvrir le roster, pointer, corriger un score                                          | Ne retourne pas sur papier/WhatsApp pendant le cours                     |

**Protocole** : pensée à voix haute, aucune aide pendant 3 minutes d'écran bloqué, enregistrement écran + audio (avec consentement), notation SUS en fin de session.

### 16.4 Métriques d'acceptation

| Métrique                                  | Seuil MVP     | Seuil v1      |
| ----------------------------------------- | ------------- | ------------- |
| Crash-free sessions (mobile)              | ≥ 99,5 %      | ≥ 99,8 %      |
| p95 temps de réservation (API)            | < 800 ms      | < 400 ms      |
| p95 démarrage à froid de l'app            | < 2,5 s       | < 1,8 s       |
| Taux de succès du check-in                | ≥ 99 %        | ≥ 99,5 %      |
| Doubles réservations                      | **0**         | **0**         |
| Écart de rapprochement financier          | **0 centime** | **0 centime** |
| Taux de complétion de l'onboarding membre | ≥ 80 %        | ≥ 90 %        |
| Score SUS (tests utilisateurs)            | ≥ 72          | ≥ 80          |
| Tickets de support par box et par mois    | ≤ 4           | ≤ 2           |
| Uptime mensuel                            | ≥ 99,5 %      | ≥ 99,9 %      |

---

## 17. Modèle économique et monétisation

### 17.1 Structure tarifaire recommandée

| Offre             | Cible                              | Prix                   | Inclus                                                                                     | Limite             |
| ----------------- | ---------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------ | ------------------ |
| **Starter**       | Box en création, coach indépendant | **49 €/mois** HT       | Planning, réservation, waitlist, check-in, paiements, app membre co-brandée                | 80 membres actifs  |
| **Box** ⭐        | Box établie (le cœur de cible)     | **99 €/mois** HT       | + programmation illimitée, leaderboards, reporting financier, module Hyrox, 3 coachs       | 250 membres actifs |
| **Box Pro**       | Box importante, multi-salles       | **179 €/mois** HT      | + multi-salles, marque étendue (N1), analytics avancés, réseau inter-box, coachs illimités | 600 membres        |
| **Network**       | Groupes, franchises                | **sur devis (300 €+)** | + white-label N2, reporting consolidé multi-box, SLA, support prioritaire                  | —                  |
| Engagement annuel |                                    | **−20 %**              |                                                                                            |                    |

**Positionnement.** Wodify et Mindbody se situent entre 100 et 300 €/mois avec des modules facturés en supplément ; TeamUp et les acteurs low-cost autour de 40–80 €. Un tarif de 99 € est crédible **à condition d'être manifestement meilleur sur la programmation et le Hyrox**, et d'être français. Ne descendez pas sous 49 € : à 29 €, il faut 100 clients pour vivre, et 100 clients demandent un support à temps plein que vous n'aurez pas.

### 17.2 Sources de revenus complémentaires

| Source                                 | Modèle                                                         | Potentiel                                                                                                      | Quand    |
| -------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| Abonnement SaaS                        | 49–179 €/mois/box                                              | **Cœur du modèle : 80–90 % du revenu**                                                                         | MVP      |
| Commission sur drop-in et événements   | 3–5 % du montant                                               | Faible unitairement, croît avec le réseau                                                                      | v1       |
| Commission marketplace inter-box       | 5 % des transactions cross-box                                 | Devient significatif à partir de ~50 boxes connectées                                                          | v1       |
| Vente de programmes                    | 20–30 % de commission sur les programmes vendus par les coachs | Marge élevée, effort marginal une fois la brique construite                                                    | v1       |
| White-label N1                         | +29 €/mois                                                     | Bonne marge, effort quasi nul                                                                                  | v1       |
| White-label N2 (app dédiée)            | +99 à 199 €/mois, engagement 12 mois                           | **Attention : marge apparente élevée, coût de maintenance réel élevé**                                         | v2       |
| Module analytics avancé                | +29 €/mois                                                     | À ne vendre que si les données sont vraiment actionnables                                                      | v2       |
| Onboarding et migration de données     | 149–399 € une fois                                             | **Très utile : lève le principal frein à l'achat et vous paie pour un travail que vous feriez de toute façon** | MVP      |
| Frais de transaction sur les paiements | +0,5 % au-dessus de Stripe                                     | ⚠️ Rend le prix opaque et irrite les propriétaires                                                             | À éviter |

### 17.3 Projection à 24 mois (scénario solo réaliste)

| Jalon            | Boxes              | MRR      | Commentaire                                                                          |
| ---------------- | ------------------ | -------- | ------------------------------------------------------------------------------------ |
| M6               | 1 (pilote gratuit) | 0 €      | Validation d'usage                                                                   |
| M11              | 3                  | ~120 €   | Premières ventes, tarif de lancement                                                 |
| M14              | 8                  | ~600 €   | Bouche-à-oreille local                                                               |
| M18              | 15                 | ~1 300 € | Le module Hyrox devient un argument d'entrée                                         |
| M24              | 30                 | ~2 800 € | Seuil de rentabilité des coûts directs largement franchi ; **pas encore un salaire** |
| M36 (projection) | 70–90              | ~7 500 € | Seuil où le temps plein devient envisageable                                         |

**Coûts directs mensuels au démarrage** : Supabase Pro 25 $ · Vercel Pro 20 $ · Sentry 26 $ · PostHog gratuit puis ~50 $ · Expo EAS 19 $ · Resend 20 $ · Crisp 25 € · domaines et divers 20 € ≈ **180 à 220 €/mois**. Plus 99 $/an Apple + 25 $ Google une fois, et 1 500–3 000 € de juridique (CGU, DPA, CGV) la première année.

**Ce que ça signifie :** le point mort en coûts directs est atteint à **3 clients**. Le point mort incluant votre temps ne l'est jamais avant plusieurs dizaines de clients — ce projet est un investissement à 3 ans, pas un complément de revenu à 6 mois. C'est faisable, mais autant le savoir dès maintenant.

---

## 18. Go-to-market

### 18.1 Stratégie en trois temps

**Temps 1 — Une box, en profondeur (M1 → M6).** Trouvez **une** box qui vous connaît (la vôtre, idéalement — vous êtes pratiquante, c'est un avantage majeur : vous parlez la langue du client et vous voyez ses vrais problèmes). Construisez avec elle, gratuitement, en échange d'un usage réel et d'un témoignage. Ne cherchez pas de deuxième client tant que la première n'est pas heureuse.

**Temps 2 — Le cercle local (M7 → M14).** 10 à 15 boxes en Île-de-France, approchées directement. Argument : _« logiciel français, support en français, programmation faite pour les coachs, module Hyrox que personne d'autre n'a, et je reprends vos données gratuitement »_. Visitez-les physiquement — dans ce milieu, tout se joue en personne et par bouche-à-oreille.

**Temps 3 — L'angle Hyrox (M15 →).** C'est votre cheval de Troie. Le Hyrox explose en France et **aucun logiciel de gestion ne le traite correctement**. Devenez l'outil de référence de la préparation Hyrox : les coachs Hyrox parlent entre eux, sont très actifs sur Instagram, et une box qui vient pour le Hyrox reste pour la gestion.

### 18.2 Canaux, par efficacité décroissante pour un solo

| Canal                                           | Effort    | Efficacité | Comment                                                                                        |
| ----------------------------------------------- | --------- | ---------- | ---------------------------------------------------------------------------------------------- |
| Réseau personnel de pratiquante                 | Faible    | ★★★★★      | Votre box, vos coachs, les boxes où vous avez fait des open gym                                |
| Visite physique de boxes                        | Élevé     | ★★★★★      | 1 h par box, démo sur place. 20 visites = 3 à 5 clients. Rien n'est plus efficace.             |
| Bouche-à-oreille entre propriétaires            | Faible    | ★★★★☆      | Les propriétaires de box se connaissent tous. Un client heureux en amène deux.                 |
| Groupes Facebook / WhatsApp de propriétaires FR | Faible    | ★★★★☆      | Y être utile pendant des mois avant de vendre quoi que ce soit                                 |
| Contenu Hyrox (Instagram, blog SEO)             | Moyen     | ★★★☆☆      | « Comment améliorer sa roxzone », calculateurs gratuits, plans types → capture d'e-mails       |
| Compétitions et événements                      | Moyen     | ★★★☆☆      | Chronométrer gratuitement une compétition locale = démonstration grandeur nature               |
| Partenariat avec un coach influent              | Moyen     | ★★★☆☆      | Programme vendu sur votre marketplace = son audience découvre l'outil                          |
| Publicité payante                               | Élevé (€) | ★☆☆☆☆      | **Ne le faites pas.** Cible trop étroite, coût par lead prohibitif, aucun ROI à cette échelle. |

### 18.3 Support et onboarding client

- **Onboarding assisté systématique au début** : 1 h en visio pour la configuration + import CSV des membres que **vous** faites. Facturé 149 € ou offert selon la négociation. C'est votre meilleure source d'apprentissage produit.
- **Support par Crisp**, engagement affiché : réponse sous 4 h ouvrées, en français. C'est votre différenciateur le plus tangible face aux acteurs américains.
- **Une base de connaissances dès le 3ᵉ client** : chaque question posée deux fois devient un article. C'est ce qui vous évitera de noyer sous le support.
- **Un appel de suivi à J+30** avec chaque nouvelle box. Le churn se joue au premier mois.

### 18.4 ✅ Checklist de lancement MVP (14 items)

| #   | Item                                                                                                            | Bloquant ?              |
| --- | --------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1   | Entité juridique créée, compte bancaire pro, assurance RC Pro souscrite                                         | 🔴 Oui                  |
| 2   | CGU, CGV, politique de confidentialité, **DPA** rédigés et relus par un juriste                                 | 🔴 Oui                  |
| 3   | Registre des traitements RGPD créé, sous-traitants listés et localisés                                          | 🔴 Oui                  |
| 4   | Compte Stripe validé, Connect Express activé, flux testé de bout en bout avec de l'argent réel (puis remboursé) | 🔴 Oui                  |
| 5   | Apps publiées et **acceptées** sur App Store et Play Store (compter 2 à 3 allers-retours, prévoir 3 semaines)   | 🔴 Oui                  |
| 6   | Test anti-fuite inter-tenant vert sur 100 % des tables, en CI                                                   | 🔴 Oui                  |
| 7   | Test de concurrence : 200 réservations simultanées sur 1 place → 1 seule confirmée                              | 🔴 Oui                  |
| 8   | Rapprochement financier app ↔ Stripe exact au centime sur 1 mois de pilote                                      | 🔴 Oui                  |
| 9   | Monitoring et alertes actifs (Sentry, uptime, webhooks en échec) avec alerte SMS                                | 🔴 Oui                  |
| 10  | Sauvegarde quotidienne chiffrée hors du fournisseur principal + **restauration testée une fois**                | 🔴 Oui                  |
| 11  | Parcours de suppression de compte et d'export de données fonctionnels et testés                                 | 🔴 Oui                  |
| 12  | Import CSV de membres testé sur un export réel d'un concurrent (Wodify, TeamUp, Resamania)                      | 🟠 Fortement recommandé |
| 13  | Page d'accueil + tarifs + démo (vidéo de 3 min) + formulaire de contact en ligne                                | 🟠 Recommandé           |
| 14  | 5 tests utilisateurs réalisés, retours bloquants corrigés                                                       | 🟠 Recommandé           |

---

## 19. Risques et plans d'atténuation

### 19.1 Risques commerciaux

| #   | Risque                                                                      |      Prob.      |    Impact    | Atténuation                                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------- | :-------------: | :----------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Le time-to-market solo (10–13 mois) laisse le temps au marché de bouger** |     Élevée      |   Critique   | Livrer la v0 pilote à M6 en production réelle ; ne jamais construire plus de 6 semaines sans mise en service ; accepter un périmètre plus étroit plutôt qu'une date plus lointaine                                            |
| R2  | **Marché saturé par des acteurs financés**                                  |    Certaine     |    Élevé     | Ne pas concurrencer frontalement. Entrer par le Hyrox et la programmation, deux angles où les gros sont mauvais. Rester le meilleur sur un périmètre étroit.                                                                  |
| R3  | Coût de changement de logiciel très élevé pour une box                      |     Élevée      |    Élevé     | Migration gratuite et faite par vous ; import CSV robuste ; période de double-run d'un mois ; garantie de remboursement 60 j                                                                                                  |
| R4  | Le propriétaire achète, mais les coachs et les membres n'adoptent pas       |     Moyenne     |    Élevé     | Le coach est le vrai prescripteur : rendez son quotidien meilleur dès le jour 1. Mesurez l'adoption membre (% ayant réservé dans l'app à J+14) et intervenez sous 30 j.                                                       |
| R5  | Un seul client représente une part trop grande du revenu                    | Élevée au début |    Moyen     | Ne jamais dépendre à plus de 30 % d'un client ; refuser les développements sur mesure non réutilisables                                                                                                                       |
| R6  | Épuisement / abandon du projet                                              |   **Élevée**    | **Critique** | C'est le premier risque d'un side project. Rythme soutenable, jalons courts, un client réel très tôt pour l'énergie que ça donne, et une décision de continuation honnête à M6 et M12 sur des critères écrits **à l'avance**. |

### 19.2 Risques techniques

| #   | Risque                                                                   |  Prob.  |    Impact    | Atténuation                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------ | :-----: | :----------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R7  | Fuite de données entre tenants                                           | Faible  | **Critique** | RLS + RBAC en défense en profondeur, test automatisé bloquant en CI, revue manuelle de chaque nouvelle table                                                                                                                                                    |
| R8  | Double-réservation ou double-débit                                       | Moyenne |    Élevé     | Transaction avec verrou de ligne, contrainte unique, idempotence, test de charge concurrentielle à chaque release                                                                                                                                               |
| R9  | Divergence financière app ↔ Stripe                                       | Moyenne |    Élevé     | Ledger append-only, job de rapprochement quotidien avec alerte sur tout écart > 0                                                                                                                                                                               |
| R10 | Dépendance forte à Supabase/Vercel (verrouillage, panne, hausse de prix) | Moyenne |    Moyen     | Postgres reste standard et exportable ; garder la logique métier en SQL et TypeScript portables ; ne pas utiliser de fonctionnalité propriétaire non substituable ; chiffrer une porte de sortie (dump quotidien externe)                                       |
| R11 | Rejet ou retrait par l'App Store                                         | Faible  |    Élevé     | Suppression de compte in-app, Sign in with Apple, politique de confidentialité, pas d'UGC non modéré. **La règle 3.1.1 (achats intégrés) ne s'applique pas** aux services physiques rendus hors de l'app — mais documentez-le clairement dans la note de revue. |
| R12 | Panne pendant les heures de pointe (18 h–20 h)                           | Moyenne |    Élevé     | Mode dégradé lecture seule, cache local, check-in hors ligne, statut public, alerte SMS                                                                                                                                                                         |
| R13 | Perte de données                                                         | Faible  | **Critique** | PITR + dump quotidien chiffré chez un tiers + **restauration testée trimestriellement**                                                                                                                                                                         |
| R14 | Un incident critique un dimanche pendant que vous êtes indisponible      | Élevée  |    Moyen     | Runbook écrit, capacité de rollback en une commande, feature flags pour désactiver une fonction sans déployer, attentes de disponibilité annoncées honnêtement aux clients                                                                                      |

### 19.3 Risques juridiques et réglementaires

| #   | Risque                                                                    |  Prob.  |    Impact    | Atténuation                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------- | :-----: | :----------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R15 | **Usage de la marque « HYROX »**                                          | Moyenne |    Élevé     | HYROX est une marque déposée. Ne jamais l'utiliser dans le nom du produit, le nom de domaine, l'icône ou d'une manière suggérant un partenariat. Employer « préparation au format Hyrox », avec une mention de non-affiliation. Faire valider par un conseil en propriété industrielle avant tout marketing. Envisager une prise de contact officielle si l'usage devient central. |
| R16 | Non-conformité RGPD (absence de DPA, données de santé)                    | Moyenne |    Élevé     | DPA signé dès le 1er client, champ santé isolé et chiffré sous consentement explicite, registre tenu à jour                                                                                                                                                                                                                                                                        |
| R17 | Requalification en établissement de paiement                              | Faible  | **Critique** | Stripe Connect avec destination charges ; **ne jamais encaisser sur votre compte pour reverser** ; faire valider le montage par un avocat avant le premier euro                                                                                                                                                                                                                    |
| R18 | Litige entre une box et un membre où vous êtes mise en cause              | Moyenne |    Moyen     | CGU claires : RIG est fournisseur d'outil, la box est le prestataire du service sportif. Limitation de responsabilité contractuelle. Assurance RC Pro.                                                                                                                                                                                                                             |
| R19 | Clause abusive dans les abonnements membres (droit de la consommation FR) | Moyenne |    Moyen     | Faire relire les modèles de CGV fournis aux boxes ; résiliation self-service ; pas de reconduction opaque ; l'app doit **faciliter** la conformité de la box, c'est un argument de vente                                                                                                                                                                                           |
| R20 | Contentieux sur les frais d'annulation ou de no-show                      | Moyenne |    Faible    | Consentement explicite au moment de la réservation, montant affiché avant validation, historique traçable, annulation manuelle possible par l'Owner                                                                                                                                                                                                                                |

---

## 20. Informations complémentaires nécessaires

Ces questions affinent la spécification. Les cinq premières changent des décisions structurantes ; les autres sont de l'ajustement.

### 🔴 Bloquantes ou structurantes

1. **Avez-vous déjà une box « design partner » identifiée** (la vôtre, celle d'un proche) prête à utiliser une v0 imparfaite dès le mois 6 ? Sans elle, le risque R1/R6 devient très difficile à contenir, et je réorganiserais la roadmap pour livrer encore plus tôt et plus petit.
2. **Quel est votre horizon et votre critère d'abandon ?** Combien de mois êtes-vous prête à investir avant le premier euro, et quel signal vous ferait arrêter ? Écrire ce critère maintenant, à froid, vaut mieux que de le découvrir à M14.
3. **Statut juridique envisagé** (micro-entreprise, SASU, SARL) et êtes-vous soumise à une clause d'exclusivité ou de non-concurrence dans votre CDI ? Cela conditionne la facturation, la TVA et, potentiellement, la faisabilité même du projet.
4. **Le réseau inter-box est-il votre vision centrale ou un bonus ?** J'ai supposé « bonus v1 ». Si c'est le cœur (un « Airbnb des boxes »), le produit, le modèle économique et le GTM changent radicalement et il faut inverser la roadmap.
5. **Encaissement : les boxes doivent-elles encaisser via l'app dès le MVP**, ou peuvent-elles garder leur système existant (prélèvement, espèces) au début ? Ma roadmap suppose que oui, ce qui repousse Stripe Connect au mois 7 et fait gagner 4 mois sur la mise en service.

### 🟠 Importantes

6. **Nom, marque et domaine** : avez-vous un nom en tête ? Est-il disponible à l'INPI et en `.fr`/`.com` ? (RIG est un nom de travail.)
7. **Une identité visuelle existante** (logo, palette, typographie) ou faut-il en créer une ?
8. **Périmètre géographique à 24 mois** : Île-de-France seulement, France entière, ou Europe francophone (Belgique, Suisse) ? Cela change la TVA, les langues et les moyens de paiement.
9. **Quel poids donnez-vous au prélèvement SEPA ?** S'il est indispensable à vos boxes cibles, il remonte du v1 vers le MVP et ajoute ~8 j·h.
10. **Combien de boxes visez-vous à 24 mois** et quel revenu mensuel viserait le « succès » à vos yeux ?

### 🟢 Ajustements

11. Faut-il gérer les **cours à plusieurs salles simultanées** et les **coachs partagés entre salles** dès le MVP ?
12. Vos boxes cibles ont-elles besoin de l'**open gym** (accès libre sans cours) et du **suivi de fréquentation hors cours** ?
13. Faut-il un **module d'essai** (séance découverte gratuite, offre 3 séances) dès le MVP ? C'est souvent le premier levier commercial d'une box.
14. Quelle est votre position sur les **frais de no-show** ? Certains propriétaires les jugent contre-productifs — je les ai mis en v1 et rendus optionnels.
15. Souhaitez-vous une **app spécifique pour les coachs** ou une seule app avec des vues conditionnées par le rôle ? (J'ai retenu une app unique — plus simple à maintenir seule.)
16. Y a-t-il des **fonctionnalités de Hustle** précises qui vous semblent indispensables et que je n'aurais pas couvertes ? Un accès à leur app ou des captures d'écran affineraient le §10.
17. Voulez-vous **vendre aussi aux coachs indépendants** (sans box) ? Cela ouvre un segment plus large mais moins solvable, et change le modèle de tarification.
18. Quelle est votre **appétence pour le SQL avancé** (fonctions PLpgSQL, RLS complexe) ? Si elle est faible, je réorienterais l'architecture vers plus de logique applicative TypeScript, au prix d'un peu de robustesse transactionnelle.

---

## Annexe — Récapitulatif des estimations

| Phase                    |     j·h |    Heures | Durée solo (15–20 h/sem) | Cumul |
| ------------------------ | ------: | --------: | ------------------------ | ----- |
| P0 — Socle               |      20 |       140 | ~2 mois                  | M2    |
| P1 — v0 pilote           |      42 |       294 | ~4 mois                  | M6    |
| P2 — MVP vendable        |      45 |       315 | ~4,5 mois                | M11   |
| P3 — v1 (Hyrox + réseau) |      76 |       532 | ~8 mois                  | M20   |
| **Total MVP (P0+P1+P2)** | **107** |   **749** | **~11 mois**             |       |
| **Total jusqu'à v1**     | **183** | **1 281** | **~19 mois**             |       |

_(L'écart avec les 122 j·h du §2.2 correspond aux éléments MUST réduits ou décalés en v1 dans la logique « v0 pilote d'abord » : white-label complet, reporting avancé, i18n exhaustive des e-mails.)_

---

_Document produit le 30 août 2026. Les valeurs réglementaires (charges Hyrox par division, calendrier de la facturation électronique, seuils RGPD) doivent être revérifiées auprès des sources officielles avant implémentation._
