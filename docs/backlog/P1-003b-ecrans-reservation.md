# P1-003b — Réserver depuis le mobile (lot 2 de P1-003)

**Phase** P1 · **Estimation** 5 j·h · **Dépend de** P1-003 ✅, **D-004**, **P1-002b** · **Spec** §4-P2, RM2.1–2.8

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

Vérifié dans le dépôt le 3 septembre 2026, pas supposé.

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `book_class(class, membership, idempotency_key)` | `20260903090000_bookings_and_book_class.sql` | ✅ existe, `grant execute` à `authenticated`, **aucun appelant** — c'est l'objet de ce ticket |
| `bookings` et ses policies de lecture | idem — `bookings_own_select`, `bookings_staff_select` | ✅ existent. Aucune policy d'écriture, et c'est voulu : `book_class()` est le seul chemin |
| Les six codes d'erreur, leurs clés i18n, et `errorMessageKeyOf()` | `packages/core/src/errors.ts` | ✅ existent dans les deux langues, avec le test de parité qui relit les migrations |
| `classes` matérialisées et lisibles par un simple membre | P1-002 — policy `classes_select` sur `current_tenant_ids()` | ✅ existe. L'horizon est entretenu par `pg_cron` (`rig-maintain-class-occurrences`, 00 h 05), pas par un passage humain |
| Les fenêtres de réservation côté client | `me()` → `BookingRulesSchema` (P0-005a, éditées en P1-001b) | ✅ existent : l'écran peut dire « ouvre dans 3 jours » sans le deviner |
| Le fuseau de la box appliqué à l'affichage | `_layout.tsx:106` → `I18nProvider timeZone` | ✅ existe (règle 9) |
| L'app mobile ayant tourné sur un appareil réel | `docs/passe-mobile-iphone.md` | ✅ faite le 3 septembre 2026 — **et périssable** |
| Kit de composants natifs | `packages/ui/src/native` — 16 composants (`Card`, `ListRow`, `Button`, `Banner`, `Sheet`, `Toast`, `Skeleton`, `EmptyState`…) | ✅ existe. Rien à construire avant de composer les écrans — c'est exactement ce qui avait coûté 7,5 j·h à P1-001 |
| **L'écran Planning mobile** (le jour, les filtres, le cache) | **P1-002b** | ❌ **n'existe pas.** `apps/mobile/app` porte cinq écrans : `welcome`, `auth`, `consents`, `profile-setup`, `(app)/index`. Le planning est le livrable de P1-002b, qui doit passer **avant** — voir « L'ordre change » |
| **La langue de l'app sur un iPhone français** | **D-004** | ❌ **cassée.** L'app s'ouvre en anglais sur un téléphone réglé en français. Ce ticket l'attend — voir « Ce lot attend D-004 » |
| **Un identifiant unique généré sur l'appareil** | — | ❌ **rien.** Aucun code du dépôt ne génère d'UUID côté client, et `crypto.randomUUID()` n'existe pas sous Hermes. Dépendance `expo-crypto` (incluse dans Expo Go) à ajouter et à justifier au commit. **Sans elle, la règle 4 de `CLAUDE.md` n'a aucune implémentation côté appelant** |
| Un harnais de test mobile | Maestro, annoncé par `CLAUDE.md` | ❌ **rien** — et `apps/mobile` n'a même pas de script `test`. Les critères de parcours se vérifient **à la main**, et ce ticket le dit plutôt que de faire semblant. Un ticket « harnais mobile » reste à écrire ; il n'est pas bloquant ici, il est seulement absent |
| Places restantes en temps réel | P1-005 | ❌ hors périmètre : mise à jour optimiste seulement |
| Annulation | P1-004 | ❌ à créer par P1-004. **Conséquence à dire à la box pilote** : après ce ticket, un membre qui a réservé ne peut pas se désinscrire |
| Liste d'attente | P1-006 | ❌ à créer par P1-006. « Cours complet » est une fin de parcours, pas une porte |
| Droits de réservation réels (abonnement, crédits) | P2-006, P2-007 | ❌ volontairement absents. `member_has_booking_right()` rend `true` pour tout membre actif : « la box accorde à la main » |
| Feuille d'inscrits (la vue des pairs) | — | ❌ hors périmètre → **P1-003c**, à écrire quand l'écran existera |

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

Nouvel ordre de la chaîne mobile : **D-004 → P1-002b → P1-003b**.

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

## Périmètre

- **`bookClass()`** dans `packages/core/src/supabase/bookings.ts` : appel RPC,
  **clé d'idempotence générée une fois par tentative** et réutilisée telle quelle
  à chaque rejeu, traduction du code d'erreur en clé i18n. Testable sans écran,
  donc testé avant l'écran.
- **Détail du cours** : type, coach, salle, créneau **en heure locale de la
  box**, places restantes, et un bouton unique dont l'état désactivé **dit
  pourquoi** — fenêtre pas encore ouverte, fenêtre close, cours complet, déjà
  réservé, plafond de réservations atteint.
- **Confirmation** : un état de l'écran de détail, pas un écran de plus. Le
  critère est « deux taps », et un écran intercalaire en coûte un.
- **Mes réservations** : les cours à venir, à l'heure locale de la box.
- **Accueil** : la carte du prochain cours réservable, d'où partent les deux taps.
- **Mise à jour optimiste** de la place et du compteur, avec **retour en arrière
  visible** si le serveur refuse (`Toast`).
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

## Critères d'acceptation

Automatisables :

- [ ] **Avant le code** : test Vitest de `bookClass()` — une clé rejouée rend la
      même réservation ; chacun des six codes rend sa clé i18n ; une erreur
      inconnue rend `errors.unknown` plutôt que le texte de la base
- [ ] `pnpm i18n:check` reste vert : aucune chaîne des nouveaux écrans en dur
- [ ] Aucune couleur en dur dans les écrans ajoutés (règle 7 des règles non
      négociables)

À la main, sur un **appareil réel** — Expo web n'en coche aucun :

- [ ] Depuis l'accueil, réserver le prochain cours en **deux taps**
- [ ] Deux taps rapides sur le bouton → **une seule** réservation
- [ ] Mode avion pendant l'appel, réseau rétabli, nouvel essai → **une seule**
      réservation (la clé n'a pas changé)
- [ ] Cours complet → « ce cours est complet », et le bouton l'annonçait déjà
- [ ] Membre sans droits → « Choisir une formule », jamais une erreur brute
- [ ] Fenêtre close → la raison, exprimée en heure locale de la box
- [ ] Un refus fait **revenir** la place affichée à sa valeur réelle, visiblement
- [ ] La réservation apparaît dans « Mes réservations » et survit à la fermeture
      complète de l'app
- [ ] Un iPhone réglé en français fait tout le parcours **en français** — dépend
      de D-004
- [ ] p95 de l'appel `book_class` **< 800 ms**, mesuré sur appareil sur au moins
      20 appels, la valeur notée dans le rapport de session. C'est la moitié de
      T1 que le harnais de concurrence ne prouve pas : il n'y a pas d'appel HTTP
      dans un `docker exec`

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
