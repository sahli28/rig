# E-mail et domaine — `rack-app.fr` signé par Brevo

**Volet de `P1-016`.** Ce document est la source de vérité de l'**envoi d'e-mails du
pilote** : le prestataire, le canal de chaque e-mail, l'adresse d'expédition, les
enregistrements DNS du domaine, le câblage Supabase Auth, la capacité, et le durcissement
DMARC. Il est voisin de `deploiement-heberge.md`, qui pointe ici.

> **Aucun secret dans ce fichier.** Clé SMTP, clé API, mot de passe de compte : ils vivent
> dans le dashboard Brevo, le dashboard Supabase, ou un `.env` git-ignoré. Ce document dit
> **où** les poser et **comment**, jamais leur valeur. Personne ne colle une clé dans une
> conversation.

## État réel — la chaîne est prouvée (12 septembre 2026)

**Ce n'est plus une liste à exécuter : le magic link part signé et arrive.** Preuve de
mise en service, faite hors dépôt le 12 septembre 2026 : un magic link déclenché vers une
adresse de test est arrivé en boîte de réception (pas en spam), en-tête à l'appui —
**`SPF = pass`, `DKIM = pass` (`d=rack-app.fr`, sélecteur `brevo2`), `DMARC = pass`**,
expéditeur `Rack <bonjour@rack-app.fr>`, **code à 6 chiffres** dans le corps.
**`mail-tester.com` : 7,9/10** (la cause exacte des 2,1 manquants est écrite plus bas — un
pixel de suivi, sans effet sur l'authentification ni la remise).

Ce qui débloque : la ligne « Un nom de domaine (+ SPF, DKIM, DMARC) » du chemin critique
(`docs/backlog/README.md`) passe **✅** comme Apple et Expo, et les deux critères de
`P1-017` qui l'attendaient (« lien de connexion avec un vrai e-mail reçu », « le SMTP tiers
lui-même ») sont fermés.

**Cinq choses ont différé du plan ci-dessous, et sont corrigées dans ce document :**

1. l'expéditeur `bonjour@rack-app.fr` a été **vérifié d'office** par l'authentification du
   domaine — **aucun e-mail de validation d'expéditeur** n'est envoyé dans ce cas (le plan
   le supposait) ;
2. un **sous-domaine de marque `mail.rack-app.fr`** a été posé (option Brevo). Conséquence :
   l'ancien passage « SPF n'aligne pas, seul DKIM aligne » est **faux** — le Return-Path est
   `bounces-…@mail.rack-app.fr`, donc **SPF s'aligne aussi** (voir « Alignement DMARC ») ;
3. les **gabarits d'e-mail ne sont pas versionnés côté hébergé** — trou trouvé et refermé à
   la main (voir « Gabarits d'e-mail ») ;
4. l'**OTP hébergé** était sur le défaut Supabase (8 chiffres) alors que le projet parle du
   « code à six chiffres » — corrigé à 6 (voir « Parité des réglages hébergés ») ;
5. le **suivi d'ouverture** Brevo n'est pas désactivable sur le transactionnel — il a été
   **anonymisé** (voir « Suivi, désabonnement et Blocklist »), ce qui a une conséquence RGPD
   écrite dans `docs/rgpd/sous-traitants.md`.

## Ce qui envoie les e-mails du pilote — deux e-mails, **deux canaux**

| E-mail | Ce que c'est | Canal | Justification côté crédential |
| --- | --- | --- | --- |
| **Magic link** | connexion des membres (Supabase Auth) | **SMTP de Supabase Auth** → relais Brevo | une **clé SMTP** Brevo |
| **Invitation** | entrée des 80 membres — **« connectez-vous avec cette adresse »**, **aucun jeton** | **émetteur maison → API transactionnelle Brevo** (`P1-018`) | une **clé API** Brevo, **en plus** |

**Le push (`rack-push-emitter`) n'est pas concerné** : il route vers APNs/FCM, pas par
e-mail.

### Le canal des invitations : appariement d'e-mail, **pas** jeton `D-005`

**Correction d'une décision antérieure (règle 8, tranchée à l'ouverture de `P1-018`).** Ce
runbook disait : « émetteur maison qui poste les **liens `D-005` existants** ». Le **canal**
(API Brevo) est juste ; le « flux `D-005` » est **faux pour la masse**, vérifié dans le
dépôt :

- `import_members()` crée des invitations `PENDING` **sans faire circuler aucun jeton**.
  L'effectif importé rejoint par **`accept_pending_invitation()`** — en **se connectant
  avec l'adresse invitée**, que la fonction apparie à l'invitation `PENDING`. Aucun jeton
  dans l'URL de l'e-mail.
- Le **jeton `D-005`** en clair (`create_invitation()`) reste le chemin des invitations
  **individuelles** et du **QR mural d'affiliation** — montré une fois, jamais relisible.
  Ce sont donc les seuls appelants restants des pages `invitation/[token]` (web et mobile)
  et de `D-008` ; **pas les 80 membres**.

**Conséquence pour la box, à porter dans l'accompagnement de `P1-016` :** l'appariement par
e-mail impose que l'adresse du CSV soit **exactement** celle avec laquelle la personne se
connecte. Une faute de frappe dans le fichier de la box = un compte qui se crée **hors de
toute box**, sans message d'erreur compréhensible. La qualité du fichier d'effectif est
donc un point d'attention, et les invitations restées `PENDING` après J+2 sont le signal à
regarder.

**Conséquence de crédential :** la **clé SMTP** (magic link) **ne suffit pas** ; les
invitations exigent **aussi une clé API** Brevo, distincte, lue par l'action
`sendInvitations` (`apps/web/.../membres`) en variable d'env serveur (`BREVO_API_KEY`).

## Le prestataire : Brevo (arbitré)

**Brevo** (ex-Sendinblue), français, hébergé UE. **Compte créé, offre gratuite (~300
e-mails/jour).**

La spec (§8) recommande Resend/Postmark et affirme « Postmark = meilleure délivrabilité
transactionnelle » — **sans le chiffrer**. À notre volume (voir Capacité), rien de mesuré
ne justifie Postmark/Resend, et **des SPF/DKIM/DMARC corrects pèsent bien plus que le
prestataire** sur la délivrabilité — ce que la preuve du 12 sept. confirme
(`DMARC = pass`). Brevo l'emporte sur l'argument RGPD : société française (CNIL), données
en UE, DPA RGPD, pas de clauses contractuelles types. Registre :
`docs/rgpd/sous-traitants.md`.

## Capacité — les deux plafonds, chiffrés

Deux plafonds distincts, et ils ne comptent **pas les mêmes e-mails** :

- **Plafond horaire Supabase Auth** — ne voit **que les magic links** (les invitations
  passent par l'API Brevo, hors Supabase). Un cours qui se connecte ensemble = une grappe
  de ~15–25 magic links en quelques minutes. Activer un SMTP tiers relève le plafond de 2
  à 30/h ; **porté à 100/h** (fait), il absorbe une grappe.
- **Quota quotidien Brevo (~300/jour, offre gratuite)** — voit **tout** : invitations
  (API) **et** magic links (SMTP relayé par Brevo).

**Estimation jour 1 (mise en service)** :

| Poste | Canal | Volume J1 |
| --- | --- | --- |
| 80 invitations | API Brevo | 80 |
| Magic links des membres qui cliquent (~½ à ¾ le 1ᵉʳ jour) | Supabase Auth → Brevo | ~40–60 |
| Bounces (adresses mortes du fichier box) | — | quelques-uns |
| **Total J1 côté Brevo** | | **~130–150 / 300** |

Marge confortable. **J2+** : relance des non-inscrits (~20–30, une vague) + magic links du
flux courant (~20–30/jour) — loin sous 300.

**Si ça se resserre** : envoyer les invitations en **vagues** (l'émetteur borne à 20 par
invocation, voir `P1-018`), ce qui lisse aussi la vague de premières connexions ; sinon,
monter d'un cran l'offre Brevo. **Ce qu'on ne fait pas** : envoyer 80 invitations en
supposant que toutes les connexions tombent dans la même heure.

## L'adresse d'expédition : `Rack <bonjour@rack-app.fr>` — figée

Reply-able, **jamais `no-reply`** : au pilote, une invitation est un premier contact.
**Le domaine signataire ne change plus** (la réputation d'expéditeur se construit sur lui) :
figé délibérément, `rack-app.fr`.

**Expéditeur vérifié d'office.** L'authentification du domaine (DKIM + Return-Path)
**vérifie `bonjour@rack-app.fr` automatiquement** : Brevo n'envoie **aucun e-mail de
validation d'expéditeur** dans ce cas — contrairement à ce que le plan supposait, il n'y a
pas de lien à cliquer.

**« Reply-able » implique quelqu'un qui lit, et une boîte qui reçoit.** Une **boîte Zimbra
`bonjour@rack-app.fr`** (offre Starter incluse au domaine OVH) reçoit les réponses des
membres ; **`postmaster@rack-app.fr` est une redirection** (rapports DMARC agrégés).
Désigner la personne qui relève `bonjour@` la première semaine reste un point des lots
d'accompagnement de `P1-016`.

> **Piège OVH / Zimbra, payé une fois.** L'assistant Zimbra d'OVH veut la **« configuration
> personnalisée »** avec la **case SPF décochée**. Coché, il **réécrit le SPF fusionné** du
> domaine et casse l'alignement — exactement le SPF qu'on a posé à la main pour Brevo. Le SPF
> fusionné à préserver est : `v=spf1 include:mx.ovh.com include:spf.brevo.com -all` (OVH pour
> la réception Zimbra, Brevo pour l'envoi, un seul TXT).

## Transactionnel et marketing : séparés dès maintenant

Le domaine signataire étant figé, la séparation est écrite (exigence spec) :

- **Transactionnel** — magic link, invitations — signe sur la **racine `rack-app.fr`**.
- **Marketing** — newsletters, campagnes, **plus tard, en v1** — signera sur un
  **sous-domaine dédié** (`news.rack-app.fr` / `mktg.rack-app.fr`), authentification propre.

Pourquoi : une campagne marketing qui génère des plaintes ne doit **jamais** abîmer la
réputation qui porte le magic link. **Rien de marketing ne signe sur la racine.**

> **À ne pas confondre avec `mail.rack-app.fr`.** Le sous-domaine de marque `mail.` posé
> pour Brevo (suivi, Return-Path des bounces) n'est **pas** le sous-domaine marketing : il
> sert le **transactionnel** et améliore l'alignement (voir « Alignement DMARC »). Le
> marketing, lui, aura son propre sous-domaine, plus tard.

---

## Ce qui est posé — l'état réel de la configuration

### 1. Compte Brevo + authentification du domaine — **fait**
Compte Brevo créé (offre gratuite). `rack-app.fr` authentifié (Brevo → *Senders, Domains &
Dedicated IPs → Domains*), sous-domaine de marque `mail.rack-app.fr` activé.

### 2. Clés Brevo — **une SMTP (posée), une API (avec `P1-018`)**
- **Clé SMTP** (magic link) : Brevo → *SMTP & API → SMTP*. Posée dans Supabase (§4).
- **Clé API** (invitations) : Brevo → *SMTP & API → Clés API* — **distincte** de la clé
  SMTP. Créée **avec le lot invitations** (`P1-018`) ; posée en variable Vercel
  `BREVO_API_KEY` (voir « Le point d'entrée des 80 »).

### 3. Enregistrements DNS posés — zone OVH de `rack-app.fr`

| Type | Nom (hôte) | Valeur (cible) |
| --- | --- | --- |
| **TXT** | `@` (racine) | `brevo-code:…` (verbatim du dashboard, propre au compte) |
| **CNAME** | `brevo1._domainkey` | `b1.rack-app-fr.dkim.brevo.com.` |
| **CNAME** | `brevo2._domainkey` | `b2.rack-app-fr.dkim.brevo.com.` |
| **CNAME** | `mail` | `mail-rack-app-fr.brand.brevosend.com.` |
| **CNAME** | `r.mail` | `mail-rack-app-fr.r.brand.brevosend.com.` |
| **CNAME** | `img.mail` | `mail-rack-app-fr.img.brand.brevosend.com.` |
| **TXT** | `@` (racine) | SPF **fusionné** avec `include:spf.brevo.com` (un seul TXT SPF) |
| **TXT** | `_dmarc` | `v=DMARC1; p=none; rua=mailto:postmaster@rack-app.fr; fo=1; adkim=r; aspf=r` |

> **Piège OVH, payé une fois.** Le **point final est obligatoire** sur chaque cible CNAME
> (`…brevo.com.`, `…brevosend.com.`) : sans lui, OVH **accole le domaine** (`…brevo.com.rack-app.fr`)
> et l'entrée est cassée **sans que rien ne le signale**.

Le sélecteur DKIM effectivement aligné à la preuve est **`brevo2`** (les deux CNAME DKIM
sont posés ; Brevo signe avec l'un d'eux).

### 4. Supabase Auth SMTP (hébergé) — **posé**

Dashboard Supabase (`llakbulflemibnfagnyh`) → *Authentication → Emails → SMTP Settings* →
« Enable Custom SMTP » :

| Champ | Valeur |
| --- | --- |
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | `b904d5001@smtp-brevo.com` (login SMTP Brevo) |
| Password | la **clé SMTP** Brevo (§2) — dans le dashboard, jamais ici |
| Sender email | `bonjour@rack-app.fr` |
| Sender name | `Rack` |

*Authentication → Rate Limits → emails per hour* → **100** (fait ; voir Capacité).
*(Le `email_sent` de `supabase/config.toml` ne gouverne que le local, resté sur Mailpit.)*

### 5. Gabarits d'e-mail — **non versionnés côté hébergé, recopiés à la main**

**Trou trouvé le 12 septembre, et il aurait échoué en silence.** `supabase/templates/*.html`
ne valent **qu'en local** : l'hébergé envoyait les gabarits **par défaut** de Supabase, qui
portent `{{ .ConfirmationURL }}` et **pas `{{ .Token }}`**. Un membre mobile, qui saisit un
**code**, n'aurait eu **aucun code** à saisir — et rien ne l'aurait montré avant le lundi
matin.

Les **deux gabarits** ont été collés à la main dans le dashboard (*Authentication → Emails
→ Templates*) :

- **Magic Link** (aussi « Magic link or OTP ») ;
- **Confirm sign up**.

> **Règle de tenue :** toute modification de `supabase/templates/*.html` doit être
> **recopiée à la main** dans ces deux gabarits du dashboard. Le dépôt n'est **pas** la
> source de vérité de l'hébergé sur ce point — jusqu'à ce qu'un jour on automatise la
> synchro (hors périmètre pilote).

### 6. Parité des réglages hébergés — **OTP à 6 chiffres**

L'hébergé était sur le **défaut Supabase (8 chiffres)** alors que `supabase/config.toml`
déclare `otp_length = 6` et que tout le projet parle du **« code à six chiffres »**.
**Corrigé à 6** (*Authentication → Providers → Email → OTP length*). À vérifier au même
titre que le SMTP à toute recréation du projet — c'est un réglage de dashboard, pas une
migration.

---

## Alignement DMARC — SPF **et** DKIM alignent (sous-domaine de marque)

**Correction de l'ancienne affirmation « seul DKIM aligne ».** Elle valait pour une IP
partagée Brevo sans sous-domaine de marque : le Return-Path portait alors le domaine de
Brevo, `SPF n'alignait pas`, et DMARC ne passait que par l'**alignement DKIM**.

Depuis la pose du **sous-domaine de marque `mail.rack-app.fr`**, le **Return-Path est
`bounces-…@mail.rack-app.fr`** — un sous-domaine de `rack-app.fr` — donc **SPF s'aligne
aussi** (vérifié dans l'en-tête de la preuve : `SPF = pass` **et** `DKIM = pass`, `DMARC =
pass`). Les deux mécanismes d'alignement sont désormais bons, pas seulement DKIM.

Ce qui reste vrai : **un seul TXT SPF** par domaine (fusionner, ne jamais dédoubler), et le
DKIM Brevo doit rester posé (c'est lui, historiquement, qui portait `DMARC = pass`).

## DMARC — on entre en service en `p=none`, assumé

**On démarre et on entre en service en `p=none`** (observation). Durcir suppose d'observer
du trafic réel, qui n'existe qu'à partir de la mise en service. Un `p=reject` posé sur un
DKIM mal configuré ferait **disparaître silencieusement** les magic links. On ouvre donc en
`p=none`, puis on durcit sur les rapports `rua`.

Calendrier daté contre la mise en service — **~fin octobre / début novembre 2026** au
rythme actuel (projection de `docs/backlog/README.md`, recomptée le 12 sept. :
**12,25 j·h restants ÷ 2,3/sem. ≈ 5,3 semaines**). **Si cette date bouge, ce calendrier
bouge avec elle** :

| Palier | Record `_dmarc.rack-app.fr` | Quand |
| --- | --- | --- |
| 1 — observation | `v=DMARC1; p=none; rua=mailto:postmaster@rack-app.fr; fo=1; adkim=r; aspf=r` | **posé** (sept. 2026), maintenu à la mise en service |
| 2 — quarantaine | `… p=quarantine; pct=100 …` | **~2 semaines après la mise en service** (~mi-novembre), si les rapports montrent **0 échec DKIM/SPF légitime** |
| 3 — rejet | `… p=reject …` | **quelques semaines plus tard** (déc.+), rapports toujours propres |

`postmaster@rack-app.fr` (cible `rua`) est une **redirection réelle** (voir Adresse
d'expédition). Le **domaine signataire ne change pas** entre paliers — seule la politique
`p=` monte. Journaliser ici chaque changement (date, palier, ce que disaient les rapports).

---

## Suivi, désabonnement et Blocklist — vérifié, ce n'est pas un réglage manqué

**Le suivi d'ouverture n'est pas désactivable** sur le transactionnel Brevo (limite connue
du produit). Le **suivi anonymisé** a été activé (*Settings → Automations → Transactional
emails → Tracking*) : plus de conservation de l'adresse, de l'IP, du message ID ni des
liens cliqués. **À écrire tel quel dans `docs/rgpd/sous-traitants.md`** pour la ligne Brevo
— le traitement existe, il est anonymisé, il n'est **pas** désactivable.

**Le pixel de suivi demeure**, et il coûte **~2 points** à `mail-tester` (`HTML_IMAGE_ONLY_12`
−1,63 ; images sans `alt` −0,5) → **7,9/10**. **Sans impact sur l'authentification ni la
remise**, toutes deux prouvées. *Documenté ici pour ne pas être re-diagnostiqué dans six
semaines comme un problème de délivrabilité : ce n'en est pas un.*

**`List-Unsubscribe` n'est pas retirable** (Brevo l'ajoute au transactionnel). Parade =
une **procédure de support**, pas un correctif :

> **« Je ne reçois plus mon code de connexion »** → **vérifier la Blocklist Brevo**
> (*Contacts → Blocklist*) **AVANT tout autre diagnostic.** Un membre qui a cliqué « se
> désabonner » y figure et **doit en être retiré**. Sans cette étape, le symptôme est
> indiscernable d'un bug d'envoi.

*(La trouvaille « Lien envoyé » affiché alors que l'e-mail porte un code n'a
**jamais eu besoin de son `D-0xx`** : `P1-021` l'a absorbée le 12 sept. — la copie
web dit désormais « E-mail envoyé… clique le lien (il montre aussi un code, pour
l'app mobile) », et l'objet porte le code, unique à chaque envoi, donc plus de fil
Gmail où recopier un code périmé.)*

## Dates d'expiration à surveiller — elles se paient en panne silencieuse

| Élément | Expire | Symptôme si oublié |
| --- | --- | --- |
| **Clé SMTP Brevo « supabase-auth »** | **12 septembre 2027**, **et après 90 jours d'inactivité** | les liens de connexion **cessent de partir**, sans erreur ailleurs que dans les logs Supabase |
| **Clé API Brevo « rack-invitations »** | **12 septembre 2027**, **et après 90 jours d'inactivité** | l'action `sendInvitations` échoue ; les invitations ne partent plus (visible, au moins, dans le résultat de l'écran) |
| Compte développeur Apple | **8 septembre 2027** (renouvellement auto) | *déjà noté au chemin critique* |

Le seuil des **90 jours d'inactivité** de la clé SMTP est le plus vicieux : une box en
creux d'activité (vacances) peut le franchir sans qu'on y pense.

---

## La preuve du domaine — **faite** (12 septembre 2026)

DNS + SMTP en place, magic link déclenché vers une adresse de test :

1. **arrivé** en boîte de réception (pas en spam) ;
2. en-tête : **`SPF = pass`, `DKIM = pass` (`d=rack-app.fr`, sélecteur `brevo2`),
   `DMARC = pass`**, expéditeur `Rack <bonjour@rack-app.fr>`, **code à 6 chiffres** ;
3. **`mail-tester` : 7,9/10** (les 2,1 manquants = le pixel de suivi, voir plus haut).

**Preuve de mise en service, pas vert de CI.** Elle débloque :
- la ligne « Un nom de domaine (+ SPF, DKIM, DMARC) » du chemin critique
  (`docs/backlog/README.md`) → **✅** (12 sept. 2026) ;
- les critères de `P1-017` qui l'attendaient (« lien de connexion avec un vrai e-mail
  reçu », « le SMTP tiers lui-même ») → **fermés**.

---

## Le point d'entrée des 80 : `RACK_INVITE_URL` = TestFlight — **qui n'existe pas encore**

**Pilote iOS-seul (tranché le 12 sept. 2026).** L'e-mail d'invitation dit « connectez-vous
avec cette adresse » et porte `RACK_INVITE_URL` : au pilote, **le lien TestFlight public**.
La personne installe l'app, l'ouvre, demande son magic link avec son adresse, et
`accept_pending_invitation()` l'apparie. **Pas de page d'atterrissage à écrire** — le pilote
ne couvre qu'iOS.

> **Dépendance révélée, à porter noir sur blanc.** Ce lien TestFlight **n'existe pas
> encore** : aucun build n'est soumis, le lot **« development build iOS + TestFlight »** de
> `P1-016` (1,25 j·h) n'est pas joué. **L'envoi des 80 invitations est donc bloqué par le
> build TestFlight**, alors que le code de `P1-018` est fermé. Ce n'est pas un défaut, c'est
> une dépendance — mais « l'émetteur est fait » **ne veut pas dire** « les invitations
> peuvent partir ». Voir `P1-016`.

**Ce qui reste exerçable sans TestFlight :** la **preuve à 3 adresses** de `P1-018`
fonctionne avec **n'importe quelle URL** (même celle du back-office) — elle prouve
**l'envoi et l'idempotence**, pas le parcours du membre.

**Valeur posée le 12 sept. 2026 (provisoire).** `RACK_INVITE_URL` = `https://rack-web-rack8.vercel.app/login`
en attendant le lien TestFlight. **Deux réserves** à lever avant les 80 :
- c'est l'**espace admin**, pas la porte d'un membre — provisoire pour la preuve, **à
  remplacer** par le lien TestFlight (voir `P1-020`/`P1-022` : après connexion, l'accueil
  doit mener quelque part) ;
- le déploiement du 12 sept. n'a aliasé que **`rack-web-eight.vercel.app`** ; **vérifier si
  `rack-web-rack8.vercel.app` sert encore le build du 11 sept.** et, si oui, pointer
  `RACK_INVITE_URL` vers `rack-web-eight` (ou le domaine, une fois posé) — sinon l'e-mail
  mène à un build périmé.

## Le déploiement web n'est **pas** automatique

**Une fusion sur `main` ne redéploie rien.** La connexion GitHub de Vercel a échoué au
`link` (voir `deploiement-heberge.md`) : `rack-web-rack8.vercel.app` sert le build du
**11 sept.** jusqu'à ce que quelqu'un relance, **depuis la racine du dépôt** :

```bash
npx vercel deploy --prod --scope rack8 --yes
```

**Conséquence à tenir :** le critère « le back-office est atteignable depuis l'ordinateur
de la box » peut être **vert sur un build périmé**. Tout changement de `apps/web` destiné au
pilote (dont `RACK_INVITE_URL`, `BREVO_API_KEY`) exige un **redéploiement explicite** — et
les variables d'env doivent être posées **avant** le déploiement pour y être embarquées.
*(Rebrancher Vercel sur GitHub vaut d'être retenté une fois avant la mise en service, pour
retirer cette étape manuelle — mais tant que ce n'est pas fait, le déploiement est un
geste, pas un automatisme.)*

## Ce qui vit hors du dépôt

| Élément | Où | Note |
| --- | --- | --- |
| Login + clé SMTP Brevo | dashboard Brevo ; dashboard Supabase (SMTP Settings) | jamais commité ; **expire le 12 sept. 2027 / 90 j d'inactivité** |
| **Clé API Brevo** (`BREVO_API_KEY`, invitations `P1-018`) | **variable Vercel serveur, Sensitive** (jamais dans le bundle client) ; `.env.local` en dev | jamais commitée — lue par l'action `sendInvitations` |
| **`RACK_INVITE_URL`** | variable Vercel serveur, **plaintext**, prod **et** preview | **non secret** ; au pilote iOS = **lien TestFlight public** (à créer, voir plus haut) |
| Enregistrements DNS | zone OVH de `rack-app.fr` | non secrets ; DKIM/Brevo-code propres au compte ; **point final obligatoire sur les CNAME** |
| Boîte Zimbra `bonjour@` / redirection `postmaster@` | email OVH (Zimbra Starter) | réponses membres + rapports DMARC ; **assistant Zimbra : SPF décoché** |
| Gabarits d'e-mail hébergés | dashboard Supabase (Magic Link, Confirm sign up) | **non versionnés** — recopier à la main toute modif de `supabase/templates/*.html` |
