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
| **① Jalon pilote** | que l'outil sert, en vrai, tous les jours | réserver, annuler, faire la queue, pointer | **12,25 j·h** |
| **② MVP orientée coach** | qu'une box programme, invite ses membres et **gère leur accès sans nous** ; le règlement se fait hors app ; iOS **et** Android | programmer, logguer, se classer, réserver selon un accès attribué à la main | **+ 68 j·h** |

Au rythme de **2,3 j·h par semaine** (15–20 h effectives) : jalon pilote vers
**janvier 2027**, MVP orientée coach vers **mai–juin 2027** — la ② est passée de
80,5 à 68 j·h le 16 septembre 2026 (Android inclus et prioritaire, +4,5 ; 68 ÷ 2,3
≈ 29,6 semaines après le code du pilote → mai–juin 2027), la machine à encaisser
(35 j·h) attendant l'entité juridique. Ces dates
sont ce qu'elles sont ; les connaître vaut mieux que les découvrir.

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

**Recompté le 12 septembre 2026 — `P1-006` et `P1-017` fusionnés, et la
projection avec.** Le tableau d'état les disait « à faire » alors que PR #80 et
#79 sont sur `main` : leurs 6 + 1,5 j·h passent aux faits (détail ligne à ligne
dans le journal des mouvements ci-dessous), et ① tombe à 12,25 restants — **puis
remonte à 13,25 le même jour** quand `P1-018` (l'émetteur d'invitations,
sous-budgété dans `P1-016`) entre dans le total. La projection du 9 septembre —
« 19,5 ÷ 2,3 ≈ 8,5 semaines, début novembre » — reposait sur le chiffre d'alors ;
refaite, **13,25 ÷ 2,3 ≈ 5,8 semaines** : le code du jalon vers **fin octobre
2026**, la mise en service — avec les 4 jours d'accompagnement, qui ne se
compressent pas — vers **début novembre** (janvier restant l'annonce prudente
d'origine). C'est la même dérive
que le 5 et le 9 septembre, rouverte : un total qui prend du retard sur les
fusions. **Conséquence à tenir** : le calendrier de durcissement DMARC de
`docs/procedures/email-et-domaine.md` est daté contre cette mise en service ; si
la date bouge, il bouge avec elle.

**Même jour, soir — `P1-018` fusionné, sa reprise avec, et le domaine prouvé.**
L'émetteur d'invitations (PR #84) ratifié **1 → 1,25** à la fusion (le sous-budget
confirmé), puis une **reprise du motif claim/mark** (PR #85, +0,25 : réservations
mortes reprises, `failed_permanent` qui ne se réessaie pas). **① passe à 115,5, et
les restants retombent à 12,25** puisque `P1-018` quitte la file. Et la chaîne
d'e-mail est **prouvée** (magic link signé reçu, `SPF/DKIM/DMARC = pass`,
`mail-tester` 7,9/10) : le domaine **✅ sort du chemin critique**. Ce lot de
documentation (13,25 → 12,25, ✅ domaine, runbook à l'état réel) est joué **le
12 sept.** et non le lendemain, à titre exceptionnel : le quota « une branche
`docs/` par jour » de la règle 11 vise **l'inflation de tickets issue des revues**,
et ce lot est à ~80 % un **relevé du monde réel** (e-mail signé daté, DNS posés,
deux dates d'expiration, gabarits hébergés, parité OTP). La seule vraie trouvaille
de revue — le ticket « Lien envoyé / code affiché » — est **décalée au prochain
lot**, pour tenir l'intention de la règle sans en trahir la lettre. Les deux autres
sous-règles sont satisfaites : **trois lots de code** (P1-018, reprise, hydratation
de l'accueil) sont partis le même jour, donc « jamais deux merges de suite sans code
produit » ne s'oppose à rien.

**Et cinq manques trouvés en répétant la mise en service — ① monte à 118, et c'est
la bonne raison.** En essayant d'envoyer les invitations de bout en bout sur
l'hébergé, il a fallu **trois contournements SQL** : aucun parcours ne crée une box
(`create_tenant` **sans appelant** depuis P0, règle 7), aucune première connexion web
n'aboutit (gabarit sans lien, `/login` sans champ code), et l'accueil ne mène nulle
part. Quatre lots entrent dans ① — `P1-020` (1), `P1-021` (0,5), `P1-022` (0,5),
`P1-023` (0,5) — et le cinquième, les **rebonds asynchrones**, était déjà `P2-015`
(②). **① : 115,5 → 118 ; restants 12,25 → 14,75.** Projection refaite :
**14,75 ÷ 2,3 ≈ 6,4 semaines**, soit le **code du jalon vers fin octobre 2026**
(6,4 semaines depuis le 12 septembre ≈ le 27 octobre — le quotient tombe là, pas en
novembre), puis la **mise en service début–mi novembre** : la marge entre les deux
est **nommée**, ce sont les 4 jours d'accompagnement, qui ne se compressent pas.
*(Corrigé le 12 sept. au soir : une première rédaction datait le code « début–mi
novembre » — c'était la date du service, pas du code. Troisième dérive de ce
chiffre ; la règle qui en sort : la projection s'écrit toujours en deux dates,
code **et** service, chacune avec son calcul.)* Le chiffre glisse parce qu'il
**cesse d'ignorer** ce qui bloque vraiment le
lundi matin — un chiffre vrai qui glisse vaut mieux qu'un chiffre confortable qui
ment. La preuve d'envoi de `P1-018` **n'est pas faite** et attend `P1-020`/`P1-021`
(le vrai parcours, pas du SQL).

**Recompté le 12 septembre 2026, dernier tour — les cinq manques sont fermés le
jour où ils ont été trouvés.** `P1-021` → `P1-020` → `P1-022` → `P1-023` bâtis,
prouvés en local, fusionnés (PR #88 à #90), chaque estimation **tenue** ; `D-028`
écrit rétroactif (0,25, le correctif #418 — même geste que `D-012`/`D-017`).
**① : 118,25, dont 106 faits et 12,25 restants.** Projection, en deux dates comme
la règle du jour l'exige : **12,25 ÷ 2,3 ≈ 5,3 semaines → code vers le ~20 octobre
2026 ; mise en service fin octobre – début novembre** (la marge = les 4 jours
d'accompagnement). Le bilan du jour qui explique le raccourci : **sept lots de
code fusionnés en un jour** — l'émetteur, sa reprise, l'hydratation, la CI, et les
trois verrous du parcours — parce qu'une répétition de mise en service a montré où
frapper. Ce qui reste devant le jalon n'est plus du code de parcours : la preuve
hébergée de `P1-018` (recopie dashboard + redéploiement, actions commanditaire),
`D-023` (la politique), le build TestFlight, la sauvegarde restaurée. *(Troisième
branche `docs/` du 12 : commandée explicitement, et c'est de la tenue de grand
livre, pas de l'inflation de tickets — l'intention du quota, pas sa lettre.)*

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
ne bloque rien mais expose, avec une échéance qui n'est plus lointaine.** **Un
compte de développement** reste depuis `P1-007` — le projet **Firebase** (canal
Android, **remonté à la ② / `P2-024`, prioritaire, 16 sept. 2026**) ; **Expo/EAS a été lié le 11 septembre** et sort de
cette liste comme Apple, le `projectId` est dans `app.json`.
**Aucune ne se rattrape en codant plus vite.** Elles ne vivent nulle part
ailleurs dans le dépôt : ni un ticket, ni un test, ni la CI ne les rappellera.

| Quoi | Bloque | Pourquoi maintenant |
| --- | --- | --- |
| ~~**Trois `client_id` Google**~~ | ~~P0-005b~~ | **Sort du chemin critique le 8 sept. 2026** — non parce qu'elle est faite, mais parce que `P0-005b` passe **non programmé** : câbler un SSO tiers rend `P2-003` obligatoire (guideline 4.8). Voir ci-dessous |
| ✅ ~~**Compte développeur Apple**~~ | ~~`P1-007`, `P1-006`, `P1-003b`, `P2-003`~~ | **Actif le 8 septembre 2026**, jusqu'au 8 sept. 2027, renouvellement automatique. App Store Connect ouvert. Il aura été le premier rang pendant deux jours |
| ✅ ~~**Compte Expo/EAS**~~ | ~~la preuve appareil du push + le build TestFlight de `P1-016`~~ | **Lié le 11 septembre 2026** — projet `@mhdsahli/rack`, `projectId` dans `app.json` (`extra.eas.projectId`). **Sort du chemin critique comme Apple l'a fait.** Reste, côté build : `eas device:create` puis `eas build -p ios --profile development`, piloté sur le compte Apple qui porte l'abonnement — c'est ce build qui prouve les critères appareil de `P1-007` |
| **Projet Firebase** (+ identifiants FCM, + un appareil Android) | le **canal Android** du push, donc `P2-024` puis `P2-025` | **Remonté à la ② le 16 sept. 2026 — prioritaire (`P2-024`).** Le code est plateforme-agnostique (Expo Push route vers FCM), mais Android exige un projet Firebase **et** un appareil de test — aucun des deux n'existe. N'attend plus la mise en service |
| **Compte Google Play Developer** (25 $, une fois) | la soumission Play (`P2-025`) | **Nouveau sur cette liste (16 sept. 2026).** Distinct du projet Firebase et du compte Apple. À vérifier : existe-t-il ? |
| **Activation de Stripe Connect** | P2-001, donc tout l'argent | Vérification d'identité de la société — **donc l'entité juridique, ligne suivante** |
| **Une entité juridique** | rien — **mais expose, personnellement** | **Cette ligne n'avait qu'une conséquence jusqu'au 9 sept. 2026 : Stripe, sans échéance avant mi-2027. Elle en a deux.** Le jour de `P1-016`, **l'éditeur du service** devient **sous-traitant de la box au sens de l'art. 28** (spec §15.1 : « sans ce document, vous êtes en infraction dès le premier client »). Une personne physique peut l'être — ce n'est pas bloquant — mais jusqu'à la société, c'est **un nom d'état civil** qui signe le DPA et porte le registre. **Échéance : la mise en service, pas le MVP.** Les trois pièces — DPA, registre, politique de confidentialité — sont des prérequis datés de `P1-016` |
| ✅ ~~**Un nom de domaine** (+ SPF, DKIM, DMARC)~~ | ~~P2-015, D-008, le retour Apple, `P1-016`~~ | **✅ prouvé le 12 septembre 2026 — sort du chemin critique comme Apple et Expo.** `rack-app.fr` signé par **Brevo** : magic link reçu en boîte, **`SPF/DKIM/DMARC = pass`** (`d=rack-app.fr`, sélecteur `brevo2`), expéditeur `Rack <bonjour@rack-app.fr>`, **code à 6 chiffres**, `mail-tester` **7,9/10** (les 2,1 = un pixel de suivi, sans effet sur remise/auth). État réel dans `docs/procedures/email-et-domaine.md` (DNS OVH, sous-domaine de marque `mail.`, Zimbra, gabarits hébergés recopiés, OTP à 6, suivi anonymisé, deux dates d'expiration) ; `P1-017` ferme ses deux critères d'e-mail. **Ce qui n'est PAS le domaine** : le **build TestFlight** vers lequel `RACK_INVITE_URL` doit pointer — dépendance de `P1-016` qui bloque l'envoi des 80, pas cette ligne |

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

## ① Jalon pilote — 118,25 j·h, dont **11,75 restants**

*(Recompté le 15 sept. 2026 : `D-023` passe aux faits — 106,5 faits. Ce qui
reste devant le jalon est désormais tout sauf du code : la preuve hébergée de
`P1-018`, le build TestFlight n°4 et sa passe, la sauvegarde restaurée, la
relecture juriste de la politique, la mise en service.)*

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
  P1-015 ✅ → D-021 ✅ → P1-008a ✅ ∥ P1-017 → P1-007 (re-fusionné) → P1-006
  Le WOD passe devant le pointage : sans lui, le coach ouvre deux applications
  pendant tout le pilote.
  D-021 s'intercale le 9 sept., après la passe : P1-015 est fusionné et sa
  valeur est nulle tant que son seul utilisateur n'atteint pas l'écran.

CE QUI RESTE, ET CE QUI LE RETIENT
  D-021 ✅ fait et passé le 9 sept. — A14 ferme le critère d'écran de P1-015.
            PR #68 n'a fusionné que la doc : le code est dans la PR suivante
  P1-008a ✅ fait et passé le 10 sept. (PR #72, 5,5) — la première surface de
            l'app réservée à un rôle. Sa prep différée est faite avec sa clôture :
            découpe P1-007a/b (re-fusionnés le 11 sept.) + amendement d'ADR 0004.
  P1-017  ⟵ rien — la première infrastructure de production. **Le prochain**
            côté technique, mais il crée des comptes hébergés (Supabase, Vercel)
            que seule la commanditaire ouvre : c'est une procédure à jouer, pas
            du code à écrire ici
  P1-007  ⟵ **Lots 1–3 fusionnés** (décision SQL, émetteur edge function, mobile) ;
            re-fusionné (la découpe a/b reposait sur un appareil Android qui
            n'existe pas — règle 10). Dev build iOS fait le 11 sept.,
            device-registration prouvée. **Les deux [ ] d'appareil (iOS < 30 s,
            rack://) sont derrière le lot hébergé + émetteur de P1-017** — jouer
            § 5 nonies sur l'hébergé, pas un montage local. Preuve Android → P1-016
  P1-006  ⟵ P1-007 (l'émetteur) pour la promotion de liste d'attente ; sa
            garantie « 30 s » se prouvera à la passe § 5 nonies (hébergée) de P1-007
  P1-009 → P1-001f  ⟵ rien. Après la démo
  D-008   ⟵ le nom de domaine, seul blocage de sa ligne

NON PROGRAMMÉS, chacun avec son déclencheur
  P0-005b · P1-005b · P1-013
  P1-008b ⟵ tout ce qui scanne. À la première box qui n'est pas la pilote.
  D-022   ⟵ le filet qui ouvre un navigateur (dette ④, 1,5). Deux déclencheurs :
            un second défaut « une porte, un rôle », ou l'ouverture de P2-001.

  D-024   ⟵ le compte-rendu d'annulation au back-office (« X prévenus, Y non,
            notifications coupées »). Trouvé à la passe partielle de P1-007 :
            l'enfilage marche, mais rien ne le dit au staff — et le doute a coûté
            vingt minutes à qui connaissait le code. Chiffré 1,5, hors ①.
            Déclencheur : la mise en service (P1-016), où une annulation réelle
            rencontre le doute réel.

  LES MANQUES DE MISE EN SERVICE (trouvés le 12 sept. en répétant l'envoi de
  bout en bout — il a fallu trois contournements SQL), TOUS FERMÉS LE JOUR MÊME
  P1-021 ✅ → P1-020 ✅ → P1-022 ✅ : l'OWNER se connecte, crée sa box, l'accueil
            l'y mène — le parcours entier prouvé en local, sans SQL.
  P1-023 ✅ pnpm heberge:derive, joué contre la vraie base (deux issues).
            (3.4 rebonds asynchrones → P2-015, ②, pas un ticket neuf)
        ↓  La PREUVE de P1-018 se rejoue par le vrai parcours, SUR L'HÉBERGÉ :
           elle attend la recopie dashboard de P1-021 (action commanditaire,
           contenu exact dans le ticket) + un redéploiement — plus aucun code
  D-023   ✅ code fait le 15 sept. — le texte a été rédigé et validé par la
            commanditaire le jour même, ce qui a ouvert le ticket : page
            publique /politique-de-confidentialite (FR+EN, date en tête),
            lien depuis consents.tsx, constante à 2026-09-15 par MIGRATION
            AJOUTÉE (bascule règle 13 : l'hébergé existe, heberge:derive ne
            compare que les noms), seed sur current_policy_version(), test
            qui lie constante et texte. Reste [ ] : le geste d'appareil
            (§ 5, geste 3 bis) et, hors ticket, la relecture juriste + les
            champs [Nom de la box] avant l'import réel (P1-016).
            db push à faire vers l'hébergé — les comptes d'essai recocheront
            (consentements 2026-08-01 périmés : voulu, aucun membre réel).
        ↓
  P1-016  ⟵ LA MISE EN SERVICE. 1,75 j·h de technique (build TestFlight,
            sauvegarde restaurée) + 4 jours d'accompagnement qui ne sont pas
            des j·h. Et trois pièces RGPD datées « avant le premier import ».
        ↓
  ═══ JALON : mise en production chez la box pilote ═══
```

**`P1-007` est livré (lots 1–3), re-fusionné ; le dev build iOS est fait (11 sept.),
et la preuve d'émission attend le lot hébergé + émetteur de `P1-017`.** La découpe
`a`/`b` du 10 septembre est révolue : sa frontière supposait qu'on prouverait
l'émetteur sur un appareil **Android**, or il n'en existe aucun — et un critère
qu'on ne peut pas jouer n'est pas un critère (règle 10). Le canal Android est
**re-daté en prérequis de `P1-016`**, pas annulé : le code livré route déjà vers
APNs ou FCM. Estimation recomptée sur le périmètre entier, `a` et `b` réunis :
**4 → 6 j·h** (détail dans `P1-007-push.md`). La première brique serveur est bien
l'émetteur — une edge function — pas la couche API qu'ADR 0004 annonçait pour
`P1-003` (amendé).

**Le development build a eu lieu le 11 septembre — et il a fermé la moitié
téléphone, pas l'émission.** L'app s'installe et enregistre son jeton ; mais
`supabase start` ne sert pas l'émetteur et l'app pointe la base locale, donc rien
ne part. **Les deux `[ ]` (iOS < 30 s, `rack://`) se prouvent sur l'hébergé, avec
le lot émetteur de `P1-017`** — arbitrage tranché contre un montage local jetable.
La même passe ferme du même coup le reliquat `rack://` de `D-013` et le `[~]` de
`P1-003b`. Ce que l'arbitrage sert exactement : l'inconnu de la chaîne de
notification se lève **pendant `P1-017`**, pas la semaine de la box — la raison
même pour laquelle `P1-017` est sorti de `P1-016`.

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
| P1-006  | Liste d'attente et promotion                      |      6 | ✅ **fusionné le 11 sept. 2026 (PR #80)** — **prouvé en CI** (`waitlist_test.sql`, 37 assertions), pas encore sur appareil. Tranché : **siège tenu par `booked_count`** (sans toucher `book_class`), **rang dérivé** (position immuable), **exemption quiet hours** de la promotion (argumentée contre son alternative). Reste **un `[~]`** : « promotion < 30 s », derrière la passe iPhone de `P1-007`. Un critère reformulé (positions → rang dérivé) et **un défaut ouvert à la clôture → `D-027`**. Porte `waitlist_length` temps réel (repris de P1-005) |
| P1-007  | Notifications push (re-fusionné, passe iPhone en attente) |    6 | **lots 1–3 livrés sur `feat/P1-007-push`** (décision SQL + core/UI · émetteur edge function · mobile) — re-fusionné le 11 sept. 2026 : la découpe `a`/`b` supposait un appareil **Android** qui n'existe pas (règle 10). Harnais vert (pgTAP, `deno test`). **Dev build iOS fait le 11 sept.**, device-registration prouvée (ligne `ios` en base). **Les deux `[ ]` d'appareil (iOS < 30 s, `rack://`) sont derrière le lot hébergé + émetteur de `P1-017`** — l'émetteur doit être déployé et servi pour que la notification parte (arbitrage tranché : l'hébergé, pas un montage local jetable). Preuve Android → prérequis de `P1-016`. Réestimé **4 → 6** |
| P1-015  | La séance du cours, écrite par le coach           |    5,5 | ✅ **clos le 9 sept. 2026 — onze critères verts.** Le **premier ticket venu d'un client réel**, et il est tenu : une séance **par occurrence**, en texte libre, pré-remplissage qui **copie sans lier**, troisième protection contre le rafraîchissement de série. Fusionné incomplet (PR #63), il a fallu **trois passes** pour le clore : `D-021` (la porte du coach + la place du panneau, A14 ✅), puis les **gestes 7 et 8** — NOK à la passe, le **piège 13** (la policy de lecture masquait l'archivé à tout le monde, PostgreSQL 17 refuse alors l'`update` qui archive), sa **sœur** cassant « supprimer une série » **depuis P1-002**, corrigé (`fix/P1-015-gestes-7-et-8`, **5 → 5,5**) et **rejoué OK sur `main`**. Reste hors critère le seul repère qui compte : la semaine chronométrée vs Hustle Up, à `P1-016` |
| P1-008a | Le coach coche sa feuille, et l'absent est marqué  |    5,5 | ✅ **clos le 10 sept. 2026** (PR #72) — fusionné **et** passe iPhone jouée le jour même (§ 5 octies, geste 8 compris : le membre refusé par l'adresse). Quatre lots : base SQL (présence sur `bookings`, vue coach, `set_attendance()`, job de no-show), core, deux champs web, mode coach mobile. `test:db` vert (498), `rls-auditor` **SAFE**. **Réestimé à l'ouverture 3,75 → 5,5** : +1,25 (l'écran est un mode) + 0,5 (`class_roster` peer-scoped → **vue neuve** + 4e audience RGPD tranchée). La **première surface de l'app réservée à un rôle** |
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
| P1-016  | La mise en service chez la box pilote             |   1,75 | à faire, **en dernier** — écrit le 9 sept. 2026, entré dans ① le jour même (PR #64), **puis découpé après PR #65** : le projet hébergé et le déploiement partent dans `P1-017` pour ne pas concentrer l'inconnu la semaine de la box. Reste ici ce qui dépend vraiment du reste — build TestFlight, sauvegarde restaurée — **+ 4 jours d'accompagnement** qui ne sont pas des j·h. **Et le RGPD y est daté** : DPA, registre, politique de confidentialité **avant le premier import** — la sous-traitance art. 28 commence le jour de la mise en service, et `consents.tsx` horodate depuis le 31 août un consentement à une politique **qui n'existe pas**. **Volet domaine/SMTP prouvé le 12 sept. 2026** (Brevo signé, `SPF/DKIM/DMARC = pass`, runbook `email-et-domaine.md` à l'**état réel**) — ~0,25 de la moitié « invitations », **dedans** ; le reste — **l'émetteur d'invitations** — est **`P1-018`**, fusionné + reprise le 12 sept. L'effectif rejoint par **appariement d'e-mail** (`accept_pending_invitation`), pas par jeton — la note « liens D-005 » du volet est **corrigée**. **Reste bloquant l'envoi des 80** : le **build TestFlight** (lot 1,25 ici), vers lequel `RACK_INVITE_URL` pointe — pilote iOS-seul tranché le 12 sept. |
| P1-017  | La première infrastructure de production          |    1,5 | ✅ **fusionné le 11 sept. 2026 (PR #79)** — projet Supabase hébergé (`eu-west-3`, PG **17.6** lu), `pg_cron`/`pg_net`/`vault` par migration, **émetteur push déployé et servi**, back-office sur Vercel. `test:db` distant vert, parité des droits (`auto_expose_new_tables=false`). **Deux critères d'e-mail fermés le 12 sept. 2026** : e-mail signé reçu (`SPF/DKIM/DMARC = pass`) et SMTP tiers prouvés — le volet `P1-016` est passé de câblé à **prouvé**. Runbooks : `deploiement-heberge.md`, `email-et-domaine.md` |
| P1-018  | L'émetteur d'invitations du pilote                |    1,5 | ✅ **clos le 12 sept. 2026 (soir)** — fusionné le matin (PR #84 + reprise #85), **prouvé le soir sur l'hébergé par le parcours réel, sans SQL** : import 3 adresses (0 doublon), envoi → 3 reçues en secondes, **reclic immédiat → 0 envoyée**. **L'idempotence — le critère central — est prouvée par le vrai chemin.** Deux `[~]` transférés à `P1-016` : l'échec synchrone **à l'écran** (aucune adresse morte dans le lot de 3) et l'envoi réel des 80 (bloqué par le build TestFlight + garde-fou `RACK_INVITE_URL`) |
| D-023   | Le consentement pointe vers un texte, et la constante en porte la date | 0,5 | ✅ **code fait le 15 sept. 2026** — le texte rédigé et **validé par la commanditaire le jour même** a ouvert le ticket. Page publique `/politique-de-confidentialite` (FR + EN, date **et** version brute en tête), lien `consents.tsx` (`Linking.openURL`), constante à `2026-09-15` **par migration ajoutée** — première application de la bascule règle 13 : l'hébergé existe et `heberge:derive` ne compare que les noms, une édition en place y serait invisible. Seed sur `current_policy_version()` (plus de date en dur — le test l'interdit), Léa témoin (`db:reset` → `me()` sans `ACCEPT_CONSENTS`, prouvé SQL), hash Turbo prouvé par modification réelle. `rls-auditor` SAFE, sœurs confirmées (seule `me()` compare la version). **Reste** : geste d'appareil (§ 5, 3 bis), `db push` hébergé (les comptes d'essai recocheront — voulu), et **hors ticket** la relecture juriste + champs `[…]` avant l'import réel (`P1-016`) |
| P1-020  | Créer la box pilote (appelant de `create_tenant`) |      1 | ✅ **fusionné le 12 sept. 2026 (PR #88)**, estimation tenue et ratifiée. `create_tenant` a **enfin un appelant** (règle 7, depuis P0) : page `/creer-une-box` + action serveur, minimal — le self-onboarding complet reste `P2-004`. **Prouvé en local de bout en bout** (session réelle, aucun SQL) : formulaire → `303` → `/box/box-pilote-test 200`, OWNER en base. Critère d'appareil ouvert : la box pilote **réelle** naît par ce chemin, sur l'hébergé |
| P1-021  | La première connexion web aboutit                 |    0,5 | ✅ **fusionné le 12 sept. 2026 (dans PR #88** — sa branche portait P1-020**)**, estimation tenue. « Confirm sign up » gagne le lien `{{ .ConfirmationURL }}` ; **deux défauts d'e-mail absorbés** : la copie « Lien envoyé » (l'ex-D-0xx du lot doc) et l'objet unique par envoi (`{{ .Token }}` dans l'objet, vérifié Mailpit — Gmail n'empile plus). **Prouvé en local** : adresse neuve → lien → session. **Reste une action commanditaire** : recopie dashboard (body + deux objets, contenu exact dans le ticket) |
| P1-022  | L'accueil web mène à sa box                        |    0,5 | ✅ **fusionné le 12 sept. 2026 (PR #89)**, estimation tenue. L'accueil devient serveur : une box → `redirect /box/[slug]` (**prouvé** : `307 → 200`) ; plusieurs → choix ; aucune → créer/rejoindre ; déconnecté → « Se connecter ». Placeholder retiré, lien système de design **dev-only** (règle 9). Ferme le troisième verrou du parcours (P1-021 → P1-020 → P1-022) |
| P1-023  | Un signal quand l'hébergé décroche                 |    0,5 | ✅ **fusionné le 12 sept. 2026 (PR #90)**, estimation tenue. `pnpm heberge:derive` : migrations comparées **dans les deux sens** contre la base hébergée liée (lecture seule), trois issues nommées (`À JOUR` / `DÉRIVE` / `ILLISIBLE` — jamais un vert par défaut, auto-recoupement à la D-014). **Les deux issues jouées contre la vraie base.** Le vert nomme sa portée : build web et Site URL restent à la checklist |
| D-028   | L'accueil s'hydrate dans la langue du serveur *(rétroactif)* | 0,25 | ✅ **fait le 12 sept. 2026 (PR #86)** — écrit après coup, comme `D-012`/`D-017` : le correctif du **React #418** de l'accueil déployé (langue lue au rendu → SSR fr / client navigateur) ne figurait dans aucun total. Premier rendu = repli des deux côtés, langue du navigateur **après montage** (`deviceLocale`, rang 3) ; mobile et back-office inchangés |
| P1-024  | L'invitation en attente s'accepte sur mobile       |      1 | ✅ **fusionné le 13 sept. 2026 (PR #92)**, estimation tenue — **le chaînon manquant du parcours des 80**, trouvé par le test de bout en bout du 12 au soir : `accept_pending_invitation()` n'avait **aucun appelant mobile** (règle 7, le motif `create_tenant`) ; un membre importé qui se connectait dans l'app tombait sur « Aucune box pour l'instant ». L'accueil sans box liste ce qui attend l'adresse et fait rejoindre. **Cinq critères prouvés au harnais** (compte neuf → box visible → rejoint aux couleurs de Rueil ; D-016 ; expiration propre — un défaut trouvé et corrigé par ce geste). Reste le `[~]` d'appareil, derrière le build TestFlight (`P1-016`) |
| D-029   | Les gabarits d'e-mail rougissent quand ils décrochent | 0,75 | ✅ **bâti le 13 sept. 2026** — **3ᵉ dérive dashboard ↔ dépôt le 12 sept.** (première connexion propriétaire cassée jusqu'à la recopie). `pnpm gabarits:derive`, sœur de `heberge:derive` : lecture seule de la config Auth hébergée (API de gestion, jeton `SUPABASE_ACCESS_TOKEN` au moment du geste, jamais stocké — `config push` **exclu**, il écraserait `site_url`), corps **et** objets, trois issues nommées. **Les trois jouées le 13 sept.** : À JOUR et DÉRIVE contre un simulateur local de l'API (script tel quel, CRLF/bords encaissés), ILLISIBLE en réel sans jeton. **Reste un geste commanditaire** : les deux issues contre la vraie config, avec ton jeton (mode d'emploi dans le ticket) |
| D-030   | Le mapping CSV reconnaît ses propres clés          |   0,25 | ✅ **fait le 13 sept. 2026** — constat mineur du test du 12 : `guessMapping()` reconnaissait `first name` mais pas `first_name`/`last_name`, les clés **que le produit utilise lui-même**. Le tiret bas vaut espace dans `normalise()` (toutes les clés snake_case d'un coup, `E_MAIL` compris), test écrit avant le correctif, 20/20 |
| D-031   | La build de production démarre sans `.env.local`   |   0,25 | ✅ **fait le 13 sept. 2026** — le premier test TestFlight a trouvé un **crash au lancement** : les `EXPO_PUBLIC_*` ne vivaient que dans `.env.local`, gitignoré, jamais uploadé vers EAS, et `readSupabaseConfig()` lève (à raison) quand elles manquent. Blocs `env` versionnés dans `eas.json` (`preview` **et** `production` — la sœur), valeurs publiques par construction ; garde-fou `eas-env.test.ts` **prouvé mordant** (variable retirée + clé non-`EXPO_PUBLIC_` → 2 rouges). `app.json` passe en `1.0.0`. Reste le critère d'appareil : la build suivante se lance — la re-passe TestFlight |
| D-032   | Un timeout de l'hébergé ne rend plus un 500 nu     |   0,75 | ✅ **fait le 13 sept. 2026** — `Gateway Timeout` **intermittents** sur l'hébergé gratuit (logs Vercel), remontés en 500 nus : les wrappers lèvent et rien n'attrapait. Trois étages : transport résilient (`resilient-fetch.ts`, testé — délai 5 s, rejeu **borné aux lectures GET/HEAD** car un POST rejoué sur 504 peut doubler une écriture, journal des requêtes lentes **sans query string**), frontières d'erreur (`[slug]` + racine, « Réessayer »), et le `contexte()` des **cinq** fichiers d'actions (sœurs : le rapport n'en nommait que deux) rend un état qui préserve la saisie. Une requête `classes` de moins sur le planning. **La mesure qui manquait est posée** : les logs diront si le plan gratuit est le facteur — la donnée qui arme le critère Pro de `P1-016`. Reste `[ ]` : l'observation à la prochaine occurrence réelle |
| P1-025  | Changer les places d'UNE occurrence                |   0,75 | ✅ **fait le 14 sept. 2026** — priorité 1 du lot d'usage. Champ « Places » au panneau (admin seulement), action dédiée, `is_override` posé. **Prouvé au harnais sur une vraie course** : écran à 5 réservations, base à 8, soumission de 6 → refus `role="alert"` avec le message ; puis 8 réservations → 20 places, grille et base d'accord, série intacte. Le `23514` de la contrainte rend la même clé si la course perd après la pré-lecture |
| P1-026  | Un cours ponctuel, sans série d'un jour            |   1,25 | ✅ **fait le 14 sept. 2026** — migration `schedule_id` nullable + invariant `check (schedule_id is not null or is_override)` : dérogatoire **par construction**, double ceinture (les refresh joignent `s.id`, l'invariant interdit le cas qui y échapperait). pgTAP 9 assertions dont **la réservation d'un ponctuel par `book_class()`** ; `rls-auditor` **SAFE** (question des sœurs : seule la sœur TypeScript `Occurrence` supposait NOT NULL, corrigée). Harnais : WOD ponctuel posé sur un jour vide, séries intactes. Bouton secondaire à côté de « Nouvelle série » |
| P1-027  | La liste des inscrits d'un cours, au back-office   |      1 | ✅ **fait le 14 sept. 2026** — `class_attendance_sheet` gagne `last_name` (noms complets pour tout le staff, décision ratifiée, **exception datée dans `privacy.md`** ; `last_initial` reste servi — la projection minimisée du kiosque `P1-008b`) ; **portée BOX conservée**, le strict « ses cours » (§5.2) reporté par décision datée. Panneau web « Inscrits — n sur capacité », **une requête pour toute la semaine** (motif D-032), lecture seule — cocher reste au mobile. pgTAP 29 (les asserts du nom sous session **COACH**), `rls-auditor` **SAFE** (4 questions des sœurs), harnais : Julie Kaczmarek et Léa Martin au panneau |
| P1-028  | « Reprendre une séance » filtre par type de cours  |   0,25 | ✅ **fait le 14 sept. 2026** — jamais entre types, test réécrit avant le correctif (rouge constaté, 11/11 après). **Renversement daté d'une décision de P1-015** (« s'il y a un Haltéro dans la journée… ») : l'usage réel a dit l'inverse, signalé et tracé dans l'en-tête de la fonction, pas écrasé |
| P1-029  | La séance publiée prévient ceux qui ont réservé    |    1,5 | ✅ **fait le 14 sept. 2026** — `WORKOUT_UPDATED` + producteur dans la même migration, appelé par `saveWorkout` **si le texte a changé**, échec d'enfilage jamais bloquant (journalisé). **Deux corrections tracées** : ① « quiet hours → différé » était faux — mesuré, elles **écartent** (aucun report n'existe), écrit au ticket et à la migration ; ② `rls-auditor` a rendu **LEAK** sur le premier jet — `p_now` client contournait les quiet hours (la sœur du piège 7, sur l'horloge) — corrigé par la coupure interne révoquée / porte publique qui fixe `now()`, **SAFE contre-vérifié**. pgTAP 10/10 (dont « l'interne est inatteignable même pour le staff »), émetteur 13/13 **sous Deno**. Reste le `[~]` d'appareil → passe TestFlight avec P1-007 |
| D-033   | Les boutons du panneau de séance, relus            |   0,25 | ✅ **fait le 14 sept. 2026** — la hiérarchie D-021 appliquée en trois poids : « Enregistrer » seul primaire à droite, la jauge en secondaire, « Annuler ce cours » **isolé sous son propre trait**, « Fermer » en **lien discret** (le 3ᵉ bouton de même poids était le reproche). Arbre d'accessibilité vérifié : ordre de lecture, chaque bouton annoncé par son geste |
| D-034   | Un fond visuel web, branché sur le thème           |   0,25 | **non programmé, hors ① — s'ouvre à la livraison de l'asset** (fourni par la commanditaire, jamais généré). La contrainte est posée d'avance : le slot passe par le thème (`--rack-*`), pas un `url(…)` en dur |
| D-035   | La grille web dit à quelle heure on ressort        |   0,25 | ✅ **fait le 14 sept. 2026** — la carte affiche la plage « début – fin » (même écriture que le mobile) ; `ends_at` existait en base sans jamais atteindre l'écran web. Web seulement |
| D-036   | Le compteur de build vit chez EAS                  |   0,25 | ✅ **fait le 14 sept. 2026** — `appVersionSource: "remote"`, le `buildNumber` sort d'`app.json` (plus de second compteur à désynchroniser — la collision du n°3, payée le jour de la première soumission). Runbook mobile à jour ; reste le **geste commanditaire** unique : `eas build:version:set` aligné sur App Store Connect avant la prochaine build |
| D-037   | Le jeton push ne s'enregistre qu'au redémarrage    | 0,75 | ✅ **fait le 18 sept.** (PR #120) — **test Android `P2-024`, 18 sept.** : l'effet d'enregistrement (`push.ts`) dépend de `[userId, activeTenantId]`, pas du passage de la préférence push à `true` → jeton posé au prochain démarrage seulement |
| D-038   | L'en-tête du planning déborde en français          |  0,5 | ✅ **fait le 18 sept.** (PR #120) — **test Android `P2-024`, 18 sept.** : libellés FR plus longs → la date centrale s'écrase et se casse syllabe par syllabe. Correctif = flèches ‹ › + libellé a11y (déjà prévu par le commentaire) |
| D-039   | Les appels `Notifications` plantent l'app sur le web | 0,25 | ✅ **fait le 18 sept.** (PR #120) — **trouvée pendant `D-038`, 18 sept.** : effet 3 de `push.ts` (`getLastNotificationResponseAsync`) non gardé par `Platform.OS` → tout écran authentifié plante sur le harnais web. Garde `Platform.OS !== 'web'` |
| D-040   | Sélecteur de langue en session (back-office)       |  0,5 | ✅ **fait le 18 sept.** (PR #125) — ⟵ test back-office : : le back-office suit navigateur > `users.locale`, jamais la langue de la box → aucun levier pour basculer EN. Débloque la vérif EN de P2-022 |
| D-041   | La porte `/check` ne lance pas `i18n:check`        | 0,25 | ⟵ **18 sept.** : `main` passé rouge i18n (clés orphelines) sans alerte car la porte n'inclut pas `i18n:check`. Faux vert |
|         | **Total ①**                                       | **126,75** | dont **114,5 faits**, **12,25 restants** |

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
| `P1-015` 5 → 5,5 : les gestes 7 et 8 rouges à la passe, le piège 13 et sa sœur | 110 | 88,75 | 21,25 |
| `P1-008a` réestimé à l'ouverture 3,75 → 5,5 (+1,75) : l'écran est un mode, et la vue coach était à créer | 111,75 | 88,75 | 23 |
| `P1-008a` fait et passé le 10 sept. (5,5) | **111,75** | **94,25** | **17,5** |
| **`P1-007` re-fusionné et réestimé 4 → 6 (+2)** : la frontière `a`/`b` reposait sur un appareil Android qui n'existe pas (règle 10) ; le re-cadrage Android→iOS est un wash | **113,75** | 94,25 | **19,5** |
| **`P1-017` +0,25** : l'émetteur push déployé sur l'hébergé (`pg_net`, `functions deploy`, `push_emitter_url`) — le lot qui rend § 5 nonies de `P1-007` jouable sur la chaîne réelle, hors de la semaine de la box | **114** | 94,25 | **19,75** |
| **`P1-017` fusionné (PR #79), 11 sept.** : lots hébergés réalisés (projet, émetteur, web déployé) — les 1,5 passent aux faits. Les `[~]`/`[ ]` de preuve qui restent sont des critères d'appareil, pas des j·h non faits | 114 | 95,75 | 18,25 |
| **`P1-006` fusionné (PR #80), 11 sept.** : waitlist prouvée en CI (`waitlist_test.sql`, 37 assertions) — les 6 passent aux faits. Reste un `[~]` d'appareil (« < 30 s ») et un défaut ouvert, `D-027` (hors ①) | **114** | **101,75** | **12,25** |
| **`P1-018` entre dans ① (1), 12 sept.** : l'émetteur d'invitations, carve-out de la moitié « invitations » de `P1-016` — il y était **sous-budgété** (les 1,25 étaient le build/TestFlight + le câblage 0,25 ; l'émetteur, presque rien). Pas d'absorption silencieuse — **à ratifier à la fusion** | **115** | 101,75 | **13,25** |
| **`P1-018` fusionné (PR #84) et ratifié 1 → 1,25, 12 sept.** : le sous-budget confirmé, écrit et non absorbé | **115,25** | 103 | 12,25 |
| **Reprise `P1-018` (PR #85, +0,25), 12 sept.** : réservations mortes reprises + `failed_permanent` — trouvée en revue, écrite, pas absorbée | **115,5** | **103,25** | **12,25** |
| **Cinq manques de mise en service entrent, 12 sept. (soir)** : `P1-020` (1) + `P1-021` (0,5) + `P1-022` (0,5) + `P1-023` (0,5) = **+2,5** ; `P1-018` 3.4 (rebonds async) va à `P2-015` (②), pas dans ①. Trouvés en répétant la mise en service, chiffrés, pas absorbés | **118** | 103,25 | **14,75** |
| **Les quatre bâtis et fusionnés le jour même** (PR #88 — qui porte aussi P1-021 —, #89, #90), chaque estimation **tenue et ratifiée** : les 2,5 passent aux faits. Preuves locales jouées ; restent les critères d'appareil (hébergé) | 118 | 105,75 | **12,25** |
| **`D-028` rétroactif (0,25), fait** : le correctif React #418 de l'accueil (PR #86) ne figurait dans aucun total — troisième fois, même geste que `D-012`/`D-017` | **118,25** | **106** | 12,25 |
| **Le test de bout en bout du 12 (soir) clôt `P1-018` et ouvre trois lignes, 13 sept.** : `P1-024` (1, le chaînon mobile du parcours des 80 — règle 7, aucun appelant mobile d'`accept_pending_invitation`) + `D-029` (0,75, filet gabarits — 3ᵉ dérive) + `D-030` (0,25, mapping CSV) = **+2**. Trouvées par le parcours réel, chiffrées, pas absorbées | **120,25** | 106 | **14,25** |
| **`P1-024` fusionné (PR #92), 13 sept.** : cinq critères prouvés au harnais web ; reste le `[~]` d'appareil, derrière le build TestFlight | 120,25 | **107** | **13,25** |
| **`D-029` bâti, 13 sept.** : les trois issues jouées (simulateur pour À JOUR/DÉRIVE, réel pour ILLISIBLE) ; la passe contre la vraie config est un geste commanditaire (jeton), nommé au ticket | 120,25 | **107,75** | **12,5** |
| **`D-030` fait, 13 sept.** : le tiret bas vaut espace dans `normalise()`, test avant correctif — le dernier lot ouvert par le test du 12 est fermé | 120,25 | **108** | **12,25** |
| **`D-031` entre et sort le même jour (+0,25), 13 sept.** : le premier test TestFlight trouve un crash au lancement — build EAS sans les `EXPO_PUBLIC_*` (`.env.local` ne voyage pas). Correctif versionné + garde-fou mordant ; la re-passe TestFlight dira si l'app se lance | **120,5** | **108,25** | 12,25 |
| **`D-032` entre et sort le même jour (+0,75), 13 sept.** : les `Gateway Timeout` de l'hébergé gratuit remontaient en 500 nus — transport résilient + frontières d'erreur + `contexte()` des cinq fichiers d'actions, et la **mesure** des requêtes lentes qui manquait pour arbitrer le passage Pro | **121,25** | **109** | 12,25 |
| **Le lot d'usage pilote entre (+5,25), 14 sept.** : cinq tickets P1 (capacité d'occurrence 0,75 + ponctuel 1,25 + inscrits 1,25 + filtre type 0,25 + push séance 1,5) + la passe boutons (0,25) — remontés par l'usage réel du back-office, priorisés par la commanditaire, chiffrés à l'ouverture. `D-034` (fond web) reste hors ①, déclencheur : l'asset | **126,5** | 109 | **17,5** |
| **Décisions ratifiées + `P1-025` fait, 14 sept.** : `P1-027` 1,25 → 1 (−0,25 : le resserrage de portée coach sort, décision datée) ; `P1-025` prouvé au harnais sur une vraie course, les 0,75 passent aux faits | **126,25** | **109,75** | **16,5** |
| **`P1-026` fait, 14 sept.** : la seule migration du lot (nullable + invariant), pgTAP avec `book_class()` sur un ponctuel, `rls-auditor` SAFE, harnais joué — les 1,25 passent aux faits | 126,25 | **111** | **15,25** |
| **`P1-027` fait, 14 sept.** : la vue gagne `last_name` (exception datée, `privacy.md`), portée box conservée, une requête pour toute la semaine — la priorité 1 du lot d'usage est **entièrement livrée** | 126,25 | **112** | **14,25** |
| **`P1-028` fait, 14 sept.** : le pré-remplissage ne traverse plus les types — renversement daté d'une décision P1-015, signalé règle 6 | 126,25 | **112,25** | **14** |
| **`P1-029` fait, 14 sept.** : le push de séance câblé sur la chaîne P1-007 — un LEAK d'audit trouvé et fermé avant commit (`p_now` client vs quiet hours), l'hypothèse « différé » du ticket corrigée par la mesure. **Le lot d'usage pilote du 14 sept. est entièrement livré** (P1-025→029) ; reste D-033 (cosmétique) | 126,25 | **113,75** | **12,5** |
| **Passe hébergée + `D-033` fait, 14 sept. (soir)** : `heberge:derive` À JOUR (51 migrations), émetteur redéployé (curl 200), web réaliasé ; **build TestFlight 1.0.0 n°4 soumise** (correction du 14 au soir : la n°3 est celle de la collision de compteur → `D-036` — les critères d'appareil de D-031/P1-007/024/029 se datent contre la **n°4**). `P1-025` **validé sur l'hébergé** (passe commanditaire). **Quiet hours ratifiées** : comportement mesuré conservé, consigne « publier avant 21 h » aux consignes d'accompagnement de `P1-016`. D-033 : hiérarchie du panneau en trois poids | 126,25 | **114** | **12,25** |
| **Passe web hébergée complète + deux dettes courtes (+0,5), 14 sept. (soir)** : `P1-026`, `P1-027`, `P1-028` **validés sur l'hébergé à l'écran** (ponctuel présent dans la grille et absent des Séries, survivant aux modifs de série ; inscrits en noms complets ; « reprendre » filtré dans les deux sens) — annulation/rétablissement re-vérifiés. `D-035` (heure de fin sur la grille web) et `D-036` (compteur de build chez EAS, la collision du n°3 fermée) entrent et sortent le jour même | **126,75** | **114,5** | 12,25 |

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

## ② MVP orientée coach — **69 j·h**

Objectif : le coach programme, la box invite ses membres et **gère leur accès à
la main**, et le règlement se fait **hors app** (lien Stripe de la box). Ce que la
spec §13.4 appelait « encaisser sans nous » attend l'entité juridique — sans elle,
pas de Stripe Connect.

**Revue du 16 septembre 2026 — la ② devient « orientée coach », et c'est le retour
du terrain qui la redessine.** Trois décisions de la commanditaire, sur le retour
du coach de la box pilote qui veut la MVP : (1) **pas d'entité juridique pour
l'instant** → pas de Stripe Connect → le règlement passe par un **lien Stripe
externe** du compte de la box, hors app ; (2) l'accès n'est plus piloté par le
paiement mais **attribué à la main** — un abonnement à **durée fixe** (1, 2, 3, 6
ou 12 mois, 12 au plus), la réservation se bloquant une fois la date de fin passée
(RM2.8) ; (3) **« consulter son CA » sort de la MVP** — sans paiement in-app, l'app
n'a pas la donnée : la box lit son chiffre dans son Stripe, et la tuile CA quitte
`P2-004`. En regard, quatre demandes entrent : **identité de marque de la box**
(white-label N0, « pas de Rack dans l'app »), **passe design mobile**, **passe
design web** (inspi Hustle Up), **open gym qui chevauche un cours**. Conséquence
chiffrée : **toute la machine à encaisser** (`P2-001`, `P2-005` à `P2-008`,
`P2-015`, `P2-016` — 35 j·h) sort du chemin critique et attend l'entité ; la MVP
que le coach veut tombe de **80,5 à 63,5 j·h**, dont 45,5 déjà ticketés.
`P2-018` (abonnement manuel) tient la version dépouillée de ce que `P2-006` aurait
fait en Stripe — quand l'entité existera, l'un remplace l'autre sans jeter le
modèle (`member_has_booking_right()` est déjà le point d'accroche prévu, commenté
en ce sens depuis P1-003).

**Ajout du 16 septembre 2026 (même jour) — Android entre dans la ② et il est prioritaire.** Le canal push Android (Firebase + build + preuve) était daté à la mise en service `P1-016`, et le Play Store n'était qu'un `[~]` en queue de `P2-023` : ils deviennent `P2-024` (prioritaire, joué tôt — c'est de la configuration et deux gates, Firebase et un appareil, pas du code neuf) et `P2-025`. **+4,5 j·h, la ② passe de 63,5 à 68.** La box pilote est sur iPhone, mais les vrais membres ne le seront pas tous — un push qui ne marche que sur la moitié des téléphones n'est pas un jalon franchi.

**Passe du 16 septembre 2026 — `P2-018` livré et mergé (PR #107).** La garde RM2.8 est remplie : `member_has_booking_right()` exige une appartenance active **et** un abonnement couvrant la date locale de la box ; ses **deux** appelants en profitent — `book_class()` et `join_waitlist()`, que le ticket ne nommait pas. `member_subscriptions` : durées {1,2,3,6,12} et `ends_on` inclus par CHECK, RLS force, écriture seulement par `grant_member_subscription()` (security definer, audit). 27 assertions pgTAP écrites avant la migration (dont la frontière du lendemain au passage d'heure d'été du 25/10), suite verte, `rls-auditor` SAFE. Trois écarts signalés : la liste des membres vit dans `staff/` (pas `membres/`, qui n'est que l'import) — les tickets d'accès suivants s'y accrochent ; FK en `cascade` pour ne pas bloquer la suppression RGPD ; le seed donne 12 mois à toutes les appartenances (sans quoi les `book_class()` existants rougissaient). Un écart devient un ticket — **`P2-026`** (retrait par bouton, aujourd'hui `deleted_at` en SQL, + filtre `deleted_at` en lecture ; l'oracle, lui, filtre déjà `deleted_at`, donc le retrait bloque bien la réservation — vérifié). Reste en `[~]` : le parcours réel hébergé (db push + geste commanditaire) et le geste d'appareil sur l'accueil (passe TestFlight). **② : +1 (P2-026) → 69 j·h, dont 3,5 faits.**

**Passe des 16–17 septembre 2026 — `P2-026` (PR #109) et `P2-019` (PR #110) livrés.** `P2-026` : `revoke_member_subscription()` (security definer, garde OWNER/MANAGER, audit) est le seul chemin de retrait ; les policies de lecture de `member_subscriptions` filtrent désormais `deleted_at` (l'observation de l'auditeur, fermée) ; +4 pgTAP. `P2-019` : `tenant_settings.payment_link_url` (CHECK `https`, ≤ 2000), onglet « Paiement » aux réglages, bouton « Régler mon abonnement » sur la carte d'accès mobile — visible seulement si un lien est posé, échec de lecture = pas de bouton. Ticket réduit à une seule colonne : `me()` projette ses colonnes et le mobile lit la table via `tenantScope`. Seul `[~]` : l'ouverture réelle du lien sur iPhone (critère d'appareil, daté à `P2-021`). **La boucle accès + paiement est fermée : une box donne un accès, le retire, et affiche son lien de règlement — sans nous. ② : 6,5 j·h faits sur 69.**

### Ordre

```
P2-009 → P2-013b → P2-010 → P2-012 → P2-013 → P2-011 → P2-014   (programmation, puis scores)
P2-017 → P2-018 → P2-019 → P2-020 → P2-004                      (identité, accès, planning, dashboard)
P2-021 → P2-022                                                 (design mobile, puis web)
P2-024                                                         (canal Android : Firebase + build + preuve push — PRIORITAIRE, tôt)
P2-002 → P2-003 → P2-023 ∥ P2-025                               (RGPD, Apple, puis soumission App Store ET Play Store)
```

`P2-018` (l'accès) est le premier à jouer du bloc « gestion » : c'est lui qui
débloque la réservation des vrais membres, et il se branche sur une garde qui
existe déjà.

### État

| Ticket | Titre | j·h | Note |
| ------ | ----- | --: | ---- |
| P2-009  | Le modèle d'entraînement                      |   8 | socle programmation (inchangé) |
| P2-013b | Mes records + calculateur de %                |   3 | l'écran « 60 kg → 50 %, 60 %… » |
| P2-010  | Program Builder                               |   7 | le builder de cycles du coach |
| P2-012  | Le WOD du jour, côté membre                    |   3 | |
| P2-013  | Saisie de score et records personnels         | 4,5 | |
| P2-011  | Rx / Scaled / Beginner, charges en % de 1RM   |   4 | |
| P2-014  | Leaderboard par WOD                           |   4 | |
| P2-004  | Dashboard box et mise en route                |   4 | **sans tuile CA** : présences, remplissage, membres actifs |
| P2-018  | Abonnement à durée fixe, attribution manuelle | 3,5 | ✅ **fait le 16 sept.** (PR #107) — garde RM2.8 remplie (book_class + join_waitlist), member_subscriptions, 27 pgTAP |
| P2-019  | Lien externe de paiement                      |   2 | ✅ **fait le 17 sept.** (PR #110) — payment_link_url (CHECK https), bouton mobile conditionnel |
| P2-002  | Droits RGPD en self-service                   |   5 | exigé pour les vrais membres + Apple |
| P2-017  | Identité de la box partout, zéro « Rack »     |   2 | ✅ **fait le 18 sept.** (PR #115) — audit white-label N0, deux fuites fermées |
| P2-021  | Passe design mobile (+ direction visuelle)    |   4 | **codé, passe iPhone en attente** — direction « Craie & acier », onglets, accueil + planning + réservations + bienvenue/connexion. WOD et carte membre sortis (voir fiche) |
| P2-022  | Passe design web (back-office)                |   3 | **codé et vu en session** (FR, clair/sombre) — coquille repliable, écran Équipe repris, langage CSS commun. Reste : rendu EN, menus à la souris, SVG du logo |
| P2-003  | Sign in with Apple                            |   3 | bloquant de publication |
| P2-023  | Soumission App Store                          |   2 | **neuf** — fiche, captures, notes de revue 3.1.3, labels |
| P2-020  | Open gym qui chevauche un cours               | 1,5 | ✅ **fait le 18 sept.** (PR #113) — `is_open_access`, chevauchement signalé, jamais bloqué |
| P2-024  | Canal Android : Firebase, build, preuve push  | 2,5 | ⏳ **config faite le 18 sept.** (PR #116) — profil `preview` APK + env, `google-services.json` committé (projet `rack-b6a4a`) ; **preuve appareil (push + `rack://`) en attente** [~] |
| P2-025  | Soumission Play Store                         |   2 | **neuf** — fiche, Data safety ; dépend de P2-024 |
| P2-026  | Retrait d'accès (bouton) + filtre deleted_at  |   1 | ✅ **fait le 17 sept.** (PR #109) — revoke_member_subscription (seul chemin), lecture filtre deleted_at |
|         | **Total ②**                                   | **69** | dont 45,5 déjà ticketés ; **10 faits** (P2-018/019/026/017/020) + P2-024 config (preuve appareil en attente) |

### Différé — attend l'entité juridique (35 j·h)

Le paiement in-app suppose Stripe Connect, qui suppose l'entité. Sans elle, le
règlement se fait hors app (lien de la box, `P2-019`) et l'accès s'attribue à la
main (`P2-018`).

| Ticket | Titre | j·h | Pourquoi il attend |
| ------ | ----- | --: | ------------------ |
| P2-001 | Stripe Connect Express + webhooks | 5 | vérification d'identité société |
| P2-005 | Catalogue de formules tarifées    | 3 | pas de vente in-app |
| P2-006 | Abonnements Stripe                 | 7 | `P2-018` en tient la version manuelle |
| P2-007 | Packs de crédits et portefeuille   | 6 | flux d'argent |
| P2-008 | Impayés, relances, suspension     | 5 | flux d'argent |
| P2-015 | E-mails transactionnels            | 4 | les invitations marchent déjà (P1-017) |
| P2-016 | Reporting financier + CA           | 5 | l'app ne voit pas les paiements |

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

## ④ Dette convertie en tickets — 11 j·h ouverts

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
| D-023  | Le consentement pointe vers un texte           | 0,5 | `P1-016`, 9 sept. 2026 — **comptée dans ①**. **✅ code fait le 15 sept. 2026**, le jour où le texte validé a ouvert le ticket : page publique FR+EN, lien mobile, constante `2026-09-15` par migration ajoutée, test qui lie les deux. Geste d'appareil `[ ]`, relecture juriste et `db push` hébergé devant `P1-016` |
| D-024  | Le compte-rendu d'annulation au staff          | 1,5 | `P1-007`, passe partielle du 11 sept. 2026 — **ouvert, hors totaux**. L'enfilage marche (deux `CLASS_CANCELLATION` en file, les non-consentants écartés à l'éligibilité), mais **rien ne le dit au back-office** : la file reste `pending` faute d'émetteur servi en local, et le doute a coûté vingt minutes à qui connaissait le code — Marc aura le même sur une vraie annulation. Les raisons existent déjà (`notification_eligibility` : `NO_PUSH_CONSENT`, `CATEGORY_DISABLED`, `QUIET_HOURS`), il reste à les compter et à les afficher — en remplacement de `planning.cancel_push_only`, qui s'excuse au lieu d'informer. **Déclencheur** : la mise en service (`P1-016`) |
|        | **Ouvert, hors totaux**                        | **8,75** | D-002, D-003, D-007, D-008, D-022, **D-024** — D-004, D-011, D-012, D-013, D-014, D-015, D-016, D-017, D-018, D-019, D-020, D-021 et D-023 sont dans ①, D-010 est clos. **11 sept. 2026** : `D-024` ajoutée (1,5), trouvée à la passe partielle de `P1-007` |

Ces 8,75 j·h ne sont dans **aucun** des deux totaux ci-dessus. C'est délibéré :
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
