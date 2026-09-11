# `P1-018` — L'émetteur d'invitations du pilote

**Phase** `P1` · **Estimation** `1` j·h · **Dépend de** `P1-001d` ✅ (import), `P0-005a`/`D-005` ✅ (invitations), `P1-016` (volet domaine/SMTP, câblé) · **Spec** §8, §15.1, §18.3 · **Origine** carve-out de la moitié « invitations » de `P1-016`, le 12 septembre 2026

## Objectif

Un lundi matin, les ~80 membres d'une box reçoivent **un e-mail qui les invite à
rejoindre Rack**, et la personne qui accompagne la mise en service ne tape aucune
commande pour ça. C'est le seul outil du chemin critique **jamais exercé à 80
personnes**, et le lundi matin de `P1-016` en dépend.

## La découverte qui reforme ce ticket (règle 8)

**L'effectif importé ne rejoint PAS par un jeton D-005.** Vérifié dans le dépôt,
pas supposé :

- `import_members()` (`20260902111000_import_members.sql:20-27,131-132`) crée des
  invitations `PENDING` **sans faire circuler aucun jeton** — « Aucun jeton n'en
  sort ». Les personnes importées rejoignent par **`accept_pending_invitation()`**
  (`20260902110000_invitation_claim_and_dedup.sql:278`), en **se connectant avec
  l'adresse invitée** : la fonction apparie l'e-mail **vérifié du JWT** à
  l'invitation `PENDING`. `pending_invitations_for_me` (sans paramètre) la liste.
- Le **jeton D-005** en clair (`create_invitation()`) est le chemin des invitations
  **individuelles** et du **QR mural** — il n'existe qu'une fois, en retour de
  fonction, et n'est jamais relisible en base. Il **ne s'applique pas** à l'import
  de masse.

**Conséquence, et c'est une correction d'une décision déjà écrite :** le volet
domaine/SMTP de `P1-016` a noté « émetteur maison via l'API Brevo, garde le flux
D-005 ». Le **canal** (API Brevo) est juste ; le « flux D-005 » est **faux pour la
masse**. L'e-mail d'invitation ne porte donc **pas** de lien à jeton : il porte
« votre box vous invite, connectez-vous à Rack **avec cette adresse** ». À corriger
dans `docs/procedures/email-et-domaine.md`, `docs/rgpd/sous-traitants.md` et la
note d'estimation de `P1-016` (petit lot doc séparé — noté ici, pas absorbé).

## Ce que ce ticket suppose et qui doit exister

*Chaque état vérifié dans le dépôt, le 12 septembre 2026.*

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Les invitations `PENDING` à envoyer | `import_members()` les crée (email, rôle, box) | ✅ existe — **c'est l'entrée de l'émetteur** |
| Le parcours d'acceptation par appariement d'e-mail | `accept_pending_invitation()`, `pending_invitations_for_me` | ✅ existent et testés |
| Le magic link (la connexion elle-même) | Supabase Auth → SMTP Brevo (volet `P1-016`) | ✅ câblé — **c'est un autre e-mail, un autre canal** que l'invitation |
| L'écran d'import de l'effectif | `apps/web/app/box/[slug]/membres/` | ✅ existe — l'émetteur se déclenche là où l'import vient d'avoir lieu |
| L'adresse publique du back-office / de l'app | `apps/web` déployé (`P1-017`) | ✅ — le lien « se connecter » de l'e-mail y pointe |
| **Une clé API Brevo** (transactionnelle) | *rien* — hors dépôt | ❌ **prérequis runtime, à créer avec ce lot** (dans les réglages hébergés, jamais commitée). Le code et les tests peuvent atterrir **avant** qu'elle existe ; la preuve d'envoi réel attend la clé, comme le domaine attend sa preuve |
| Une couche d'e-mail thémée, `sendEmail(template, locale, data)` | *rien* | ❌ **`P2-015`, et ce ticket ne la préempte pas** — voir le garde-fou |

## Décisions tranchées

### La forme de l'e-mail (la décision fondamentale, avant les cinq points)
**Instruction simple, pas de lien magique proactif ni de jeton.** L'e-mail dit :
« *[Box]* vous a inscrit·e sur Rack. Connectez-vous **avec cette adresse**
(`{email}`) sur *{lien app}*. » La personne demande **elle-même** son magic link à
la connexion (Supabase Auth) ; `accept_pending_invitation()` fait le reste. Écarté
pour le pilote : **générer un magic link par adresse** (`admin.generateLink`) et
l'emballer — plus fluide, mais fragile (le lien expire, ~1 h) et il faut la
`service_role` dans l'émetteur. La personne d'accompagnement est en salle la
première semaine (`P1-016`) : l'instruction robuste vaut mieux qu'un lien périmé.
*(Le lien magique proactif est un candidat `P2-015`, pas ici.)*

### 1. Périmètre — la relance des non-inscrits est **dedans**
`P1-016` la liste dans l'accompagnement et dit qu'elle « n'a aucun outil ». C'est
le **même mécanisme** que l'envoi, un filtre en plus : ré-envoyer aux invitations
**encore `PENDING`** (ni acceptées, ni expirées) après que la box le décide. La
laisser dehors reproduirait le trou. Dedans, minimale.

### 2. Idempotence — jamais deux fois vers la même personne
Y compris si le script est relancé après une coupure à mi-parcours (le défaut qui
se voit **chez la box**, pas chez nous). Chaque envoi réussi inscrit une ligne
(voir §3) ; la boucle **saute** toute invitation déjà envoyée dans la vague
courante. La relance (§1) est un **ré-envoi explicite** aux `PENDING`, pas une
rupture d'idempotence : elle ajoute une ligne d'envoi datée, elle ne double pas un
envoi de la même vague.

### 3. Journal des envois — minimal, mais présent le jour 1
« Je n'ai rien reçu » est la **première** question du support ; sans journal, on
débogue à l'aveugle devant la box. Une table **`email_deliveries`** minimale : *à
qui* (adresse), *quelle invitation* (réf.), *quand*, *quel statut*, *l'id fournisseur
Brevo*. **Ni corps, ni donnée personnelle au-delà de l'adresse** (`.claude/rules/privacy.md`,
et c'est déjà la contrainte que `P2-015` pose sur cette table). Elle est amorcée ici
et **`P2-015` l'étend** (colonnes gabarit/langue/marque) — même table, née minimale,
pas un jetable à jeter.

### 4. Bounces — les adresses mortes du fichier de la box
Le fichier contiendra des adresses invalides. **Échecs synchrones** (l'API Brevo
refuse une adresse) → statut `FAILED` + la raison dans `email_deliveries` ; la box
les **voit** (liste des envois échoués sur l'écran d'effectif) et corrige l'adresse,
puis relance (§1) sur cette invitation. **Rebonds asynchrones** (délivré puis
rejeté, via webhook Brevo) → **hors périmètre**, `P2-015` : au pilote, l'échec
synchrone couvre l'essentiel (adresse morte), et la personne d'accompagnement voit
le reste en salle.

### 5. Vagues — l'outil étale, il ne force pas le tout-d'un-coup
Le runbook prescrit déjà `2 × 40` si le quota se resserre. L'émetteur traite un
**lot borné par invocation** (une limite) : on l'exécute, on attend, on ré-exécute.
Il ne présuppose jamais qu'on envoie 80 d'un coup.

## Ce que `P2-015` absorbera — noté pour qu'il ne le redécouvre pas
- Le **gabarit thémé** (marque de la box, FR/EN riche) remplace l'e-mail minimal
  d'ici. `sendEmail(template, locale, data)` est à lui.
- **`email_deliveries`** gagne gabarit/langue/marque et le **webhook de rebond**.
- Le **lien magique proactif** (si jamais on le veut), et les autres e-mails
  transactionnels (paiement, crédits, suppression).

## Périmètre
- Un **émetteur côté serveur** (à trancher au build : edge function à la
  `rack-push-emitter`, qui garde la clé Brevo hors du bundle web ; ou action
  back-office). Il lit les invitations `PENDING` d'une box et poste, par lot, un
  e-mail via l'**API transactionnelle Brevo**.
- La table **`email_deliveries`** minimale (migration : `tenant_id`, RLS forcée,
  policies, grants — c'est une table métier), son journal, son idempotence.
- Un **e-mail d'invitation minimal FR/EN** (i18n, clés dans `fr.json`/`en.json`) —
  pas de gabarit thémé.
- Le **déclenchement** depuis l'écran d'effectif (envoyer / relancer), borné par lot.
- La **surface des échecs** pour la box (les `FAILED` de `email_deliveries`).

## Hors périmètre
- Le *dev build* iOS + TestFlight (**reste `P1-016`**).
- La couche `sendEmail` thémée et les autres e-mails transactionnels (**`P2-015`**).
- Les rebonds asynchrones / webhook Brevo (**`P2-015`**).
- Le lien magique proactif (**écarté**, candidat `P2-015`).
- Le jeton D-005 et le QR mural (autre chemin, déjà livré).

## Estimation et impact sur ①
**≈ 1 j·h** avec la forme d'e-mail simple ci-dessus (pas de génération de lien, pas
de service_role dans l'émetteur). **Ré-estimation à tenir, comme `P1-016` l'annonce :**
la moitié « invitations » du lot `P1-016` (1,25) était en réalité le **câblage**
(0,25, fait) — l'émetteur lui-même n'y avait **presque pas de budget**. Ouvrir `P1-018`
le rend visible : **ce n'est pas une absorption silencieuse**. Impact ① à **ratifier
au moment de la fusion** (proposition : `P1-018` entre à 1 j·h, `P1-016` reste sur le
*build*/TestFlight ; ① passe de 114 à ~115). Le README porte le recompte ligne à
ligne, pas ce ticket.

## Critères d'acceptation
- [ ] Depuis l'écran d'effectif d'une box, un envoi expédie un e-mail à chaque
      invitation `PENDING`, en FR ou EN selon la locale, contenant l'instruction de
      connexion **avec l'adresse invitée** — aucun jeton dans l'URL
- [ ] Relancer n'envoie qu'aux **encore `PENDING`** (ni acceptées, ni expirées)
- [ ] Un envoi rejoué après coupure **ne renvoie pas** ce qui est déjà parti dans
      la vague (idempotence prouvée)
- [ ] `email_deliveries` porte l'envoi (adresse, réf., date, statut, id Brevo),
      **sans corps ni donnée de santé** ; `tenant_id`, RLS forcée, policies, grants,
      cas dans `rls_leak_test.sql`
- [ ] Un échec synchrone (adresse morte) est `FAILED` et **visible** par la box
- [ ] L'envoi se fait **par lot borné** (vagues possibles)
- [ ] `pnpm i18n:check` couvre les clés de l'e-mail et échoue si une manque
- [ ] **appareil / mise en service** : « 80 invitations qui partent pour de vrai »
      se prouve à la mise en service, la clé API Brevo posée — pas sur une PR verte

## Notes
Ne pas gonfler (garde-fou du lot) : **un émetteur, pas un framework**. Si
l'estimation dépasse ~1 j·h à l'ouverture, le signe est qu'on a commencé à écrire
`P2-015` — la couche thémée, le webhook de rebond, le lien magique — et il faut
s'arrêter. Le pilote a besoin d'un e-mail qui part et d'un journal qui dit qu'il est
parti, rien de plus.
