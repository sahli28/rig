# Backlog exécutable

Un fichier par ticket. Un ticket = une session Claude Code = une branche = un commit.
On lance un ticket avec `/ticket P0-001`. Le gabarit est `_gabarit.md`, et sa
section « Ce que ce ticket suppose et qui doit exister » est **obligatoire**
(règle 8 de `CLAUDE.md`).

## Reprise de session

Pour un agent ou une personne qui arrive : lire `CLAUDE.md`, puis ce README,
puis **le ticket en tête de l'ordre du jalon** (section « ① Jalon pilote →
Ordre », ligne « CE QUI RESTE »). **L'état du projet vit ici et nulle part
ailleurs** — un ticket dit ce qu'il fait, ce README dit où on en est, et les
passes se datent dans `docs/passe-mobile-iphone.md` et `docs/passe-manuelle-web.md`.
Règle 11 de `CLAUDE.md` avant d'écrire un document de plus : le prochain merge
porte du code.

## Deux horizons, et il faut cesser de les confondre

Ce README n'en montrait qu'un — celui du pilote — et on pouvait croire que
c'était le produit. Ce n'est pas le produit : c'est **la moitié qui ne se vend
pas**.

| Horizon | Ce qu'il prouve | Ce qu'une box peut faire | Reste à faire |
| ------- | --------------- | ------------------------ | ------------: |
| **① Jalon pilote** | que l'outil sert, en vrai, tous les jours | réserver, annuler, faire la queue, pointer | **21,25 j·h** |
| **② MVP vendable** | qu'une box s'inscrit, encaisse et programme **sans nous** | payer, programmer, logguer, se classer, voir son CA | **+ 80,5 j·h** |

Au rythme de **2,3 j·h par semaine** (15–20 h effectives) : jalon pilote vers
**janvier 2027**, MVP vendable vers **septembre 2027**. Ces dates sont ce
qu'elles sont ; les connaître vaut mieux que les découvrir.

> **L'écart entre le calcul et la date a un nom depuis le 9 septembre 2026.**
> 19,5 ÷ 2,3 ≈ 8,5 semaines, donc début novembre — et le jalon est annoncé en
> janvier. Ce n'est pas le calcul qui est faux : **le jalon ne dit pas « le code
> est fini », il dit « mise en production chez la box pilote »**. Ce que janvier
> contient et que ① ne contenait pas, c'est `P1-016` — le projet hébergé, le
> déploiement, l'app sur les téléphones des membres, la configuration avec la
> box, l'import de ses ~80 membres, et la présence en salle la première semaine.
> **C'était dans la date et dans aucun ticket** : la forme la plus coûteuse d'un
> travail manquant, parce qu'elle ne se découvre qu'au moment où on croyait avoir
> fini. Depuis que ses 3 j·h de technique sont dans ①, le calcul donne
> 22,5 ÷ 2,3 ≈ 10 semaines — plus près de la date, sans l'atteindre, et c'est
> normal : les 4 jours d'accompagnement n'y sont pas, et **ne doivent pas y
> être**. Ils se comptent en créneaux chez quelqu'un d'autre, pas en j·h. Elles ont avancé
d'un mois le 3 septembre 2026 : P1-002 et le lot SQL de P1-003 sont fusionnés.

**Revue de backlog du 5 septembre 2026 (soir).** Le tableau d'état disait
`P1-014 : à faire` alors que PR #42 est sur `main` : le commit de code n'a pas
touché ce README, seul le commit `docs` qui l'a précédé l'a fait. Et la
répartition faits/restants n'avait pas été recalculée après P1-004 — elle était
fausse de 4 j·h, exactement l'estimation de ce ticket. Corrigé : **74,25 faits,
30 restants**, total ① inchangé à 104,25. Quatre chiffres différents coexistaient
dans ce fichier (34,5 · 36,5 · 37,5 · 102,25) ; il n'en reste qu'un.

**Revue du 6 septembre 2026.** `D-017` écrit (rétroactif, 0,25 — deuxième
disparition de travail dans un ticket clos), **D11 confirmée** par la
commanditaire : P2-009 passe de 6 à 8 j·h et porte désormais les quatre
décisions de forme de l'addendum §21. `P2-013b` créé sur une demande d'usage —
le module de records de HustleUp — et il déplace une dépendance que personne
n'avait relue : **P2-011 dépend des records, pas des scores.**

**Revue du 6 septembre 2026 (soir), à l'ouverture de P1-005.** Le ticket n'avait
pas sa section « ce que ce ticket suppose » — règle 8 — et l'écrire a trouvé
trois choses avant la première ligne de code : la publication
`supabase_realtime` **n'existe nulle part** dans `supabase/`, `waitlist_length`
n'a **aucune source** et dépendait de `P1-006`, qui vient *après*, et le volet
web ne vaut pas le jalon. D'où la découpe en `P1-005a` (3, dans le total) et
`P1-005b` (1, non programmé), et le déplacement de `waitlist_length` vers
`P1-006`. **Deuxième fois que la règle 8 travaille avant le code plutôt
qu'après**, et la première où elle évite une dépendance circulaire dans l'ordre
des tickets.

Deux règles en sont sorties, écrites là où elles se reliront. Dans `CLAUDE.md`,
la **règle 9** : une sonde qui doit survivre à sa PR porte `__DEV__` dès sa
première ligne — `D-018` a fusionné dix `console.log` sur `main`, dont certains
écrivaient `userId`, parce qu'ils étaient « gardés volontairement ». Et son
corollaire, appliqué immédiatement à `P1-005a` : **le plafond de mesure d'un
défaut qui ne s'observe qu'avec plusieurs clients se décide à l'ouverture du
ticket**, jamais au troisième tour.

**Revue du 9 septembre 2026, après la passe de `P1-015`.** Le ticket est fusionné
(PR #63) et **sa passe l'a rouvert** : le COACH n'atteint pas le back-office,
donc le droit que le ticket a ouvert à trois niveaux ne s'exerce à aucun. Une
passe a donc produit **trois tickets et deux corrections de documents** :

- **`D-021`** (1,75, dans ①) — la porte du coach et la place de la séance,
  **devant `P1-008a`** : un ticket fusionné dont l'utilisateur n'atteint pas
  l'écran vaut zéro. Il porte **le contrôle qui manquait**, un test de la porte
  par rôle ;
- **`D-022`** (1,5, hors totaux) — le filet qui ouvre un navigateur.
  `CLAUDE.md` annonçait `pnpm e2e:web` sans Playwright ni script : **la ligne a
  été retirée le jour même**, la dette est ouverte avec son déclencheur ;
- **`P1-016`** — la mise en service chez la box pilote, qui était dans la date
  et dans aucun ticket. Voir l'encadré en tête de fichier. **Ses 3 j·h de
  technique sont entrés dans ① le jour même**, après la fusion de PR #64 —
  total **109** ;
- le total ① a été **recompté ligne à ligne** et il était faux de 1 j·h (tableau
  des mouvements) ; le décor du § 5 septies écrivait `/box/rueil/…` là où le slug
  du seed est `crossfit-rueil`. **Les autres identifiants de la page ont été
  relus contre `supabase/seed.sql`** — comptes, jeton d'invitation, `CF Rueil`,
  ports — et ils sont justes.

**Une décision de forme confirmée, pour qu'elle ne se re-conteste pas** :
`P1-015` compte **parmi les faits** avec un critère d'appareil ouvert. C'est la
même convention que `P1-005a` le 6 septembre. **Fusionné = fait ; les critères
d'appareil se suivent à part**, dans le ticket et dans le journal des passes.

**Et une fourche tranchée hors ticket, pendant qu'elle était claire** : la
feuille de cours du coach (`P1-008a`) est **mobile** — en salle, téléphone en
main (spec §4-P3). Donc la porte de `D-021` sert `P1-015` et **pas** `P1-008a`,
et `D-021` ne se dimensionne pas « au cas où ». La décision est écrite dans
`P1-008a`, avec ce qu'elle coûte : la feuille sera **la première surface de l'app
mobile qui dépend d'un rôle**, et son lot d'écran à 1,25 j·h ne couvre pas ça.

**Revue du 9 septembre 2026, après PR #65 — deux remarques sur `P1-016`, qui
est par ailleurs le bon ticket.** La première : **le RGPD y était sous-dit.**
Le jour de la mise en service, l'éditeur du service devient
sous-traitant de la box (art. 28), sans entité juridique — une personne physique
peut l'être, ce n'est pas bloquant, mais ça expose et ça ne s'improvise pas le
lundi matin. Trois pièces datées « avant le premier import » : DPA, registre,
politique de confidentialité. Et en vérifiant la troisième, le dépôt a montré
que **`consents.tsx` fait cocher « j'ai lu la politique » et enregistre la
version `2026-08-01` d'un texte qui n'existe pas**, sans lien vers rien. La ligne
« entité juridique » du chemin critique n'a plus Stripe pour seule conséquence.
La seconde : **ne pas concentrer l'inconnu.** Deux lots de `P1-016` ne dépendent
de rien et portent toute la nouveauté — ils partent dans **`P1-017`**, joué
pendant `P1-008a`. Même raisonnement que pour le compte Apple. En s'écrivant,
`P1-017` a trouvé que le SMTP intégré d'un projet hébergé ne tient pas 80
invitations : **le domaine bloque désormais quatre choses, dont la mise en
service.** Total ① inchangé à 109.

**Même jour, troisième tour — deux choses ont changé de gravité.** La trouvaille
du consentement est **plus sérieuse qu'écrite** : `current_policy_version()`
n'est pas décorative, `me_function.sql:135` s'en sert pour décider si les
consentements sont satisfaits — **elle conditionne l'accès**. Le produit fait
donc cocher, enregistre un consentement horodaté **avec IP et user-agent**, et
ouvre l'accès, sur un document qui n'existe pas. **Ce n'est pas un document
manquant, c'est un consentement nul** — pas éclairé — et il a l'air conforme,
ce qui est le pire cas. Avec une conséquence de séquence que le ticket ne tirait
pas : le jour où la constante passe à la vraie date, `me()` tient **tous** les
consentements antérieurs pour périmés, et 80 personnes recochent deux semaines
après avoir changé d'outil. Le prérequis de `P1-016` dit désormais **les trois
avant le premier import** : le texte, la constante, le lien. Et **le domaine
est le changement du jour** : jugé non urgent deux fois, il est sur le chemin de
la mise en service par un chemin que personne n'avait vu — SMTP bridé → SMTP
tiers → domaine vérifié. **Achat décidé cette semaine.**

**Dernier tour du 9 septembre, et il pose une règle sur lui-même.** `D-023`
écrit — le ticket de code du consentement, 0,5, qui s'ouvre quand le texte
existe et bloque `P1-016` ; total ① **109,5**. Et **la règle 11 de `CLAUDE.md`**,
sur un constat chiffré : huit commits hors fusion, un `feat`, sept `docs`. Le
prochain merge porte du code — `D-021`, dans la même branche que ces lignes.

## ⭐ À partir du 8 septembre 2026, l'ordre du jalon suit la box pilote

**Ce n'est plus le même genre de décision**, et c'est pour ça que ça mérite sa
note. Jusqu'ici l'ordre se déduisait — d'un blocage, d'une dette, d'un
raisonnement sur ce qui empire avec le nombre d'écrans. **Le retour recueilli
auprès du coach de la box pilote le 8 septembre 2026 est le premier client
réel**, et il l'emporte sur le raisonnement.

Ce qu'il a changé, en un jour :

| Sujet            | Ce qu'on croyait                                      | Ce qu'il a dit                                                                                                                                              |
| ---------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Le pointage      | il faut un QR pour éviter au coach de tenir une liste | **il tient la liste, et ça lui va.** Le repli du périmètre (RM3.6) _est_ le produit ; le QR est l'extra → `P1-008a` réduit à 3,75, `P1-008b` non programmé  |
| La programmation | `P2-009`, après le MVP                                | **il l'écrit ailleurs aujourd'hui.** Sans elle il garde Hustle Up, et le pilote mesure une box qui ouvre deux applications → `P1-015`, devant tout le reste |
| Les frais        | à trancher                                            | **il tranche : « pas tout de suite »**, il punit à l'erg. `S5` reste en v1, et une punition à l'erg n'est pas du logiciel                                   |

**Ce que ça implique pour la suite** : un ordre déduit se re-discute avec des
arguments, un ordre demandé par un client se re-discute avec **ce client**. Les
deux se valent, mais on ne les mélange pas — et quand les deux disent des choses
différentes, il est écrit ici lequel a gagné.

Le risque **R4** — « le propriétaire achète, les coachs n'adoptent pas » — est le
premier à bouger : celui-ci a adopté, et il demande précisément le
différenciateur n°1 de la spec.
**La ligne de démarcation est celle de la spec §2.6** : une box doit pouvoir
créer son compte → configurer son planning → inviter ses membres → **vendre un
abonnement et un pack de 10** → voir réserver, annuler, pointer → **publier le
WOD avec Rx/Scaled** → voir logguer les scores → **consulter son CA**. Tout ce
qui est en gras était absent du backlog jusqu'au 2 septembre 2026.

## Chemin critique hors code

**Dernier examen : 9 septembre 2026.**

### L'ordre arbitré le 6 septembre 2026

**On ne part pas sur P1-007 en Android.** Le ticket sortirait avec deux `[~]`
durables, et la box pilote est sur iPhone : un push qui ne marche que sur la
moitié des téléphones n'est pas un jalon franchi. `P1-007 → P1-006` **reprennent
quand le compte Apple est validé**, dans leur ordre écrit.

> **La condition est remplie depuis le 8 septembre 2026** — deux jours après
> l'arbitrage. **L'ordre ne change pas pour autant** : la passe groupée et
> `P1-008a` restent devant, parce que ce qui les précédait n'était pas l'attente
> d'Apple mais leur propre valeur. Ce que la validation change, c'est que
> `P1-007` ne sortira plus avec deux `[~]` : il pourra les tenir.

D'ici là, quatre pas, et le troisième est ce qui les tient ensemble :

1. **`D-016`** ✅ **fait le 7 sept. 2026** (0,25) — `index.tsx` et
   `bookings.tsx`, ce qui restait après que P1-012 a pris `planning.tsx` et que
   P1-005a a retiré la moitié « places ». La forme de relecture vit désormais
   dans un hook, pas dans trois écrans ;
2. **`D-014`** ✅ **fait le 8 sept. 2026** (0,5) — les deux filets dont on connaissait le trou : le garde de migrations a désormais son complément en CI, et quatre assertions pgTAP cessent de compter tout le dépôt ;
3. **une seule passe iPhone**, qui ferme d'un coup ce que quatre tickets ont
   laissé ouvert : les trois gestes de `D-011`, l'accueil de `D-016`,
   l'arrière-plan de `P1-005a`, et le balayage iOS de `D-009`. **Quatre dettes
   d'appareil, une passe** — c'est tout l'intérêt de les avoir laissées
   s'accumuler plutôt que d'avoir joué quatre passes. **Sa section est écrite**
   (8 sept. 2026) : § 5 sexies de `docs/passe-mobile-iphone.md`, quatre blocs,
   avec l'ordre imposé et les deux contraintes qui gâcheraient la passe si on
   les découvrait dedans ;
4. **`P1-015`** ✅ **fusionné le 9 sept. 2026** (5), puis **`D-021`** (1,75) et
   **`P1-008a`** (3,75) — la séance du cours, ce que sa passe a trouvé, puis le
   pointage. **L'ordre a changé le 8 sept. 2026** sur le retour de la box pilote,
   et `D-021` s'y est intercalé le 9 : **un ticket fusionné dont l'utilisateur
   n'atteint pas l'écran vaut zéro**, et enchaîner en laissant ça derrière, c'est
   « livré sans appelant » à l'échelle d'un lot. `D-021` ne sert **que** `P1-015`
   — la feuille de cours de `P1-008a` est mobile, tranché le 9 sept.

**`P1-008` a sa section « ce que ce ticket suppose », écrite le 8 septembre 2026
avant ouverture** — et elle a trouvé trois choses qu'un lancement direct aurait
découvertes en route. **Découpé le même jour** en `P1-008a` et `P1-008b`.

> *Les chiffres de cette découpe — 7 et 3 — et l'ordre qu'elle posait sont
> **révolus** : le retour de la box pilote les a remplacés quelques heures plus
> tard, plus bas dans cette même section.*

**Le kiosque est plus bloqué qu'on ne le croyait** : `getUserMedia` n'existe pas
hors contexte sécurisé, et le seul HTTPS qu'on aura passe par **le nom de
domaine** — la seconde des deux lignes du chemin critique. Le mode coach, lui,
n'est pas concerné : caméra native, aucun contexte à fournir.

**« Validation locale hors ligne » ne peut pas vouloir dire ce qu'elle dit** :
vérifier une signature hors ligne mettrait la clé de la box sur une tablette de
vestiaire. La note du ticket répond déjà mieux — on accepte et on met en file, on
ne vérifie pas.

**Une tablette de kiosque n'a pas d'identité**, et rien n'en prévoit : l'auth du
produit est un code par e-mail, par personne. Trois issues, aucune gratuite.

> *Elles ont été **tranchées** dans le paragraphe suivant : pas de kiosque au
> pilote. Ce qui précède décrit la question, pas une décision en attente.*

**Découpe tranchée le 8 septembre 2026**, puis **retournée le même jour par la
box pilote** : `P1-008a` se réduit au pointage manuel (**3,75**), et tout ce qui
scanne part dans `P1-008b`, **non programmé**.
Et l'identité de la tablette tranchée avec : **pas de kiosque au pilote**. Le
compte de staff laissé connecté est écarté net — une tablette non surveillée qui
porte des droits de `MANAGER` est impossible à écrire dans le registre RGPD ; le
jeton de kiosque révocable est la bonne réponse **mais sans appelant**, et la
règle 7 vaut dans ce sens-là aussi. RM3.6 tient le jalon sans lui : le coach
coche à la main.

**Deux** démarches administratives bloquent encore du code déjà écrit ou déjà
chiffré — elles étaient quatre jusqu'au 8 septembre 2026 — **et une troisième
ne bloque rien mais expose, avec une échéance qui n'est plus lointaine.**
**Aucune ne se rattrape en codant plus vite.** Elles ne vivent nulle part
ailleurs dans le dépôt : ni un ticket, ni un test, ni la CI ne les rappellera.

| Quoi | Bloque | Pourquoi maintenant |
| --- | --- | --- |
| ~~**Trois `client_id` Google**~~ | ~~P0-005b~~ | **Sort du chemin critique le 8 sept. 2026** — non parce qu'elle est faite, mais parce que `P0-005b` passe **non programmé** : câbler un SSO tiers rend `P2-003` obligatoire (guideline 4.8). Voir ci-dessous |
| ✅ ~~**Compte développeur Apple**~~ | ~~`P1-007`, `P1-006`, `P1-003b`, `P2-003`~~ | **Actif le 8 septembre 2026**, jusqu'au 8 sept. 2027, renouvellement automatique. App Store Connect ouvert. Il aura été le premier rang pendant deux jours |
| **Activation de Stripe Connect** | P2-001, donc tout l'argent | Vérification d'identité de la société — **donc l'entité juridique, ligne suivante** |
| **Une entité juridique** | rien — **mais expose, personnellement** | **Cette ligne n'avait qu'une conséquence jusqu'au 9 sept. 2026 : Stripe, sans échéance avant mi-2027. Elle en a deux.** Le jour de `P1-016`, **l'éditeur du service** devient **sous-traitant de la box au sens de l'art. 28** (spec §15.1 : « sans ce document, vous êtes en infraction dès le premier client »). Une personne physique peut l'être — ce n'est pas bloquant — mais jusqu'à la société, c'est **un nom d'état civil** qui signe le DPA et porte le registre. **Échéance : la mise en service, pas le MVP.** Les trois pièces — DPA, registre, politique de confidentialité — sont des prérequis datés de `P1-016` |
| **Un nom de domaine** (+ SPF, DKIM, DMARC) | P2-015, D-008, le retour Apple — **et `P1-016` depuis le 9 sept. 2026** | **Quatre éléments bloqués par une seule absence** — et depuis le 4 sept. 2026 le nom est connu (**Rack**), donc le domaine est achetable : c'est la seule des démarches restantes qui ne dépende que d'une carte bancaire. **Le quatrième est venu de `P1-017`** : le SMTP intégré d'un projet Supabase hébergé est limité à quelques envois par heure, donc inviter 80 membres exige un SMTP tiers, donc un domaine signé. **Le changement du jour, 9 sept. 2026** : cette ligne avait été jugée non urgente deux fois — « rien avant 2027 », puis « plus sur le chemin du jalon depuis que le kiosque en est sorti ». **Elle est sur le chemin de la mise en service, et l'achat est décidé cette semaine** |

### ✅ Le compte Apple est actif — 8 septembre 2026

Valable jusqu'au **8 septembre 2027**, renouvellement automatique, App Store
Connect ouvert.

**Ce qu'il débloque, et il bloquait le prochain ticket il y a deux jours** :
`P1-007` peut sortir un *development build* iOS, donc exercer le push et le
schéma `rack://`. Deux critères de `P1-007` et un de `P1-003b` n'attendaient
que cette démarche.

**`P1-007` n'est donc plus bloqué administrativement.** Ce qui reste devant lui
est du code, et sa section de prérequis le nomme : **aucun émetteur** (ni edge
function, ni route handler), **aucun journal d'envoi** pour le plafond
marketing, et **`users` sans fuseau** alors que les quiet hours sont annoncées
« heure locale du membre ».

### Pourquoi `P0-005b` sort du chemin critique sans être fait

**Non programmé** au sens de `P1-013` et `P1-005b` : écrit, chiffré, hors du
total ①.

Le calcul est simple et il tient en une phrase : **4 j·h qui en rendent 3 autres
obligatoires.** Câbler un SSO tiers fait perdre l'exception « exclusivement vos
propres systèmes » de la guideline 4.8 d'Apple, qui impose alors *Sign in with
Apple* — c'est-à-dire `P2-003`. Et le magic link **ne peut pas** fournir
l'option équivalente exigée par la guideline : celle-ci demande de pouvoir
**masquer l'adresse e-mail**, ce qu'une connexion par code envoyé à cette
adresse ne sait pas faire par construction.

**Son déclencheur, pour que la décision ne se reprenne pas à vide** : le jour où
l'onboarding d'une vraie box montre que le code à six chiffres coûte des
inscriptions. C'est mesurable — taux de complétion, spec §16.4 — et c'est la
seule chose qui rendrait ces 7 j·h justifiés.

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

## ① Jalon pilote — 104 j·h, dont **23,5 restants**

Objectif : une box réelle utilise l'app en production pendant deux semaines.
**Le paiement se fait hors app**, assumé et expliqué à la box pilote.

### Ordre

```
LA CHAÎNE MOBILE, close
  D-009 ✅ → P1-002b ✅ → P1-010 ✅ → P1-003b ✅ → P1-003c ✅ → P1-011 ✅ → P1-014 ✅
  D-010 ✅ · D-012 ✅ · D-013 ✅ · D-004 ✅ · D-017 ✅ · D-018 ✅
  P1-004 ✅ → P1-005a ✅          (annulation, puis le temps réel sur le téléphone)

L'ORDRE ARBITRÉ DU 6 SEPT., déroulé jusqu'au bout
  D-016 ✅ → D-014 ✅ → D-019 ✅ → D-020 ✅ → ✳ passe groupée ✅ (8 sept.)
  La passe a fermé six critères sur quatre tickets : D-011 ✅, D-016, P1-005a, D-009.

L'ORDRE DEPUIS LE RETOUR DE LA BOX PILOTE (8 sept.) — il remplace le précédent
  P1-015 ✅ → D-021 ✅ → P1-008a ∥ P1-017 → P1-007 → P1-006
  Le WOD passe devant le pointage : sans lui, le coach ouvre deux applications
  pendant tout le pilote.
  D-021 s'intercale le 9 sept., après la passe : P1-015 est fusionné et sa
  valeur est nulle tant que son seul utilisateur n'atteint pas l'écran.

CE QUI RESTE, ET CE QUI LE RETIENT
  D-021 ✅ fait et passé le 9 sept. — A14 ferme le critère d'écran de P1-015.
            PR #68 n'a fusionné que la doc : le code est dans la PR suivante
  P1-008a ⟵ rien. **Le prochain** — le coach coche sa feuille, l'absent est
            marqué. Il porte aussi la découpe P1-007a/b et l'amendement d'ADR 0004.
            À réestimer à l'ouverture, en disant de combien (première
            lecture : +1,25)
  P1-017  ⟵ rien — la première infrastructure de production, jouée PENDANT
            P1-008a et pas la semaine de la box : ce dont on ne contrôle pas
            le déroulé se lance tôt
  P1-007  ⟵ pas Apple : son propre travail préparatoire, découpe a/b + ADR 0004
  P1-006  ⟵ P1-007, et rien d'autre
  P1-009 → P1-001f  ⟵ rien. Après la démo
  D-008   ⟵ le nom de domaine, seul blocage de sa ligne

NON PROGRAMMÉS, chacun avec son déclencheur
  P0-005b · P1-005b · P1-013
  P1-008b ⟵ tout ce qui scanne. À la première box qui n'est pas la pilote.
  D-022   ⟵ le filet qui ouvre un navigateur (dette ④, 1,5). Deux déclencheurs :
            un second défaut « une porte, un rôle », ou l'ouverture de P2-001.

  D-023   ⟵ la RÉDACTION de la politique de confidentialité, qui n'est pas du
            code. Un ticket de code court (0,5) : le lien, la constante, le
            test qui les lie. Bloque P1-016 : aucun import réel avant.
        ↓
  P1-016  ⟵ LA MISE EN SERVICE. 1,75 j·h de technique (build TestFlight,
            sauvegarde restaurée) + 4 jours d'accompagnement qui ne sont pas
            des j·h. Et trois pièces RGPD datées « avant le premier import ».
        ↓
  ═══ JALON : mise en production chez la box pilote ═══
```

**Ce que « débloqué » ne veut pas dire.** Le compte Apple a levé une démarche, pas
un travail. Il a rendu exerçables le push iOS (`P1-007b`), le reliquat `rack://`
de `D-013`, le critère `[~]` correspondant de `P1-003b` et `P2-003`. Il n'a rien
retiré aux **trois trous** que la section règle 8 de `P1-007` a trouvés — aucun
émetteur, aucun journal d'envoi, aucun fuseau utilisateur — ni au fait que son
estimation de 4 j·h est fausse de son propre aveu.

Le blocage n'a pas disparu, **il a changé de nature** : d'une démarche
administrative à son propre travail préparatoire. Écrire « débloqué » tout court
ferait repartir le ticket sur un chiffre qu'on sait faux. D'où la condition
d'ouverture, à tenir :

> **`P1-007` s'ouvre quand sa découpe a/b et l'amendement d'ADR 0004 sont
> écrits.** Apple était nécessaire, pas suffisant.
>
> **Ni l'une ni l'autre n'est écrite au 9 septembre 2026, et elles ont désormais
> un moment** : pendant `P1-008a`, pas au lancement de `P1-007` — c'est
> exactement le travail qu'on découvre en route quand personne ne lui a donné de
> date. L'amendement a sa cible : `docs/adr/0004-pas-de-couche-api.md:33`
> annonce que « `P1-003` construira `apps/web/app/api/v1/` ». `P1-003` est
> fusionné depuis le 4 septembre et **ce répertoire n'existe pas** — l'ADR décrit
> un avenir qui n'a pas eu lieu, au présent.

**Et le premier development build se prépare comme un événement.** Il ferme des
critères de **quatre** tickets — `P1-003b` (le schéma `rack://`), `D-013` (son
reliquat), `P1-007b` (le push iOS), et `D-008` dès que le domaine existe. Même
économie que la passe groupée, appliquée aux builds : on rassemble la liste de ce
qu'il ferme **avant** de le lancer, au lieu de le subir comme un effet de bord de
`P1-007`.

**D-009 ouvre la chaîne mobile, comme D-004 l'a ouverte avant elle.** La règle
est la même à chaque fois : ce qui empire avec le nombre d'écrans se corrige
avant d'en ajouter, pas après. D-004 était la langue — des critères de parcours
ne se jugent pas dans la mauvaise langue ; D-009 est la navigation — trois
écrans aujourd'hui, huit après P1-002b et P1-003b. Ces deux dettes entrent donc
dans le total ①.

**P1-009 reste après le jalon.** Le sélecteur de box ne bloque pas une box
pilote, qui n'a qu'une box — mais le seed a Julie dans deux, et le produit ne
sait pas lui répondre.

### État

| Ticket  | Titre                                             |    j·h | Statut               |
| ------- | ------------------------------------------------- | -----: | -------------------- |
| P0-001  | Monorepo, CI, outillage                           |      3 | ✅ fusionné (PR #2)  |
| P0-002  | Design tokens et thème tenant                     |      4 | ✅ fusionné (PR #1)  |
| P0-003  | i18n FR/EN                                        |      2 | ✅ fusionné (PR #3)  |
| P0-004  | Schéma de base, RLS, test anti-fuite              |      6 | ✅ fusionné (PR #4)  |
| P0-005a | Se connecter — code, session, `me()`              |      6 | ✅ fusionné (PR #6) — passe sur appareil faite le 3 sept. 2026 |
| P0-005b | SSO Google et linking d'identités                 |      4 | **non programmé le 8 sept. 2026** — sort du total ①. Ce n'est pas un blocage : c'est un calcul. **4 j·h qui en rendent 3 autres obligatoires**, parce que câbler un SSO tiers fait perdre l'exception « exclusivement vos propres systèmes » de la guideline 4.8 et impose `P2-003`. Le magic link ne peut pas fournir l'option équivalente : elle exige de masquer l'adresse e-mail, ce qu'un code envoyé à cette adresse ne sait pas faire. **Déclencheur** : le jour où le taux de complétion d'onboarding (spec §16.4) d'une vraie box montre que le code à six chiffres coûte des inscriptions |
| P1-001a | Porte d'entrée du back-office web                 |    2,5 | ✅ fusionné (PR #11) |
| P1-001b | Réglages box, horaires, types de cours            |      3 | ✅ fusionné (PR #12) |
| P1-001c | Staff & Roles, invitations, journal d'audit       |   3,75 | ✅ fusionné (PR #13) |
| P1-001d | Import CSV de membres                             |      4 | ✅ fusionné (PR #15) |
| P1-001e | Apparence de la box (branding)                    |      1 | ✅ fusionné (PR #14) |
| P1-001f | Logo et couche Storage                            |      1 | à faire — après la démo |
| P1-002  | Planning récurrent (RRULE)                        |      9 | ✅ fusionné (PR #17) |
| D-004   | La langue du mobile — **entrée au chemin critique** |    2 | ✅ fusionné (PR #21) — vérifiée sur appareil le 4 sept. 2026 |
| D-009   | Navigation mobile : en-tête, historique, retours  |      1 | ✅ fait — reste le balayage iOS, à la prochaine passe |
| P1-002b | Planning mobile et cache hors ligne               |    3,5 | ✅ **clos** — hors ligne repassé sur appareil le 4 sept. 2026 (`lea@example.com`), après PR #27. Trois gestes de relecture du cache partis en D-011 |
| P1-010  | Annuaire des coachs, lisible par un membre        |      1 | ✅ **clos** — filtre coach exercé sur appareil le 4 sept. 2026. Porte la **règle d'exposition d'identité**, citée par P1-003c |
| P1-003c | La feuille d'inscrits : en quoi un pair diffère d'un coach |  3,5 | ✅ **fait le 5 sept. 2026** — trois décisions prises, `class_roster` + opposition par appartenance. **2 → 3,5** : aucun écran ne permettait de changer une préférence, donc l'opposition n'existait pas. **Passe du 5 sept. : geste 1 conforme, gestes 2 et 3 ont trouvé un affichage périmé** — on se voyait encore dans la feuille après s'y être opposé. Corrigé (`useFocusEffect`), à rejouer sur appareil. Les trois écrans jumeaux partent en `D-016` |
| P1-003  | Réservation — lot 1, le SQL                       |      4 | ✅ fusionné (PR #18) — prouvé sous contention réelle en CI |
| P1-003b | Réserver depuis le mobile — lot 2, les écrans     |    5,5 | ✅ **fait** (PR #32) — passe iPhone du 5 sept. 2026, gestes 1 à 11 conformes, VoiceOver compris, **aucun défaut trouvé, une première**. Deux critères en `[~]` : le p95 attend P1-004 puis un environnement distant, le schéma `rack://` attend un *development build* (D-013) |
| P1-011  | Bandeau de semaine : atteindre un jour en un tap  |      2 | ✅ **fait le 5 sept. 2026**, **au troisième essai sur le balayage** — la position de défilement est désormais la seule vérité, et le geste est enfin exerçable au harnais. **1,5 → 2** : le prix de deux correctifs manqués, compté plutôt que caché. `apps/mobile` y gagne sa première suite de tests |
| P1-004  | Annulation et fenêtres                            |      4 | ✅ **fait le 5 sept. 2026** — RM2.4 tranchée : le pilote **accepte** l'annulation tardive et la marque, sans promettre un crédit qui n'existe pas. A fermé une sœur oubliée : annuler un cours laissait ses réservations confirmées. Un critère ouvert, la notification (P1-007) |
| P1-014  | Calendrier du mois, pastille sur mes jours réservés |  2,5 | ✅ **fait le 5 sept. 2026** (PR #42) — **remplace le bandeau de P1-011**, demandé le 5 sept. 2026 en regardant Peppy. La demande n'est pas un sélecteur de plus : c'est **l'historique** du mois, que le bandeau ne pouvait pas montrer puisqu'il refusait le passé. Absorbe le second niveau de P1-012 |
| P1-012  | Le planning dit ce qui est déjà réservé           |      1 | ✅ **fusionné (PR #46) — passe faite le 6 sept. 2026** : tout passe sauf le clignotement au retour (→ `D-018`), et le critère « deux boxes » reste `[~]` faute de `P1-009`. **2 → 1 le 6 sept. 2026** : P1-014 a livré le chemin de données et tranché la décision hors ligne. Reste le détail par cours, le badge, et **le volet `planning.tsx` de `D-016`, absorbé ici** — sans lui le badge serait faux au retour sur la liste |
| P1-005a | Places restantes en temps réel, sur le téléphone  |      3 | ✅ **fait le 6 sept. 2026 — passe harnais à deux clients**, dix critères sur onze. L'isolation du canal est **prouvée** là où pgTAP ne peut pas : sonde sans filtre de box, un seul des deux événements reçu. Un défaut trouvé et corrigé — deux écrans partageaient un nom de canal, et `channel()` rend l'existant. **Un critère `[ ]` : l'arrière-plan**, qu'un onglet caché ne sait pas exercer → prochaine passe iPhone. Découpé de `P1-005` le même jour : `waitlist_length` → `P1-006`, le web → `P1-005b` |
| P1-005b | Le même canal dans la grille du back-office       |      1 | **non programmé** — écrit, chiffré, hors du total. Au pilote, la valeur du temps réel est sur le téléphone du membre, là où deux personnes se disputent la dernière place ; le manager peut rafraîchir. Sort en une session si la box pilote le réclame |
| P1-006  | Liste d'attente et promotion                      |      6 | à faire — **derrière P1-007**, dont elle tient la promotion. Porte aussi `waitlist_length` en temps réel, repris de P1-005 le 6 sept. 2026 |
| P1-007  | Notifications push                                |      4 | 🔒 **partiellement bloqué — iOS**. Sa section « ce que ce ticket suppose », écrite le 6 sept. 2026, a trouvé trois trous que l'estimation ne couvre pas : **aucun émetteur** (ni edge function, ni route handler), **aucun journal d'envoi** pour le plafond marketing, et **`users` n'a pas de fuseau** alors que les quiet hours sont « heure locale du membre ». Deux critères en `[~]` : le push iOS et le deep link, tous deux derrière le **compte développeur Apple**. Android est ouvert et gratuit. **4 j·h à recompter au lancement** |
| P1-015  | La séance du cours, écrite par le coach           |    5,5 | ✅ **clos le 9 sept. 2026 — onze critères verts.** Le **premier ticket venu d'un client réel**, et il est tenu : une séance **par occurrence**, en texte libre, pré-remplissage qui **copie sans lier**, troisième protection contre le rafraîchissement de série. Fusionné incomplet (PR #63), il a fallu **trois passes** pour le clore : `D-021` (la porte du coach + la place du panneau, A14 ✅), puis les **gestes 7 et 8** — NOK à la passe, le **piège 13** (la policy de lecture masquait l'archivé à tout le monde, PostgreSQL 17 refuse alors l'`update` qui archive), sa **sœur** cassant « supprimer une série » **depuis P1-002**, corrigé (`fix/P1-015-gestes-7-et-8`, **5 → 5,5**) et **rejoué OK sur `main`**. Reste hors critère le seul repère qui compte : la semaine chronométrée vs Hustle Up, à `P1-016` |
| P1-008a | Le coach coche sa feuille, et l'absent est marqué  |   3,75 | **retourné par la box pilote le 8 sept. 2026.** Le coach tient sa liste et ça lui va : RM3.6, le repli du périmètre, **est** le produit. Reste le pointage manuel, l'horodatage de présence et le job de no-show. **7 → 3,75 — ce n'est pas une réestimation, c'est un autre ticket**. **À recompter à l'ouverture** (9 sept. 2026) : la feuille est **mobile**, tranché sur la spec §4-P3, et elle sera **la première surface de l'app qui dépend d'un rôle** — `apps/mobile` ne lit `role` nulle part. Le lot d'écran à 1,25 a été chiffré comme un écran ; c'est un mode. **Cinquième dérapage vu avant l'ouverture** — réestimer à l'ouverture, pas absorber, **et dire de combien** : première lecture +1,25 (3,75 → 5), à tenir par qui ouvre le ticket. `P1-017` se joue pendant celui-ci |
| P1-008b | Le check-in QR : le membre scanne lui-même        |      6 | **non programmé** — la box pilote n'en a pas besoin. Mais §10 le classe « attendu par le marché » : **une box de 200 membres avec des coachs qui tournent ne connaît pas ses adhérents par leur prénom**. Déclencheur : la première box qui n'est pas la pilote. Porte tout ce qui scanne, **et la section règle 8** dont les trois trouvailles ont servi à décider de ne pas le lancer |
| P1-013  | Droits de réservation accordés à la main          |      2 | **non programmé** — écrit, chiffré, prêt. À sortir le jour où la box pilote veut couper un droit sans exclure quelqu'un. `member_has_booking_right()` rend `true` pour tout membre actif : c'est son appelant manquant |
| P1-009  | Sélecteur de box (mobile)                         |    1,5 | à faire — après le jalon. **Rend exerçable un critère `[~]` de P1-012** (deux boxes, sans passer par la déconnexion qui purge le cache). La place lui est laissée dans l'en-tête du planning. Porte la moitié « deux boxes » de D-011 |
| D-011   | Les trois gestes que la passe hors ligne n'a pas exercés | 0,5 | ✅ **fait à la passe groupée du 8 sept. 2026** — bloc A. Le compte précédent atteint par **session expirée** et non par déconnexion, seul chemin qui exerce le cloisonnement par la clé plutôt que l'effacement ; fuseau Tokyo ; contenu du cache relu sur l'appareil |
| D-012   | Façade `crypto` et sondes de lint *(rétroactif)*  |    0,5 | ✅ fait le 4 sept. 2026 — écrit après coup pour que le total cesse d'être faux de 0,5 |
| D-013   | **RIG devient Rack** — le renommage, d'un seul geste |  0,5 | ✅ fait le 4 sept. 2026 — avant P1-003b, qui touche les mêmes fichiers. Le `scheme` ne se vérifie pas dans Expo Go : ce reliquat part avec le premier *development build* |
| D-014   | Deux filets dont on connaît le trou               |    0,5 | ✅ **fait le 8 sept. 2026**. Le trou du garde est comblé par `pnpm migrations:immuables`, en CI : il regarde le résultat et non l'intention, donc voit les écritures par script — contrôle négatif joué **en Bash**, le chemin même que le hook ne voit pas. Bascule de la règle 13 dans une constante, les deux moitiés prouvées. Côté pgTAP, **quatre assertions corrigées sur 107**, trouvées en ajoutant du bruit au seed plutôt qu'en les lisant |
| D-015   | Monter un composant mobile dans un test           |    1,5 | à faire — **à arbitrer, avec son déclencheur**. La suite `.ts` d'`apps/mobile` existe ; ce qui manque est le montage et les gestes |
| D-018   | L'écran se recharge au retour sur le planning     |      1 | ✅ **clos le 6 sept. 2026** — cause trouvée et corrigée (PR #48 : le focus se rejouait deux fois par retour), puis **sondes retirées** avant P1-005a. **0,5 → 1** : deux tours de mesure, comptés plutôt que cachés. Rechargement résiduel **arbitré et accepté** ; les quatre critères d'appareil restent `[ ]`, abandonnés et pas tenus |
| D-019   | Trois affordances de débogage sur l'accueil       |    0,5 | ✅ **fait le 8 sept. 2026**. Le sélecteur de langue **déménage** dans les réglages — il tenait une vraie fonction, il était au mauvais endroit depuis `P0-003` ; les deux autres passent sous `__DEV__`. L'accueil ne porte plus **qu'une action primaire**, mesurée et non lue. **Et la garde est prouvée mordante** sur l'export de production : zéro appel aux deux chaînes, seules leurs traductions embarquent. Un critère `[ ]` — l'app iOS elle-même → passe groupée |
| D-020   | Trois sœurs que la fixture bidon n'a pas vues     |   0,25 | ✅ **fait le 8 sept. 2026**, avant de reprendre la passe — un rouge connu pendant une passe est un rouge qu'on n'examine pas. **Une troisième trouvée** en cumulant les deux bruits, et elle ne rougissait pas : elle **cassait** `class_roster_test`, emportant vingt assertions. La règle du décor devient **mécanique** (`test-db.mjs`, page de passe), et `CLAUDE.md` gagne la **règle 10** |
| D-017   | Flash blanc au démarrage en mode sombre *(rétroactif)* |  0,25 | ✅ fait le 5 sept. 2026 (PR #43) — écrit le 6 sept. : le travail était rattaché à `D-009`, close la veille, donc dans aucun total |
| D-016   | Trois écrans qui ne relisent rien au retour       |   0,25 | ✅ fait le 7 sept. 2026. **Ligne ajoutée le 9 sept. 2026** : son 0,25 était crédité aux faits par le tableau des mouvements sans avoir de ligne ici, donc compté dans un total où il ne figurait pas |
| D-021   | La porte du coach, et la place de la séance       |   1,75 | ✅ **fait et passé le 9 sept. 2026** — **A14 ✅, le critère d'écran de `P1-015` est fermé.** Attention à la provenance : **PR #68 n'a fusionné que la documentation**, le code de ce ticket est parti dans la PR suivante (`feat/D-021-le-code`), et la passe a été jouée sur l'arbre de travail avant cette fusion. Une décision (`back-office.ts`, neuf droits × quatre rôles), **quinze comparaisons de rôle retirées d'`apps/web`**, dont une sœur que le ticket ne nommait pas (`join-card.tsx`) : la sonde ESLint l'a trouvée en mordant. Le panneau : la séance d'abord, l'annulation derrière un trait et un bouton danger, un seul primaire. **Rien d'observé dans un navigateur** — il n'y en a pas (`D-022`) — donc six critères restent `[ ]` pour la passe |
| P1-016  | La mise en service chez la box pilote             |   1,75 | à faire, **en dernier** — écrit le 9 sept. 2026, entré dans ① le jour même (PR #64), **puis découpé après PR #65** : le projet hébergé et le déploiement partent dans `P1-017` pour ne pas concentrer l'inconnu la semaine de la box. Reste ici ce qui dépend vraiment du reste — build TestFlight, sauvegarde restaurée — **+ 4 jours d'accompagnement** qui ne sont pas des j·h. **Et le RGPD y est daté** : DPA, registre, politique de confidentialité **avant le premier import** — la sous-traitance art. 28 commence le jour de la mise en service, et `consents.tsx` horodate depuis le 31 août un consentement à une politique **qui n'existe pas** |
| P1-017  | La première infrastructure de production          |   1,25 | à faire, **pendant `P1-008a`** — sorti de `P1-016` le 9 sept. 2026. Projet Supabase hébergé (major **17** lu dans le projet, `pg_cron` à réactiver, `test:db` contre la base distante) et déploiement de `apps/web`. **A trouvé un trou en s'écrivant** : le SMTP intégré d'un projet hébergé ne tient pas 80 invitations, donc un SMTP tiers, donc le domaine — quatrième élément bloqué par cette démarche |
| D-023   | Le consentement pointe vers un texte, et la constante en porte la date | 0,5 | **écrit le 9 sept. 2026, s'ouvre quand le texte existe** — sa rédaction n'est pas du code et n'est pas dans ce ticket. Le lien depuis `consents.tsx`, `current_policy_version()` alignée sur la date réelle, et **un test qui lie les deux** : la règle 10 appliquée à une valeur. **Bloque `P1-016`** : aucun import réel avant, sinon 80 personnes consentent à un texte inexistant et recochent toutes quand la constante change |
|         | **Total ①**                                       | **110** | dont **88,75 faits**, **21,25 restants** |

**Les restants sont montés de 20,75 à 23,5 le 8 septembre, et c'était une bonne
nouvelle.** Un chiffre qui monte se relit comme une dérive s'il ne porte pas sa
raison : celui-là montait parce qu'on a **retiré 7 j·h que la box pilote
n'aurait pas utilisés** — le QR, le kiosque, le drop-in au scan — **pour ajouter
5 j·h qu'elle attend**, la séance du cours. Le jalon était plus long de 1,75 j·h
et il livrait ce qu'un client avait demandé, au lieu de livrer ce qu'on avait
supposé.

C'est la différence entre les quatre dérapages d'estimation du projet et
celui-ci : les autres coûtaient plus pour la même chose ; celui-là coûte un peu
plus pour **autre chose**, choisie.

**Le 9 septembre, ils redescendent à 19,5** : `P1-015` est fusionné (−5) et
`D-021` entre dans ① (+1,75). Ce n'est pas la fusion qui a fait entrer `D-021`,
c'est **sa passe** : les deux défauts qu'elle a trouvés n'étaient visibles ni en
test ni en relecture, et le premier empêche la personne à qui `P1-015` est
destiné d'atteindre son écran. **Une dette qui naît d'une passe entre dans le
total le jour où elle est écrite**, pas le jour où elle est faite — sinon le
jalon paraît plus court qu'il n'est, ce qui est exactement la dérive que ce
tableau documente trois fois.

**Puis remontent à 22,5 le même jour** : les 3 j·h de technique de `P1-016`
entrent dans ①. Ils étaient « à arbitrer » dans le commit précédent, et le
ticket exigeait que ça ne dure pas plus d'une revue — ça n'a pas duré une
journée. **Ce chiffre-là monte pour la bonne raison** : un travail qui était
dans la date sans être dans aucun ticket est désormais dans les deux.

**Quatre tickets ne sont pas dans ce total** — `P1-013`, `P1-005b`, `P0-005b` et
`P1-008b`, les trois derniers depuis le 8 septembre 2026. Ils sont écrits et chiffrés, pas programmés, et
**chacun porte son déclencheur** : `P1-013` le jour où la box pilote voudra
couper un droit sans exclure quelqu'un ; `P1-005b` le jour où elle réclamera des
compteurs vivants dans la grille ; `P0-005b` le jour où le taux de complétion
d'onboarding (spec §16.4) montrera que le code à six chiffres coûte des
inscriptions ; `P1-008b` le jour où le domaine existera **et** qu'une box réelle
réclamera le kiosque — **deux conditions, pas une**. Un ticket non programmé sans
déclencheur est un ticket abandonné qui n'ose pas le dire.

**Le total ① ne bouge pas à la découpe de `P1-005`** : les 3 j·h y restent,
portés par `P1-005a`, et le volet web est un ajout hors total, pas un retrait
déguisé.

**Recompté le 8 septembre 2026, et c'est la troisième fois que ce total prend du
retard sur les fusions.** Il disait « 78,5 faits, 26 restants » alors que
`D-016` (0,25) et `D-014` (0,5) étaient fusionnés. Le détail, parce qu'un total
corrigé sans son calcul se re-conteste :

| Mouvement | Total ① | Faits | Restants |
| --- | ---: | ---: | ---: |
| Avant | 104,5 | 78,5 | 26 |
| `D-016` + `D-014` fusionnés (0,75) | 104,5 | 79,25 | 25,25 |
| `P0-005b` sort du total (4) | 100,5 | 79,25 | 21,25 |
| `D-019` entre dans ① (0,5) | 101 | 79,25 | 21,75 |
| `D-019` fait, `D-020` entre (0,25) | 101,25 | 79,75 | 21,5 |
| `D-020` fait (0,25) | 101,25 | 80 | 21,25 |
| `D-011` fait à la passe du 8 sept. (0,5) | 101,25 | 80,5 | 20,75 |
| `P1-008` découpé : −6, +7 pour `P1-008a`, `P1-008b` hors total | 102,25 | 80,5 | 21,75 |
| **Retour box pilote** : `P1-008a` 7 → 3,75, `P1-015` +5 | **104** | **80,5** | **23,5** |
| **Recompte ligne à ligne du 9 sept.** : `D-018` (1) jamais crédité, `D-016` (0,25) crédité sans ligne — voir ci-dessous | 104,25 | 81,5 | 22,75 |
| `P1-015` fusionné (5) | 104,25 | 86,5 | 17,75 |
| `D-021` entre dans ① (1,75) | 106 | 86,5 | 19,5 |
| `P1-016` entre dans ① (3), tranché après la fusion de PR #64 | 109 | 86,5 | 22,5 |
| `P1-016` découpé après PR #65 : −1,25, +1,25 pour `P1-017` — **le moment change, pas le total** | 109 | 86,5 | 22,5 |
| `D-023` entre dans ① (0,5) : il bloque `P1-016` | 109,5 | 86,5 | 23 |
| `D-021` fait (1,75) — **le premier code depuis `P1-015`** | 109,5 | 88,25 | 21,25 |
| `P1-015` 5 → 5,5 : les gestes 7 et 8 rouges à la passe, le piège 13 et sa sœur | **110** | **88,75** | **21,25** |

**21,25 et non 22** : retirer 4 de 26 oublie les 0,75 qu'on vient de déduire.
C'est exactement la façon dont ce total a dérivé les deux fois précédentes.

**Quatrième fois, et cette fois le recompte n'a pas suivi la chaîne — il a
additionné les lignes.** C'est la seule méthode qui ne rejoue pas l'erreur qu'on
cherche : une chaîne de mouvements se vérifie contre elle-même, et une ligne
oubliée y reste oubliée à chaque étape. Le tableau ci-dessus disait
« 80,5 faits, 23,5 restants » là où **la somme des lignes du tableau d'état
donnait 81,25 et 22,75**. Deux écarts, et ils vont en sens contraires :

- **`D-018` (1 j·h), fait le 6 septembre, n'est jamais passé des restants aux
  faits.** C'est exactement le montant de l'écart, et c'est la troisième fois
  qu'un ticket clos ne rejoint pas les faits ;
- **`D-016` (0,25) était crédité aux faits par la chaîne sans avoir de ligne dans
  ①**, tout en figurant parmi les dettes « ouvertes, hors totaux » de la section
  ④ — comptée deux fois d'un côté, absente de l'autre. Elle a désormais sa ligne,
  et le total ① passe de 104 à 104,25 avant les mouvements du jour.

**Ce que ça change pour les décisions : rien, et c'est le pire cas.** Un total
faux de 1 j·h ne fait pas rater une échéance, il fait perdre la confiance dans le
chiffre — après quoi plus personne ne le corrige. La règle qui en sort tient en
une ligne : **le total se recompte en additionnant les lignes, jamais en
prolongeant la chaîne.**

**Un demi-jour retrouvé, et pourquoi on l'écrit.** Le lot du 4 septembre —
façade `crypto`, sondes, refonte de la configuration ESLint — n'apparaissait dans
aucun total. Le +0,5 ajouté à P1-003b le même jour ne le couvrait pas : il paie
trois décisions du ticket, pas du code déjà écrit. D'où `D-012`, rétroactif et
marqué fait. Le total monte de 0,5, les travaux faits aussi, et **les 37,5 j·h
restants ne bougent pas** — c'est le seul chiffre sur lequel des décisions se
prennent.

**Ce que les passes sur appareil ont coûté au total ①, et pourquoi c'est une
bonne nouvelle.** P1-003 est passé de 8 à 9 j·h (règle 8 sur son lot 2), D-004
et D-009 y sont entrées pour 3 j·h, et P1-009 s'y ajoute pour 1,5. Rien de tout
cela n'a été trouvé par un test : il a fallu un iPhone les 3 et 4 septembre 2026.

Quatre défauts, dont trois n'auraient été vus qu'en production chez la box
pilote — la langue, le parcours d'invitation cassé de bout en bout, le sélecteur
de box sans retour. Un total qui monte parce qu'on a regardé vaut mieux qu'un
total juste sur le papier.

---

## ② MVP vendable — **80,5 j·h**

Objectif : « une box s'inscrit, se configure et **encaisse sans votre
intervention** » (spec §13.4). Rien de ce bloc n'existait dans le backlog avant
la réconciliation du 2 septembre 2026 : sept items MUST et un SHOULD y étaient
simplement absents.

### Ordre

```
P2-001 → P2-005 → P2-015 → P2-006 → P2-007 → P2-008     (l'argent)
P2-009 → P2-013b → P2-010 → P2-012 → P2-013 → P2-011 → P2-014   (la programmation, puis les scores)
P2-004 → P2-016                                         (dashboard, puis reporting)
P2-002 → P2-003                                         (RGPD, Apple — avant les stores)
```

Trois ordres méritent une explication, parce qu'ils **contredisent** la
numérotation de la spec :

- **P2-015 (e-mails) avant P2-006 (abonnements)**, sinon l'abonnement n'a pas de
  canal pour envoyer sa facture, et P2-008 n'a pas de canal pour relancer un
  impayé. Aucun ticket n'envoyait d'e-mail avant celui-là.
- **P2-013 (scores) avant P2-011 (scaling)**, alors que la spec ordonne M13 puis
  M14 : une charge « 75 % du 1RM » ne se résout pas sans `personal_records`.
- **P2-013b (mes records) juste après le socle, avant tout écran de
  programmation** — ajouté le 6 septembre 2026. La raison a corrigé la
  précédente : P2-011 ne dépend pas des *scores* mais des *records*, et P2-013b
  sait en produire sans qu'aucun WOD ait eu lieu. Il ne dépend que de P2-009,
  c'est le premier usage que le modèle d'entraînement rend possible, et le
  moins cher.

### État

| Ticket | Titre                                          | j·h | MUST/SHOULD couvert |
| ------ | ---------------------------------------------- | --: | ------------------- |
| P2-001 | Stripe Connect Express, et la couche webhook   |   5 | **M9** |
| P2-005 | Formules : le catalogue de la box              |   3 | M8 (1/3) |
| P2-015 | E-mails transactionnels                        |   4 | **M19** (le tiers manquant) |
| P2-006 | Abonnements                                    |   7 | **M8** |
| P2-007 | Packs de crédits et portefeuille               |   6 | **M10** |
| P2-008 | Impayés, relances et suspension                |   5 | M8 (RM4.6) |
| P2-009 | Le modèle d'entraînement                       |   8 | socle M12 — **6 → 8 le 6 sept. 2026** : D11 à D14 de l'addendum §21 (programme relatif, adhésions, blocs typés, colonnes de score) |
| P2-013b | Mes records : saisie directe, historique, calculateur de % |   3 | socle M14, **débloque M13** — demandé le 6 sept. 2026 d'après HustleUp |
| P2-010 | Program Builder                                |   7 | **M12** |
| P2-012 | Le WOD du jour, côté membre                    |   3 | M12 (membre) |
| P2-013 | Saisie de score et records personnels          | 4,5 | **M14** — l'écran « Mes records » est parti en P2-013b |
| P2-011 | Rx / Scaled / Beginner, charges en % de 1RM    |   4 | **M13** |
| P2-014 | Leaderboard par WOD                            |   4 | **M15** |
| P2-004 | Dashboard box et mise en route                 |   4 | **M17**, M2 (`create_tenant()`) |
| P2-016 | Reporting financier et export comptable        |   5 | **S6**, M17 (CA), M21 (finances) |
| P2-002 | Droits RGPD en self-service                    |   5 | **M20** |
| P2-003 | Sign in with Apple                             |   3 | **M1** — bloquant de publication |
|        | **Total ②**                                    | **80,5** | |

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
| S5 | Frais d'annulation tardive / no-show | v1 | **Référencé par RM2.4 (P1-004) et RM3.4 (P1-008a)** : les deux tickets P1 doivent dire qu'ils s'arrêtent avant. Politiquement sensible → configurable, donc à concevoir avec de vrais propriétaires |
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

## ④ Dette convertie en tickets — 7,25 j·h ouverts

`CLAUDE.md` dit « ce qui déborde devient un nouveau ticket ». La dette accumulée
dans les tickets clos y échappait : un ticket clos ne se relit pas.

| Ticket | Titre                                          | j·h | Origine et état |
| ------ | ---------------------------------------------- | --: | --------------- |
| D-001  | Vue restreinte des membres d'une box           |   2 | P0-004 — ✅ fait, débloquait P1-001 |
| D-002  | Tests de rendu des composants                  |   2 | P0-002 — **devient gênante à P2-010**, l'écran le plus riche du produit |
| D-003  | SSR de l'i18n pour les pages publiques         |   2 | P0-003 |
| D-004  | **La langue** : source de vérité, persistance, repli |   2 | P0-003 — **élargi par la passe sur appareil du 3 sept. 2026** : l'app s'ouvre en anglais sur un iPhone français, `Intl` ne donne pas la langue de l'appareil sous Hermes, et `FALLBACK_LOCALE = 'en'` pour un produit vendu en France. **Sortie de la dette hors totaux le 3 septembre : P1-003b la rend bloquante**, elle est comptée dans ① |
| D-005  | Empreintes des jetons d'invitation             |   1 | PR #4 — ✅ fait |
| D-006  | Défense en profondeur sur `public.users`       | 0,5 | P0-004 — ✅ fait |
| D-007  | Contraste de la page de démo                   | 0,25 | P0-002 |
| D-008  | Lien d'invitation qui survit à l'installation  | 1,5 | P0-005a — **attend un domaine**, comme P2-015 |
| D-010  | Un filet qui s'exécute sur le moteur du produit | 0 | Plantage du 4 sept. 2026 — **✅ arbitré et clos le 4 sept.** : rien maintenant ; Maestro en local quand la passe manuelle dépassera dix minutes ; Maestro en CI jamais avant que le produit encaisse. Le quatrième défaut de la famille a été arrêté sur le papier, l'écran de diagnostic n'aurait pas fait mieux. Ce que la décision **accepte de ne pas couvrir** est écrit dans le ticket |
| D-011  | Les trois gestes que la passe hors ligne n'a pas exercés | 0,5 | P1-002b — **✅ fait le 8 sept. 2026**, **comptée dans ①**. Son inconnue de méthode a été levée en écrivant la passe groupée : révoquer la session côté serveur, pas se déconnecter |
| D-012  | Façade `crypto` et sondes de lint *(rétroactif)* | 0,5 | Revue du 4 sept. 2026 — **✅ fait**, et **comptée dans ①** : le travail existait sans figurer dans aucun total |
| D-014  | Deux filets dont on connaît le trou            | 0,5 | P1-003b, 5 sept. 2026 — **✅ fait le 8 sept. 2026**, **comptée dans ①**. Un trou connu qui ne vit que dans un message de commit finit par ne vivre nulle part. La méthode vaut d'être retenue : les 107 assertions de comptage n'ont pas été relues une à une, on a **ajouté du bruit au seed et regardé qui rougissait** |
| D-015  | Monter un composant mobile dans un test        | 1,5 | P1-011, 5 sept. 2026 — **comptée dans ①**. Le premier défaut mobile qui aurait pu être attrapé sans téléphone, et l'option la moins chère ne l'aurait pas attrapé |
| D-013  | RIG devient Rack                               | 0,5 | Décision produit du 4 sept. 2026 — **✅ fait**, **comptée dans ①**. Fait avant P1-003b : `bundleIdentifier` définitif après la première soumission, clés de stockage gratuites à renommer tant qu'aucune app n'est installée |
| D-018  | L'écran se recharge au retour sur le planning   | 1 | P1-012, passe du 6 sept. 2026 — **✅ fait**, **comptée dans ①**. Cause trouvée : `useFocusEffect` rejouait l'effet à chaque changement d'identité de sa callback, donc deux lectures par retour. Corrigée, puis sondes retirées — elles avaient fusionné avec le correctif et écrivaient `userId` dans les journaux de l'appareil. **Une sonde qui survit à sa PR porte `__DEV__` dès sa première ligne** |
| D-019  | Trois affordances de débogage sur l'accueil     | 0,5 | Relecture du 8 sept. 2026 — **comptée dans ①**. La règle 9 prise par l'autre bout : une affordance de débogage est une sonde, et **plus tenace qu'un `console.log` parce qu'elle a l'air d'une fonctionnalité**. Le sélecteur de langue attend depuis `P0-003` un déménagement qu'un commentaire promet |
| D-020  | Trois sœurs que la fixture bidon n'a pas vues   | 0,25 | `D-019`, 8 sept. 2026 — **comptée dans ①**. La leçon dépasse les deux assertions : **une fixture de bruit écrite à la main hérite des angles morts de qui l'écrit**. Le bruit qui prouve quelque chose est celui qu'une session réelle produit |
| D-017  | Flash blanc au démarrage en mode sombre        | 0,25 | D-009, PR #43 — **✅ fait**, **comptée dans ①**. Deuxième fois que du travail se range dans un ticket clos et disparaît des totaux. `null` n'est pas « clair » : la règle est écrite dans `.claude/rules/ui.md` |
| D-016  | Trois écrans qui ne relisent rien au retour    | 0,25 | P1-003c, passe du 5 sept. 2026 — **✅ fait le 7 sept. 2026**. `planning.tsx` était parti dans P1-012, P1-005a avait retiré la moitié « places restantes » ; restaient `index.tsx` et `bookings.tsx`, faits ici. **La forme n'est plus à recopier** : `use-relire-au-retour.ts` porte celle corrigée par D-018 — sans ça, ces deux écrans auraient repris la version d'avant. Deux défauts corrigés au passage : `bookings.tsx` reposait un squelette à chaque lecture et s'effaçait au moindre échec. **Un critère `[ ]`** — l'accueil après réservation, mécanisme vérifié mais effet non observé (passe à 23 h 55, plus de cours ce jour-là) → passe groupée, qui l'a fermé le 8 sept. **Comptée dans ①**, où elle a enfin sa ligne depuis le 9 sept. 2026 |
| D-021  | La porte du coach, et la place de la séance    | 1,75 | `P1-015`, passe du 9 sept. 2026 — **✅ fait le jour même**, **comptée dans ①**, passe web en attente. Deux constats d'une même passe : le COACH est refusé par `layout.tsx:56`, resté celui de `P1-001a` alors que `P1-015` ouvrait le droit à trois autres niveaux ; et le formulaire de la séance est logé sous le panneau d'annulation. **Un cas de plus de la règle des sœurs, et cette fois la sœur oubliée est une garde d'écran, pas une policy** |
| D-022  | Un filet qui ouvre un navigateur               | 1,5 | `D-021` et la porte du coach, 9 sept. 2026 — **ouvert, hors totaux**. `CLAUDE.md` annonçait `pnpm e2e:web` sans Playwright ni script : **la ligne a été retirée le jour même**, parce qu'un document qui promet une commande inexistante fait croire au filet. La dette, elle, reste — et **sa justification n'est plus théorique** : la porte fermée aux COACH est exactement ce qu'un test de bout en bout attrape, et il a fallu un humain. **Déclencheur** : un second défaut « une porte, un rôle », ou l'ouverture de `P2-001` |
| D-023  | Le consentement pointe vers un texte           | 0,5 | `P1-016`, 9 sept. 2026 — **comptée dans ①**, elle bloque le jalon. **S'ouvre quand le texte existe.** Une constante qui conditionne l'accès et qu'aucun texte ne porte : le lien, la date, et le test qui interdit qu'ils divergent |
|        | **Ouvert, hors totaux**                        | **7,25** | D-002, D-003, D-007, D-008, D-022 — D-004, D-011, D-012, D-013, D-014, D-016, D-017, D-018, D-019, D-020, D-021 et D-023 sont dans ①, D-010 est clos. **Recompté le 9 sept. 2026** : `D-016` figurait ici comme ouverte alors qu'elle est faite, ce qui gonflait cette ligne de 0,25 |

Ces 7,25 j·h ne sont dans **aucun** des deux totaux ci-dessus. C'est délibéré :
une dette qu'on additionne au chemin critique le rend indiscutable, une dette
qu'on cache le rend faux. Elle se paie quand un ticket la rend bloquante — et
elle entre alors dans le total, comme D-004 vient de le faire pour P1-003b.
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
