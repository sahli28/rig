# E-mail et domaine — `rack-app.fr` signé par Brevo

**Volet de `P1-016`.** Ce document est la source de vérité de l'**envoi d'e-mails du
pilote** : le prestataire, le canal de chaque e-mail, l'adresse d'expédition, les
enregistrements DNS du domaine, le câblage Supabase Auth, la capacité, et le durcissement
DMARC. Il est voisin de `deploiement-heberge.md`, qui pointe ici.

> **Aucun secret dans ce fichier.** Clé SMTP, clé API, mot de passe de compte : ils vivent
> dans le dashboard Brevo, le dashboard Supabase, ou un `.env` git-ignoré. Ce document dit
> **où** les poser et **comment**, jamais leur valeur. Personne ne colle une clé dans une
> conversation.

## Ce qui envoie les e-mails du pilote — deux e-mails, **deux canaux**

| E-mail | Ce que c'est | Canal | Justification côté crédential |
| --- | --- | --- | --- |
| **Magic link** | connexion des membres (Supabase Auth) | **SMTP de Supabase Auth** → relais Brevo | une **clé SMTP** Brevo |
| **Invitation** | entrée des 80 membres, porte le **jeton `D-005`** | **émetteur maison → API transactionnelle Brevo** (voir décision ci-dessous) | une **clé API** Brevo, **en plus** |

**Le push (`rack-push-emitter`) n'est pas concerné** : il route vers APNs/FCM, pas par
e-mail.

### Décision : par quel canal partent les invitations

`issueInvitation` (`apps/web/app/box/[slug]/staff/actions.ts`) **n'envoie aucun
e-mail** : il rend le jeton `D-005` en clair à l'écran, une fois. Pour livrer 80
invitations, deux voies :

- **A — `supabase.auth.admin.inviteUserByEmail`** : réutilise le SMTP déjà configuré,
  aucune clé de plus. **Mais** il crée un utilisateur Auth avant acceptation, force la
  box et le rôle à voyager dans `user_metadata`, et **abandonne le flux `D-005`** — dont
  les pages web (`apps/web/app/invitation/[token]/`) et mobile
  (`apps/mobile/app/(auth)/invitation/[token].tsx`) et la logique d'acceptation
  **existent déjà et sont testées**. On aurait deux chemins d'entrée parallèles (natif
  pour l'e-mail, jeton pour le QR mural).
- **B — émetteur maison via l'API transactionnelle Brevo** *(retenu)* : un envoyeur qui
  poste les **liens `D-005` existants** vers l'API Brevo. **Un seul chemin d'entrée**
  (e-mail et QR mural partagent `D-005`, révocable, haché, porteur de box+rôle), rien de
  l'auth n'est reshapé, et le lien est déjà rendu par `create_invitation()`.

**Retenu : B.** Pour une dev solo, un seul parcours d'onboarding vaut mieux que deux, et
B **réutilise du code déjà écrit et testé** au lieu de le mettre au rebut. L'envoyeur peut
être minimal (une action serveur / un script qui poste les 80 liens à l'API Brevo).

**Conséquence de crédential, à acter maintenant** *(c'est pourquoi la décision est ici et
pas après)* : la **clé SMTP** (magic link) **ne suffit pas** ; les invitations exigent
**aussi une clé API** Brevo. La clé SMTP se pose **maintenant** (pour Supabase Auth) ; la
**clé API se crée avec le lot invitations** (règle « pas de secret avant son appelant »).
Donc **configurer le SMTP du dashboard ne veut pas dire « e-mail entièrement câblé »** :
le canal invitation reste à bâtir. *(Si le lot invitations bute, revoir A.)*

## Le prestataire : Brevo (arbitré)

**Brevo** (ex-Sendinblue), français, hébergé UE. Offre gratuite ≈ 300 e-mails/jour.

La spec (§8) recommande Resend/Postmark et affirme « Postmark = meilleure délivrabilité
transactionnelle » — **sans le chiffrer**. À notre volume (voir Capacité), rien de mesuré
ne justifie Postmark/Resend, et **des SPF/DKIM/DMARC corrects pèsent bien plus que le
prestataire** sur la délivrabilité. Brevo l'emporte sur l'argument RGPD : société
française (CNIL), données en UE, DPA RGPD, pas de clauses contractuelles types. Registre :
`docs/rgpd/sous-traitants.md`.

## Capacité — les deux plafonds, chiffrés

Deux plafonds distincts, et ils ne comptent **pas les mêmes e-mails** :

- **Plafond horaire Supabase Auth** — ne voit **que les magic links** (les invitations
  passent par l'API Brevo, hors Supabase). Un cours qui se connecte ensemble = une grappe
  de ~15–25 magic links en quelques minutes. Activer un SMTP tiers relève le plafond de 2
  à 30/h ; le porter à **~100/h** absorbe une grappe.
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

**Si ça se resserre** (plus de membres plus tard, ou une ruée de connexions le même soir) :
envoyer les invitations en **vagues** (p. ex. 2 × 40 sur deux jours), ce qui lisse aussi la
vague de premières connexions ; sinon, monter d'un cran l'offre Brevo. **Ce qu'on ne fait
pas** : envoyer 80 invitations en supposant que toutes les connexions tombent dans la même
heure. Côté Supabase, garder le plafond horaire ≥ la taille d'une grappe réelle de cours.

## L'adresse d'expédition : `Rack <bonjour@rack-app.fr>` — figée

Reply-able, **jamais `no-reply`** : au pilote, une invitation est un premier contact.
**Le domaine signataire ne change plus** (la réputation d'expéditeur se construit sur lui) :
on le fige délibérément **maintenant**, `rack-app.fr`.

**« Reply-able » implique quelqu'un qui lit.** `bonjour@rack-app.fr` reçoit les réponses
des membres ; **désigner la personne qui la relève la première semaine** est un point des
**lots d'accompagnement de `P1-016`**, pas de ce volet technique.

## Transactionnel et marketing : séparés dès maintenant

Le domaine signataire étant figé, on écrit la séparation tout de suite (exigence spec) :

- **Transactionnel** — magic link, invitations — signe sur la **racine `rack-app.fr`**.
- **Marketing** — newsletters, campagnes, **plus tard, en v1** — signera sur un
  **sous-domaine dédié** (`news.rack-app.fr` ou `mktg.rack-app.fr`), authentification
  propre.

Pourquoi : une campagne marketing qui génère des plaintes ne doit **jamais** abîmer la
réputation qui porte le magic link. **Rien de marketing ne signe sur la racine.**

---

## Vérifications préalables — avant d'écrire le moindre enregistrement

Ne rien supposer : ces trois points décident la suite.

1. **La zone DNS est-elle hébergée chez OVH ?** Le domaine est *actif sur OVH*, mais le
   **registrar** et l'**hébergeur de zone DNS** peuvent différer. On pose SPF/DKIM/DMARC
   dans la **zone**. Vérifier dans l'espace OVH que la zone `rack-app.fr` y est éditable
   (sinon, l'éditer là où elle est réellement hébergée).
2. **Relever les MX et le SPF existants — AVANT d'écrire.** OVH crée souvent un MX et un
   SPF par défaut. **Un seul TXT SPF est autorisé par domaine** : c'est ce relevé qui
   décide s'il faut **fusionner** `include:spf.brevo.com` dans un SPF existant ou en créer
   un. Noter aussi les MX (ils servent la réception de `bonjour@`/`postmaster@`).
3. **Créer les boîtes `bonjour@` et `postmaster@`.** Ce sont des **boîtes à créer** (email
   OVH ou redirection), pas des adresses qui existent parce qu'on les écrit : `bonjour@`
   reçoit les réponses, `postmaster@` reçoit les rapports DMARC agrégés. Sans elles, les
   réponses et les rapports tombent dans le vide.

## Liste one-shot — à exécuter (l'utilisatrice pose les valeurs)

### 1. Compte Brevo + authentification du domaine
1. Créer le compte **Brevo**.
2. Authentifier `rack-app.fr` : Brevo → **Senders, Domains & Dedicated IPs → Domains →
   Authenticate this domain**. Brevo affiche les enregistrements DNS à poser (§3).

### 2. Clé SMTP Brevo *(magic link — maintenant)*
Brevo → **SMTP & API → SMTP → Generate a new SMTP key**.
- Le **mot de passe SMTP** = cette clé. **Ni la clé API, ni le mot de passe du compte.**
- Noter le **login SMTP** affiché (c'est le `user`).
- *(La **clé API** pour les invitations se crée avec le lot invitations — voir la décision
  ci-dessus. Pas maintenant.)*

### 3. Enregistrements DNS — dans la zone OVH de `rack-app.fr`

| Type | Nom (hôte) | Valeur | Source |
| --- | --- | --- | --- |
| **TXT** | `@` (racine) | `brevo-code:…` | **verbatim du dashboard Brevo** — propre au compte |
| **CNAME ×2** *ou* **TXT** | `brevo1._domainkey` / `brevo2._domainkey` *ou* `mail._domainkey` | clé publique DKIM Brevo | **verbatim du dashboard Brevo** — **à copier, jamais taper** |
| **TXT** | `_dmarc` | `v=DMARC1; p=none; rua=mailto:postmaster@rack-app.fr; fo=1; adkim=r; aspf=r` | **notre record** |
| **TXT** | `@` (racine) | SPF avec `include:spf.brevo.com` | **notre record** — **fusionner** avec le SPF OVH existant (vérif. préalable 2) |

**Ce qui aligne `rack-app.fr`, c'est le DKIM — pas le SPF.** Sur l'IP **partagée** de
Brevo, le Return-Path porte le domaine de Brevo, donc **SPF n'aligne pas** sur notre
domaine ; DMARC passe par l'**alignement DKIM**. Donc :
- le DKIM Brevo **doit** être posé correctement (c'est lui qui fait `DMARC = pass`) ;
- le SPF est un **complément** ; **un seul TXT SPF** — fusionner, ne pas dédoubler ;
- forme DKIM selon le compte : Brevo propose deux **CNAME** (2048 bits, défaut) ou un
  **TXT** `mail._domainkey` (1024 bits). Poser ce que **le dashboard affiche**.

Après la pose, revenir dans Brevo → **Verify / Authenticate** (propagation OVH : minutes à
heures).

### 4. Câbler Supabase Auth SMTP (hébergé)

Dashboard Supabase (`llakbulflemibnfagnyh`) → **Authentication → Emails → SMTP Settings** →
« Enable Custom SMTP » :

| Champ | Valeur |
| --- | --- |
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | le **login SMTP** Brevo (§2) |
| Password | la **clé SMTP** Brevo (§2) |
| Sender email | `bonjour@rack-app.fr` |
| Sender name | `Rack` |

Puis **Authentication → Rate Limits → emails per hour** → **~100/h** (voir Capacité).
*(Le `email_sent = 2` de `supabase/config.toml` ne gouverne que le local.)*

**Parité locale** : le bloc `[auth.email.smtp]` est déjà versionné (commenté) dans
`supabase/config.toml`. Le local reste sur Mailpit ; rien à faire ici.

---

## DMARC — on entre en service en `p=none`, assumé

**On démarre et on entre en service en `p=none`** (observation). Ce n'est pas subi, c'est
la seule séquence possible : **durcir suppose d'observer du trafic réel, qui n'existe
qu'à partir de la mise en service** (avant, presque aucun e-mail ne part en notre nom).
Un `p=reject` posé sur un DKIM mal configuré ferait **disparaître silencieusement** les
magic links — l'inverse du but. On **assume** donc d'ouvrir la box en `p=none`, puis on
durcit sur les rapports `rua` du trafic réel.

Calendrier daté contre la mise en service — **~fin octobre / début novembre 2026**
au rythme actuel (projection de `docs/backlog/README.md`, recomptée le 12 sept. :
12,25 j·h restants ÷ 2,3/sem. ≈ 5,3 semaines). **Si cette date bouge, ce calendrier
bouge avec elle** :

| Palier | Record `_dmarc.rack-app.fr` | Quand |
| --- | --- | --- |
| 1 — observation | `v=DMARC1; p=none; rua=mailto:postmaster@rack-app.fr; fo=1; adkim=r; aspf=r` | **posé dès maintenant** (sept. 2026), **maintenu à la mise en service** |
| 2 — quarantaine | `… p=quarantine; pct=100 …` | **~2 semaines après la mise en service** (~mi-novembre), si les rapports montrent **0 échec DKIM légitime** |
| 3 — rejet | `… p=reject …` | **quelques semaines plus tard** (déc.+), rapports toujours propres |

`postmaster@rack-app.fr` (cible `rua`) **doit être une boîte réelle** (vérif. préalable 3).
Le **domaine signataire ne change pas** entre paliers — seule la politique `p=` monte.
Journaliser ici chaque changement (date, palier, ce que disaient les rapports).

## Prouver le domaine — ce qui débloque le ✅ du chemin critique

Une fois DNS + SMTP en place :
1. Déclencher un **magic link** vers une adresse de test contrôlée.
2. Vérifier qu'il **arrive** (pas en spam) **et** que l'en-tête porte `SPF`/`DKIM`/`DMARC
   = pass` — Gmail « Afficher l'original », ou `mail-tester.com` (score /10).

**Preuve de mise en service, pas vert de CI.** Quand elle est faite :
- passer la ligne « Un nom de domaine (+ SPF, DKIM, DMARC) » du chemin critique
  (`docs/backlog/README.md`) en **✅**, comme Apple et Expo ;
- fermer les critères de `P1-017` qui l'attendaient : « lien de connexion avec un vrai
  e-mail reçu » et « le SMTP tiers lui-même ».

## Ce qui vit hors du dépôt

| Élément | Où | Note |
| --- | --- | --- |
| Login + clé SMTP Brevo | dashboard Brevo ; dashboard Supabase (SMTP Settings) ; `.env` git-ignoré si envoi local | jamais commité |
| **Clé API Brevo** (`BREVO_API_KEY`, invitations `P1-018`) | **variable d'env serveur Vercel** (jamais dans le bundle client) ; `.env.local` en dev | jamais commitée — c'est l'action `sendInvitations` (`apps/web/.../membres`) qui la lit |
| **URL d'entrée de l'app** (`RACK_INVITE_URL`) | variable d'env serveur Vercel ; `.env.local` en dev | **non secret** ; le lien « Ouvrir Rack » de l'e-mail (TestFlight/App Store au pilote) |
| Enregistrements DNS | zone OVH de `rack-app.fr` | non secrets ; DKIM/Brevo-code propres au compte |
| Boîtes `bonjour@` / `postmaster@` | email OVH (ou redirection) | à créer ; réponses membres + rapports DMARC |
