# P1-003b — Réserver depuis le mobile (lot 2 de P1-003)

**Phase** P1 · **Estimation** 5,5 j·h · **Dépend de** P1-003 ✅, D-004 ✅, D-009 ✅, P1-002b ✅ · **Spec** §4-P2, RM2.1–2.8

> **5 → 5,5 j·h le 4 septembre 2026**, et le demi-jour est le prix de trois
> choses décidées ici plutôt qu'en route : la réponse à un cours complet, le
> libellé et l'annonce accessibles du bouton, et le câblage d'`expo-crypto`. Les
> trois explosions d'estimation du projet ont toutes commencé par une question
> qu'on s'est posée l'écran ouvert.
>
> **Toutes les dépendances sont closes depuis le 4 septembre 2026** — D-009,
> P1-002b et P1-010, cette dernière repassée sur appareil. Le tableau ci-dessous
> a été relu à cette date : les trois `❌` qui portaient sur elles sont tombés.

## Objectif

Un membre ouvre l'app, voit son prochain cours et **le réserve en deux taps**.
`book_class()` cesse d'être une fonction que personne n'appelle.

## Pourquoi ce ticket maintenant

Le lot 1 a livré la logique la plus dangereuse du produit et l'a prouvée sous
contention réelle. Il l'a livrée **sans appelant**, et l'a écrit : la règle 7
s'est rouverte le jour même où `refresh_class_schedule()` la fermait.

Deux fenêtres sont ouvertes en même temps, et l'une se referme toute seule :

- **la passe sur appareil est faite** (3 septembre 2026, iPhone 12 Pro Max,
  Expo Go, SDK 57 — `docs/passe-mobile-iphone.md`). Cette vérification se
  périme : Expo bouge, l'IP de la machine change, le trousseau se vide.
  Construire dessus pendant qu'elle est fraîche coûte moins cher que la refaire ;
- **la vue des pairs se décide « avec l'écran sous les yeux »**, et l'écran
  n'existe pas. C'est exactement l'argument par lequel D-001 l'avait différée.
  Il vaut encore : elle reste hors de ce lot (voir plus bas).

## Ce que ce ticket suppose et qui doit exister

Vérifié dans le dépôt le 3 septembre 2026, **relu le 4 septembre** après la
fermeture de D-009, P1-002b et P1-010. Pas supposé.

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `book_class(class, membership, idempotency_key)` | `20260903090000_bookings_and_book_class.sql` | ✅ existe, `grant execute` à `authenticated`, **aucun appelant** — c'est l'objet de ce ticket |
| `bookings` et ses policies de lecture | idem — `bookings_own_select`, `bookings_staff_select` | ✅ existent. Aucune policy d'écriture, et c'est voulu : `book_class()` est le seul chemin |
| Les six codes d'erreur, leurs clés i18n, et `errorMessageKeyOf()` | `packages/core/src/errors.ts` | ✅ existent dans les deux langues, avec le test de parité qui relit les migrations |
| `classes` matérialisées et lisibles par un simple membre | P1-002 — policy `classes_select` sur `current_tenant_ids()` | ✅ existe. L'horizon est entretenu par `pg_cron` (`rack-maintain-class-occurrences`, 00 h 05), pas par un passage humain |
| Les fenêtres de réservation côté client | `me()` → `BookingRulesSchema` (P0-005a, éditées en P1-001b) | ✅ existent : l'écran peut dire « ouvre dans 3 jours » sans le deviner |
| Le fuseau de la box appliqué à l'affichage | `_layout.tsx:106` → `I18nProvider timeZone` | ✅ existe (règle 9) |
| L'app mobile ayant tourné sur un appareil réel | `docs/passe-mobile-iphone.md` | ✅ trois passes, les 3 et 4 septembre 2026, la dernière en `lea@example.com` — **et périssable** |
| Kit de composants natifs | `packages/ui/src/native` — 16 composants (`Card`, `ListRow`, `Button`, `Banner`, `Sheet`, `Toast`, `Skeleton`, `EmptyState`…) | ✅ existe. Rien à construire avant de composer les écrans — c'est exactement ce qui avait coûté 7,5 j·h à P1-001 |
| **L'écran Planning mobile** (le jour, les filtres, le cache) | **P1-002b** ✅ | ✅ **existe et est clos** — planning du jour, filtres type **et coach**, cache hors ligne daté, hors ligne repassé sur appareil le 4 septembre 2026. Ce qui reste du ticket est parti en `D-011` (relecture du cache) et ne bloque rien ici |
| **La langue de l'app sur un iPhone français** | **D-004** | ✅ **réparée et vérifiée sur appareil le 4 septembre 2026.** L'app s'ouvre en français. La section « Ce lot attend D-004 » ci-dessous devient l'historique d'une décision tenue, pas une attente |
| **Une pile de navigation dont les retours ne mènent nulle part d'interdit** | **D-009** ✅ | ✅ **faite.** La convention du premier écran à retour légitime — le détail d'un cours — est écrite dans `.claude/rules/ui.md`, section « La convention de navigation mobile », et le balayage de retour a été exercé sur iPhone le 4 septembre. Reste le bouton retour Android, sans appareil pour l'exercer |
| **Des situations de refus dans le seed** | `supabase/seed.sql` | ⚠️ **une seule manquait vraiment.** `bookings` était vide et aucune occurrence pleine ; mais seules les fenêtres et le plafond se déduisent des réglages par défaut, donc s'atteignent sans fixture. Le cours complet est ajouté par ce ticket, comme P1-002b avait dû ajouter les séries |
| **Une réponse produit à `CLASS_FULL`** | la liste d'attente, **P1-006**, après ce lot | ❌ **absente, et rien ne la remplace** — voir « Un cours complet » ci-dessous. Décidée dans ce ticket plutôt que découverte à l'écran |
| **Une annonce vocale de la confirmation sur iOS** | `Toast` (`packages/ui/src/native/toast.tsx:30`) | ⚠️ **à moitié** : `accessibilityLiveRegion` est **Android uniquement**. Sur l'appareil de nos passes, rien n'est annoncé — voir « Le bouton dit ce qu'il réserve » |
| **Un identifiant unique généré sur l'appareil** | `uuidV7()`, `packages/core/src/crypto.ts` | ✅ **existe depuis le 4 septembre 2026**, avec sa source d'aléa à installer au démarrage. `crypto` est **absent** sous Hermes (pas incomplet) : ESLint l'interdit hors de cette façade, et elle lève plutôt que de se rabattre sur `Math.random()`. **Reste à faire ici** : ajouter `expo-crypto`, la justifier au commit, et appeler `installRandomBytesSource()` dans `_layout.tsx` |
| Un harnais de test mobile | Maestro, annoncé par `CLAUDE.md` | ❌ **rien** — et `apps/mobile` n'a même pas de script `test`. Les critères de parcours se vérifient **à la main**, et ce ticket le dit plutôt que de faire semblant. Un ticket « harnais mobile » reste à écrire ; il n'est pas bloquant ici, il est seulement absent |
| Places restantes en temps réel | P1-005 | ❌ hors périmètre : mise à jour optimiste seulement |
| Annulation | P1-004 | ❌ à créer par P1-004. **Conséquence à dire à la box pilote** : après ce ticket, un membre qui a réservé ne peut pas se désinscrire |
| Liste d'attente | P1-006 | ❌ à créer par P1-006. « Cours complet » est une fin de parcours, pas une porte |
| Droits de réservation réels (abonnement, crédits) | P2-006, P2-007 | ❌ volontairement absents. `member_has_booking_right()` rend `true` pour tout membre actif : « la box accorde à la main » |
| Feuille d'inscrits (la vue des pairs) | — | ❌ hors périmètre → **P1-003c**, écrit depuis, et qui attend cet écran pour se lancer. La règle d'exposition qu'il applique est déjà posée (P1-010, `.claude/rules/privacy.md`) |
| Le nom du coach sur le détail d'un cours | **P1-010** ✅ | ✅ `tenant_coaches` existe, et `coachDisplayName()` compose « Sarah D. » |

## Toute la chaîne mobile tient-elle dans Expo Go ?

**Oui. Vérifié le 3 septembre 2026, pas supposé.** C'est la question qui décide
si la passe du 3 septembre reste valide ou si tout le jalon pilote change de
forme, et elle ne s'était jamais posée par écrit.

**Pourquoi elle est décisive.** Expo Go n'exécute que les modules natifs
compilés dans l'app du store. Un seul module absent, et il faut un
*development build* → donc EAS → donc **un compte développeur Apple payant et
une inscription de plusieurs jours**. L'inscription Apple quitterait alors le
« chemin critique hors code » — où elle bloque la publication, dans plusieurs
mois — pour devenir bloquante **maintenant**, sur les trois tickets suivants.

Les trois dépendances natives que la chaîne D-004 → P1-002b → P1-003b ajoute :

| Module | Ticket qui l'ajoute | Version épinglée par `expo/bundledNativeModules.json` | Dans Expo Go, SDK 57 |
| ------ | ------------------- | ---------------------------------------------------- | -------------------- |
| `expo-crypto` | **celui-ci** | `~57.0.2` | ✅ « Included in Expo Go » — `docs.expo.dev/versions/latest/sdk/crypto/` |
| `expo-localization` | D-004 | `~57.0.1` | ✅ idem — `…/sdk/localization/` |
| `@react-native-async-storage/async-storage` | P1-002b | `2.2.0` | ✅ idem — `…/sdk/async-storage/`, bibliothèque tierce mais embarquée dans Expo Go |

**Conséquences, dans l'ordre où elles comptent :**

1. **aucun development build, aucun EAS, aucun compte Apple payant** pour cette
   chaîne. L'inscription Apple reste où elle est — bloquante pour P2-003 et la
   publication, pas pour le pilote ;
2. **la passe du 3 septembre reste valide** : les trois tickets tournent dans le
   même Expo Go que celui qui a servi à la faire ;
3. installer avec **`npx expo install <module>`** et non `pnpm add` : c'est ce
   qui pose la version qu'Expo Go embarque. Une version plus récente installée à
   la main donnerait un module JavaScript qui ne correspond plus au binaire
   natif — un décalage qui ne se voit qu'à l'exécution, sur l'appareil.

### Ce qu'`expo-crypto` fait ici, et ce qu'on n'appelle pas

**`expo-crypto` ne sert qu'à une chose : fournir `getRandomBytes()` à
`installRandomBytesSource()`, une fois, au démarrage.** La clé d'idempotence
vient ensuite de `uuidV7()` (`packages/core/src/crypto.ts`), comme tout
identifiant du produit. **`Crypto.randomUUID()` n'est appelée nulle part**, et
ce paragraphe existe pour que personne ne la rappelle par mégarde.

Il datait d'avant la façade, il justifiait `Crypto.randomUUID()` comme clé
opaque, et **il était dangereux** : `Crypto.randomUUID()` est un appel de
**module**, pas un accès au global `crypto`. L'interdit ESLint vise `crypto.` et
`globalThis.crypto` — il ne l'aurait pas vue passer. On pouvait donc
court-circuiter la façade *en croyant suivre le ticket*, sans qu'aucun filet ne
bronche : le chemin gardé, et son jumeau qui ne l'est pas.

Le trou est fermé des deux côtés : ici par la décision, et dans
`eslint.config.mjs` par un interdit d'**import** de `expo-crypto` hors du seul
fichier qui installe la source. Deux sondes le vérifient.

**L'argument v4 / règle 12 garde sa valeur, et on ne s'en sert pas.** Il disait
ceci : `Crypto.randomUUID()` rend un **UUID v4**, mais une clé d'idempotence
n'est pas un identifiant de ligne — `bookings.id` reste `uuid_generate_v7()`,
posé par la base — c'est une chaîne opaque stockée en `text`, dont les seules
propriétés utiles sont d'être unique et imprévisible ; la règle 12 n'était donc
pas en cause. Tout cela reste vrai. Simplement, un v7 coche les mêmes cases
**et** les identifiants du produit ont une seule provenance au lieu de deux.
C'est le genre de choix qu'on ne regrette que dans un sens.

## Ce que ce lot rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `bookClass()` — la RPC, la clé d'idempotence, la traduction du code d'erreur | l'écran Détail du cours, l'accueil | celui-ci |
| Écran Détail du cours | le membre, depuis le planning et depuis l'accueil | celui-ci |
| Écran Mes réservations | le membre | celui-ci, puis P1-004 (s'y désinscrire) et P1-008 (y pointer) |
| La carte « prochain cours » de l'accueil | le membre | celui-ci |
| Le premier écran qui afficherait une feuille d'inscrits | la vue des pairs | **P1-003c — à écrire après** |

**Rien n'est livré ici sans appelant.** C'est la première fois depuis P0-004, et
pour une raison simple : ce ticket *est* l'appelant.

## Ce lot attend D-004, et c'est un choix

`docs/backlog/D-004-langue-mobile.md`, élargi par la passe du 3 septembre :
l'app s'ouvre **en anglais** sur un iPhone réglé en français, parce que sous
Hermes `Intl` ne rend pas la langue de l'appareil et que `FALLBACK_LOCALE` vaut
`'en'` pour un produit vendu à des boxes françaises.

**Ce lot l'attend.** Le raisonnement, pour qu'il ne se re-litige pas :

- les critères de ce ticket sont des critères de **parcours**, vérifiés à la
  main sur un appareil faute de harnais mobile. « Réserver en deux taps », « le
  bouton dit pourquoi il est désactivé », « le refus est compréhensible » se
  jugent sur des mots. Les juger en anglais, sur des écrans pensés en français,
  c'est valider la mauvaise chose, puis refaire la passe ;
- ce lot ajoute une quarantaine de chaînes. Les écrire sous un repli anglais,
  c'est soigner la version qu'on ne montrera jamais à la box pilote ;
- le backlog dit qu'une dette « se paie quand un ticket la rend bloquante ».
  C'est ce ticket. La reporter ne la rend pas moins chère : seulement invisible
  une session de plus.

**Ce que ça coûte, dit franchement** : les 2 j·h de D-004 quittent la dette hors
totaux et entrent dans le chemin critique du jalon pilote. Le total ① passe de
83,75 à 86,75 j·h.

**Ce que ça n'est pas** : une dépendance technique. Aucune ligne de ce lot
n'appelle du code de D-004. Si la décision est prise de passer outre, ce lot se
code quand même — mais sa passe manuelle sera alors à refaire après D-004, et
c'est à savoir avant, pas après.

## L'ordre change : P1-002b passe avant

Le lot 2 était décrit comme « Home, **Schedule**, Class Detail, Booking
Confirmation, My Bookings ». Or l'écran Schedule est le livrable de **P1-002b**
(planning mobile et cache hors ligne, 3,5 j·h), écrit et chiffré séparément.

Deux options, une seule tenable : réécrire un planning ici serait élargir le
périmètre d'un ticket sur le dos d'un autre, et livrer deux listes de cours
concurrentes dans la même app. Donc **P1-002b d'abord**, et ce ticket construit
dessus : un cours du planning ouvre son détail, et le détail réserve.

Nouvel ordre de la chaîne mobile : **D-009 → P1-002b → P1-003b**, D-004 étant
livrée depuis le 3 septembre et vérifiée sur appareil le 4.

## La vue des pairs reste hors périmètre

D-001 puis P1-003 ont légué trois décisions — la portée de la liste, la case de
consentement qui gouverne l'avatar, et le choix opt-in / opt-out — à trancher
« avec l'écran sous les yeux ». Ce ticket **construit** cet écran ; il ne tranche
pas dans le même mouvement :

- la décision ajoute une finalité de consentement, et **une valeur d'enum ne se
  retire pas**. La prendre au milieu de cinq écrans, c'est la prendre vite ;
- rien du parcours de réservation n'en dépend. Le détail d'un cours affiche des
  places restantes, pas des noms.

Elle part donc dans **P1-003c**, à écrire une fois cet écran visible — c'est
alors, et seulement alors, que la condition posée par D-001 sera remplie. Les
trois décisions et l'argument qui les tranche restent en fin de
`P1-003-reservation.md` ; ils ne sont pas perdus.

## Un cours complet : ce que voit un membre entre ce lot et P1-006

`book_class()` lève `CLASS_FULL`, et la réponse produit à `CLASS_FULL` est la
liste d'attente — **P1-006**, six jours-homme plus loin dans la file. La question
« que voit un membre qui touche Réserver sur un cours complet, en attendant ? »
n'a pas de réponse par défaut acceptable : le §12.3 interdit d'afficher un code
brut, et « Ce cours est complet. » — le texte actuel d'`errors.class_full` — est
une impasse, pas une réponse.

**Trois choses vérifiées dans le dépôt avant de trancher**, parce que les trois
suites qu'on écrirait spontanément sont fausses :

1. **« Demande à ta box de t'ajouter » est faux.** `book_class()` ne réserve que
   pour soi — le contrôle est explicite (`…_bookings_and_book_class.sql:159` :
   « on ne réserve que pour soi »), et `bookings` n'a **aucune policy
   d'écriture** : il n'existe aucun chemin, ni écran ni SQL applicatif, par
   lequel un coach place un membre ;
2. **« Repasse plus tard, une place va peut-être se libérer » est faux dans la
   première fenêtre.** Une place ne se libère que par une annulation, et
   l'annulation est **P1-004**, *après* ce lot. Entre P1-003b et P1-004, un
   cours complet est **définitivement** clos. La phrase ne redevient vraie qu'à
   P1-004, et visible qu'à P1-005 ;
3. **« Ta box peut ouvrir une place » est vrai en base et faux à l'écran.** La
   policy `classes_update` autorise un admin à relever `classes.capacity`, mais
   aucun écran du back-office ne le fait **pour une occurrence** :
   `series-form.tsx` édite la **série**. Personne ne portera ce besoin tant que
   P1-006 n'existe pas, et ce ticket ne s'appuie donc pas dessus.

**La décision : une impasse se répare par une porte de sortie, pas par une
promesse.** Le bouton passe à l'état « Complet » — désactivé, comme les quatre
autres refus, et son libellé dit pourquoi — et l'écran offre **l'action qui
reste vraie** : revenir au planning voir les autres créneaux du jour. C'est le
seul geste que le produit sait honorer aujourd'hui, et il ne coûte rien : le
planning existe.

Deux chaînes, dans les deux langues :

| Clé | fr | en |
| --- | --- | --- |
| `booking.full_title` | « Ce cours est complet » | « This class is full » |
| `booking.full_hint` | « Il n'y a pas encore de liste d'attente. Regarde les autres créneaux du jour. » | « There's no waitlist yet. Take a look at the other slots today. » |

`errors.class_full` **reste** et ne change pas : il sert le cas de course — la
place est partie entre l'affichage et le tap. Le `Toast` le dit, puis le bouton
bascule sur l'état ci-dessus. Les deux chemins finissent au même endroit, ce qui
est la moitié du travail : un refus au tap et un cours déjà complet à
l'affichage ne doivent pas raconter deux histoires différentes.

**Ce que la box pilote doit savoir, et qui s'ajoute à la liste de P1-004** :
avant P1-004 et P1-006, un cours plein est un cours fermé. Si elle veut ouvrir
une place, elle n'a aujourd'hui aucun écran pour le faire sur une occasion
précise. Aucun ticket ne porte ce manque — il est ici pour cesser d'être
invisible, pas pour être absorbé en route.

## Le bouton dit ce qu'il réserve, et la confirmation s'annonce

`.claude/rules/ui.md` l'avait prévu par écrit avant que l'écran existe : « un
bouton "Réserver" qui ne dit pas ce qu'il réserve » y est nommé comme l'un des
deux pièges prévisibles. Un écran qui porte un bouton par cours en porte autant
que de cours, **tous identiques à l'oreille**.

- **Le libellé accessible nomme le cours et son heure locale de box** —
  « Réserver CrossFit à 18:30 », pas « Réserver ». Le texte visible reste court ;
  c'est `accessibilityLabel` qui porte la phrase entière ;
- **la confirmation est annoncée, pas seulement affichée** (§12.4). Et c'est ici
  qu'un piège attend : `Toast` porte `accessibilityRole="alert"` **et**
  `accessibilityLiveRegion="polite"` — or `accessibilityLiveRegion` **n'existe
  que sous Android** dans React Native. Sur iPhone, l'appareil de toutes nos
  passes, le `Toast` s'affiche **sans être annoncé**. La confirmation d'une
  réservation est exactement le changement d'état qu'un lecteur d'écran doit
  entendre sans avoir à chercher.

  C'est la règle des sœurs, côté interface : un chemin gardé (Android), son
  jumeau oublié (iOS). L'annonce passe donc par
  `AccessibilityInfo.announceForAccessibility()` en plus du `Toast`, et ce
  ticket la met **dans le kit** (`packages/ui/src/native/toast.tsx`) plutôt que
  dans l'écran : le défaut vaut pour tous les `Toast` du produit, pas seulement
  pour celui-ci.

## Périmètre

- **`bookClass()`** dans `packages/core/src/supabase/bookings.ts` : appel RPC,
  **clé d'idempotence générée une fois par tentative** et réutilisée telle quelle
  à chaque rejeu, traduction du code d'erreur en clé i18n. Testable sans écran,
  donc testé avant l'écran.
- **La source d'aléa du mobile** : dépendance `expo-crypto`, justifiée au commit,
  et `installRandomBytesSource()` appelée dans `_layout.tsx` **au démarrage**.
  La clé vient de `uuidV7()` (`@rack/core`) : sous Hermes, sans cet appel, le
  premier tap lève — ce qui est le comportement voulu, et pas une clé fabriquée
  avec `Math.random()`.
- **Détail du cours** : type, coach, salle, créneau **en heure locale de la
  box**, places restantes, et un bouton unique dont l'état désactivé **dit
  pourquoi** — fenêtre pas encore ouverte, fenêtre close, cours complet, déjà
  réservé, plafond de réservations atteint. Le libellé accessible du bouton
  **nomme le cours et son heure** (voir la section dédiée).
- **Un cours complet a une sortie** : l'état « Complet », les deux chaînes
  `booking.full_title` / `booking.full_hint`, et le retour au planning. C'est la
  décision de la section « Un cours complet », prise avant le code.
- **L'annonce de la confirmation sur iOS** : `AccessibilityInfo.announceForAccessibility()`
  ajoutée au `Toast` du kit — `accessibilityLiveRegion` est Android seul, et
  l'écart vaut pour tous les `Toast`, pas seulement celui-ci.
- **Confirmation** : un état de l'écran de détail, pas un écran de plus. Le
  critère est « deux taps », et un écran intercalaire en coûte un.
- **Mes réservations** : les cours à venir, à l'heure locale de la box.
- **Accueil** : la carte du prochain cours réservable, d'où partent les deux taps.
- **Mise à jour optimiste** de la place et du compteur, avec **retour en arrière
  visible** si le serveur refuse (`Toast`).
- **Une seule situation de refus dans le seed**, et non trois comme annoncé :
  une occurrence complète (capacité 1, déjà réservée). Les défauts de
  `tenant_settings` rendent les autres gratuites — fenêtre close en ouvrant un
  cours déjà commencé (`close_minutes_before = 15`), fenêtre pas encore ouverte
  huit jours plus loin (`open_days_before = 7`), plafond en réservant trois cours
  (`max_upcoming_bookings = 3`). Vérifié avant d'écrire la fixture, pas supposé.
- **La durée de l'appel écrite en console, en développement seulement** — c'est
  ce qui rend le p95 mesurable au lieu d'être une impression. Compris aussi.
- Toute chaîne visible en `fr.json` et `en.json` (règle 8 des règles non
  négociables), tout message d'erreur issu d'un **code**, jamais d'un texte SQL.

## Hors périmètre

- **L'écran Planning** → P1-002b, qui passe avant.
- **La feuille d'inscrits** → P1-003c, à écrire après.
- **L'annulation** → P1-004. Un membre ne peut pas se désinscrire après ce lot.
- **Les places en temps réel** → P1-005. Ici, l'optimisme et un rechargement.
- **La liste d'attente** → P1-006.
- **« Choisir une formule »** : le message existe, l'écran d'achat est P2-005.
- **Un harnais de test mobile** : absent du dépôt, non créé ici. Les critères de
  parcours se vérifient à la main, et la liste ci-dessous le dit pour chacun.

## Préparer la passe sur appareil — elle doit tenir d'une traite

**Quatorze critères manuels, dont deux au lecteur d'écran et un p95 sur vingt
appels, sans harnais Maestro.** C'est la plus grosse passe du projet, et une
passe qu'on improvise est une passe qu'on écourte : on saute le geste pénible,
qui est presque toujours celui qui trouve quelque chose. L'ordre ci-dessous
existe pour qu'aucun geste ne demande de revenir en arrière.

**La préparation se périme** — l'IP de la machine change, le trousseau se vide,
Expo bouge. Elle n'est pas recopiée ici : `docs/passe-mobile-iphone.md`, §1 à 3,
et l'étape 3 (Safari sur `http://<IP>:55321/rest/v1/`) décide de tout le reste.
Compter dix minutes avant de toucher au téléphone.

### Avant de démarrer Expo

1. `pnpm db:reset` — seed neuf. Les situations de refus (cours complet, fenêtre
   close, plafond) en viennent, et l'invitation à usage unique est remise à
   `PENDING` ;
2. `.env.local` relu : l'IP est-elle encore la bonne ?
3. `pnpm exec expo start --clear` — le cache de Metro survit aux changements de
   dépendance et rend des erreurs qui ne correspondent plus au code.

### L'ordre des gestes, en une traite

| # | Geste | Ce qu'on regarde |
|---|---|---|
| 1 | Ouvrir l'app, aller au planning, ouvrir un cours | Le détail : type, coach, salle, heure **locale de la box** |
| 2 | Réserver depuis l'accueil, en comptant les taps | **Deux**, pas trois |
| 3 | Rouvrir le même cours, taper deux fois vite | **Une seule** réservation |
| 4 | Mode avion pendant l'appel, rétablir, réessayer | **Une seule** réservation — la clé n'a pas changé |
| 5 | Le cours complet du seed | « Complet », la phrase, et le retour au planning à un tap |
| 6 | Un cours **déjà commencé** aujourd'hui, ou la veille | « Réservations closes », avec les 15 minutes des réglages de la box |
| 7 | Avancer de **huit jours** dans le planning | « Pas encore ouvert », avec les 7 jours des réglages |
| 7 bis | Réserver un **troisième** cours à venir | Le plafond, et une phrase qui dit qu'il se libère après le prochain cours |
| 8 | Un jour **déjà visité**, puis mode avion, puis retour sur ce jour | Le bandeau hors ligne, les cours, **et aucune action de réservation** |
| 9 | VoiceOver : parcourir trois cours d'affilée | Trois annonces **différentes**, chacune nommant son cours et son heure |
| 10 | VoiceOver : réserver | La confirmation **s'annonce** sans qu'on aille la chercher |
| 11 | « Mes réservations », puis tuer l'app et rouvrir | La réservation est toujours là |
| 12 | Les vingt appels du p95 | Voir ci-dessous |

Les gestes 9 et 10 viennent **après** les refus et non avant : VoiceOver ralentit
tout, et l'activer tôt fait écourter le reste.

**Ce que le harnais web a déjà montré, le 5 septembre 2026**, et qui allège la
passe sans la remplacer : les deux taps depuis l'accueil, les quatre états de
refus avec les nombres venus des réglages, le libellé accessible du bouton
(« Réserver Open gym à 10:00 »), le retour annoncé « CF Rueil, back », et
« Mes réservations ». Ce qu'il **ne peut pas** montrer et qui reste entier :
tout ce qui touche l'appareil — VoiceOver, le mode avion, la survie à la
fermeture de l'app, le fuseau du téléphone, et les vingt mesures du p95, qui n'ont
de sens que sur un vrai réseau.

### Ce qu'on note au passage, parce que ça ne se retrouve pas après

- **Les vingt mesures du p95.** `bookClass()` entoure son appel de
  `performance.now()` et écrit la durée en console **en développement
  seulement** ; les vingt valeurs se lisent dans le terminal Metro et se copient
  dans le rapport de session. Sans cette ligne, « mesuré sur vingt appels »
  redevient une impression ;
- **la première ligne de tout écran rouge**, et les dernières lignes de Metro.
  Rien d'autre — surtout pas une capture où figure une clé ;
- **ce qui a été pénible**, même sans être faux. C'est la matière de `D-010` :
  le déclencheur de Maestro en local est « la passe manuelle dépasse dix
  minutes », et personne ne s'en souviendra si ce n'est pas noté le jour même ;
- **`git status -s` après avoir arrêté Expo.** `expo start` réécrit
  `apps/mobile/tsconfig.json` et `app.json` — ces modifications ne font pas
  partie de la passe.

### Ce que la passe ne prouvera pas, et qu'il faut dire

Le bouton retour **Android** (dernier critère ouvert de D-009) : aucun appareil
Android au projet. Il reste ouvert, et il vaut mieux qu'il le reste visiblement.

## Critères d'acceptation

Automatisables :

- [x] **Avant le code** : test Vitest de `bookClass()` — une clé rejouée rend la
      même réservation ; chacun des six codes rend sa clé i18n ; une erreur
      inconnue rend `errors.unknown` plutôt que le texte de la base.
      **30 tests**, et le premier a payé tout de suite : « close pile au seuil »
      était faux, le SQL compare avec `<`, donc à exactement quinze minutes la
      base **accepte encore**
- [x] **Les cinq refus se vérifient sans écran** — critère ajouté en cours de
      route, parce qu'il change ce que la passe manuelle doit prouver.
      `bookingAffordance()` est une fonction pure, testée aux bornes à la
      seconde près ; l'ordre de ses cas est celui du SQL, ligne pour ligne
- [x] `pnpm i18n:check` reste vert : aucune chaîne des nouveaux écrans en dur —
      423 clés, FR et EN alignées, aucune orpheline
- [x] Aucune couleur en dur dans les écrans ajoutés (règle 7 des règles non
      négociables)
- [x] `pnpm test:db` vert **avec la fixture de seed** : 363 tests

À la main, sur un **appareil réel** — Expo web n'en coche aucun :

- [x] Depuis l'accueil, réserver le prochain cours en **deux taps**
- [x] Deux taps rapides sur le bouton → **une seule** réservation
- [x] Mode avion pendant l'appel, réseau rétabli, nouvel essai → **une seule**
      réservation (la clé n'a pas changé)
- [x] Cours complet → l'état « Complet », **et une sortie** : la phrase dit qu'il
      n'y a pas encore de liste d'attente, et le retour au planning est à un tap.
      Aucune impasse, aucune promesse que le produit ne tient pas (§12.3)
- [x] Le cas de course dit la même chose : cours affiché libre, complet au tap →
      `Toast` `errors.class_full`, puis le bouton bascule sur ce même état
- [~] Membre sans droits → « Choisir une formule », jamais une erreur brute.
      **Inatteignable par l'interface, et ce n'est pas un manque** :
      `member_has_booking_right()` rend vrai pour une appartenance `ACTIVE`
      (`…_bookings_and_book_class.sql:116`) et `current_tenant_ids()` — base de
      toutes les policies — exige `ACTIVE` aussi
      (`…_identity_and_tenancy.sql:121`). Un membre suspendu **ne voit aucun
      cours**, donc n'atteint jamais l'écran d'où l'on réserve. Le code est
      traité à l'arrivée (une suspension peut tomber entre l'affichage et le
      tap) et couvert par un test Vitest ; il ne se coche pas sur appareil.
      **Ce critère redeviendra exerçable à P2-006**, quand le droit cessera
      d'être « l'appartenance est active »
- [x] Fenêtre close → la raison, exprimée en heure locale de la box
- [x] Un refus fait **revenir** la place affichée à sa valeur réelle, visiblement
- [x] **Sur une journée venue du cache, aucune action de réservation n'est
      proposée.** Critère hérité de P1-002b, qui l'annonçait porté ici alors
      qu'il n'y était pas. Le type l'impose déjà à moitié : un `LoadedSchedule`
      d'origine `'cache'` ne fait jamais autorité sur une place
      (`apps/mobile/lib/schedule-cache.ts:41`). L'écran doit finir le travail —
      pas de bouton grisé qui laisse croire qu'un tap suffirait.

      **Le geste, et c'est le même qu'à la passe du 4 septembre 2026** : ouvrir
      un jour **déjà visité**, passer en mode avion, revenir sur ce jour. Le
      bandeau « Hors ligne. Planning enregistré… » s'affiche, les cours aussi,
      et aucun d'eux n'offre de réserver. Dix secondes, pas un raisonnement —
      c'est la différence entre un critère qu'on vérifie et un critère qu'on
      croit
- [x] La réservation apparaît dans « Mes réservations » et survit à la fermeture
      complète de l'app
- [x] Un iPhone réglé en français fait tout le parcours **en français** — D-004
      est livrée, ce critère vérifie que les **nouvelles** chaînes le sont aussi
- [x] **VoiceOver, sur l'appareil** : chaque bouton de réservation s'annonce par
      le cours qu'il réserve et son heure — trois cours d'affilée donnent trois
      annonces différentes, pas trois fois « Réserver »
- [x] **VoiceOver annonce la confirmation sans qu'on aille la chercher.** C'est
      le critère qui prouve que `announceForAccessibility()` a bien été ajoutée :
      `accessibilityLiveRegion` seul le laisserait vert sous Android et muet sur
      l'iPhone qui sert à toutes nos passes
- [~] p95 de l'appel `book_class` **< 800 ms**, mesuré sur appareil sur au moins
      20 appels, la valeur notée dans le rapport de session. C'est la moitié de
      T1 que le harnais de concurrence ne prouve pas : il n'y a pas d'appel HTTP
      dans un `docker exec`.

      **Non mesuré à la passe du 5 septembre 2026, et délibérément pas forcé.**
      Deux obstacles se cumulent, et le second est le vrai :

      1. **vingt réservations réussies sont impossibles aujourd'hui.**
         `max_upcoming_bookings` vaut 3 et l'annulation est P1-004 : il faudrait
         trafiquer les réglages de la box pour y arriver, donc mesurer autre
         chose que le produit ;
      2. **vingt appels en Wi-Fi local contre une base qui tourne sur la même
         machine donnent un plancher, pas un p95.** La mesure prouverait que
         l'instrumentation fonctionne — ce qu'on sait, la durée s'écrit déjà
         dans le terminal Metro — et **rien du T1 de la spec §16.4**, qui parle
         d'un réseau réel et d'une base distante.

      Un chiffre obtenu ainsi serait pire qu'aucun chiffre : il aurait l'air
      d'une preuve. Ce qui le rendra exerçable, dans l'ordre où ça arrivera :
      **P1-004** (annuler libère le plafond, donc vingt appels deviennent
      possibles) puis **un environnement distant**, sans lequel la mesure ne
      dira jamais rien de la production. À reprendre là, pas ici.

## La passe du 5 septembre 2026 — la première sans défaut

iPhone, Expo Go, seed neuf. **Gestes 1 à 11 conformes, VoiceOver compris.** Les
trois annonces sont distinctes et nomment chacune leur cours et son heure ; la
confirmation s'annonce sans qu'on aille la chercher — donc
`announceForAccessibility()` fait son travail là où `accessibilityLiveRegion`
seul aurait laissé un vert trompeur. Les quatre refus disent leur raison avec les
nombres des réglages. Hors ligne, aucune action de réservation n'est proposée.

**Aucun défaut trouvé. C'est la première fois du projet**, après la langue
(D-004), le parcours d'invitation, `Intl.PluralRules` et le sélecteur de box.
Ça mérite d'être écrit plutôt que passé sous silence, et ça mérite surtout de ne
pas être mal lu : **ce n'est pas la passe qui est devenue inutile, c'est le
travail en amont qui a payé.** Ce lot a livré ses cinq refus sous forme de
fonction pure testée aux bornes, son libellé accessible vérifié dans l'arbre du
harnais, et son écart iOS corrigé dans le kit avant d'être vu sur un téléphone.
La passe a confirmé ; elle n'a pas eu à trouver. Les quatre défauts des passes
précédentes venaient tous de choses qu'aucun filet ne regardait.

Deux critères restent ouverts, chacun pour une raison qui n'est pas « on a
oublié » : le p95 (voir ci-dessus) et le schéma `rack://`, qui **ne se vérifie
pas dans Expo Go** — celui-ci passe par `exp://`, et un schéma personnalisé
n'existe que dans un *development build*. Le reliquat est chez `D-013` et part
avec le premier build dédié, donc avec le compte développeur Apple.

## Notes

**La clé d'idempotence se génère au tap, pas à l'appel.** Générée dans la
fonction d'envoi, elle changerait à chaque nouvel essai et la protection
n'existerait pas — c'est précisément le cas du réseau lent que vise la règle 4.
Elle vit donc dans l'état de l'écran, du premier tap jusqu'à la réponse. Une app
tuée entre-temps perd sa clé : acceptable, la réservation n'a pas eu lieu du
point de vue de la personne, et un nouveau tap en génère une neuve.

**`book_class()` rend un `uuid`, ou lève.** PostgREST expose le code applicatif
dans `details`, et `errorMessageKeyOf()` sait déjà le lire : c'est le chemin
qu'empruntent les six codes du lot 1, et il est testé.

**Ce que la passe sur appareil a coûté la dernière fois, et qui recommencera** :
`apps/mobile/.env.local` à recréer avec l'**IP de la machine** (pas
`127.0.0.1`), `expo start --clear`, et `git status` après coup — Expo réécrit
`tsconfig.json`. Tout est dans `docs/passe-mobile-iphone.md` ; ne pas le
redécouvrir.
