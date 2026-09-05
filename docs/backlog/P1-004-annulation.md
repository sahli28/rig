# P1-004 — Annulation et fenêtres

**Phase** P1 · **Estimation** 4 j·h · **Dépend de** P1-003 · **Spec** RM2.4, RM2.7

## Périmètre

- Fonction PLpgSQL `cancel_booking` : transaction unique, libération de la place, restitution du droit selon la fenêtre.
- Fenêtre configurable par box (défaut 4 h), calculée en **heure locale de la box**.
- Feuille de confirmation explicite quand l'annulation est hors délai, avec la conséquence écrite avant validation.
- `DELETE /v1/bookings/{id}` idempotent.
- Annulation d'un cours entier par la box : notification à tous les inscrits, restitution automatique.

## Critères d'acceptation

- [x] Annulation à J-4h01 : **dans les délais**. À J-3h59 : **tardive** —
      formulation corrigée, voir « la conséquence » ci-dessous. Testé aux deux
      bornes **et pile dessus**, en pgTAP et en Vitest, les deux comparaisons
      devant dire la même chose
- [x] La conséquence est affichée **avant** validation, jamais après — feuille de
      confirmation hors fenêtre seulement : dans la fenêtre il n'y a rien à
      annoncer, et une friction sans information est du bruit
- [x] La place libérée est immédiatement disponible — le décrément est dans la
      transaction, sous le même verrou que la prise. La liste d'attente reste
      P1-006, comme le critère le disait déjà
- [ ] **Annuler un cours entier notifie tous les inscrits en moins de 60 secondes**
      — **ouvert**, et il le restera : aucun canal n'existe. Le push est P1-007,
      l'e-mail P2-015. L'écran le dit à qui annule plutôt que de laisser croire
      le contraire. À recocher à P1-007
- [x] **Ajouté :** un cours **déjà commencé** ne s'annule plus
      (`CLASS_ALREADY_STARTED`). Testé aux deux bornes — une minute avant, une
      minute après — **et pile au début**, en pgTAP et en Vitest
- [x] Aucune double restitution possible en cas de double appel — l'identifiant
      de la réservation **est** l'idempotence : la seconde annulation ne trouve
      plus de ligne `CONFIRMED` à transitionner
- [x] **Ajouté :** `booked_count = count(bookings CONFIRMED)` tient quand
      annulations et réservations se croisent — 15 annulations et 30
      réservations au même instant, en CI à chaque exécution

## Ce que le ticket a livré au-delà de son périmètre écrit

**Annuler un cours entier ne touchait pas ses réservations.** Le seul trigger sur
`classes` était `set_updated_at` : passer un cours à `CANCELLED` laissait ses
réservations `CONFIRMED`, le compteur plein, et la personne voyait toujours sa
réservation active dans « Mes réservations ».

C'était la sœur de l'annulation individuelle, elle était dans le périmètre écrit
(« restitution automatique »), et personne ne l'avait chiffrée. `cancel_class_bookings()`
la ferme, et **recalcule** `booked_count` au lieu de le décrémenter : un
décrément arithmétique propagerait une dérive au lieu de la corriger.

## La conséquence d'une annulation tardive, tranchée

RM2.4 dit « après : crédit consommé ». **Aucune table de crédits n'existe**
(P2-007), et le seul libellé du dépôt qui parlait de crédit était
`errors.no_valid_entitlement`.

Le pilote **accepte** l'annulation tardive, la marque, et n'en tire aucune
conséquence dans l'app. Trois raisons :

1. **c'est le modèle de la spec** : l'annulation a lieu dans les deux cas, seule
   la restitution diffère. Refuser inventerait une règle plus stricte que RM2.4 ;
2. **la place est libérée**, et c'est ce qui compte pour la box. Refuser
   laisserait un siège occupé par quelqu'un qui a dit ne pas venir — un no-show
   garanti, invisible pour la liste d'attente de P1-006 ;
3. **l'écran de réglages le promet déjà** : « au-delà desquelles l'annulation
   n'est plus **libre** ». Pas impossible : non gratuite.

### Mais « tardive » a une fin, et c'est le début du cours

Trouvé en relecture, corrigé dans le même lot : **rien n'interdisait d'annuler la
réservation d'un cours déjà passé.** `cancelled_within_window` valait `false`,
l'annulation était enregistrée comme tardive, et `booked_count` était décrémenté
sur un cours qui avait eu lieu.

**Conséquence principale : le no-show devenait effaçable.** RM3.4 le définit
comme « pas de check-in, cours eu lieu, réservation non annulée » — donc qui
n'était pas venu annulait le lendemain et son absence disparaissait. C'est la
donnée sur laquelle S5 s'appuiera, et elle aurait été faussée **avant** qu'on
écrive la règle qui l'utilise. Second effet, plus visible : un cours plein
affichait zéro inscrit dans les statistiques de remplissage une semaine plus
tard.

D'où `CLASS_ALREADY_STARTED`, et **la borne est le début du cours, pas sa fin** :

1. **c'est la même règle lue à sa borne, pas une règle nouvelle.** On accepte
   l'annulation tardive parce que la place est libérée et qu'un autre peut la
   prendre (raison 2 ci-dessus). Cette raison expire exactement à `starts_at` :
   personne n'entre dans un cours à sa vingtième minute. Après le début, annuler
   ne rend plus rien — ça retire seulement une trace ;
2. **la fin laisserait un trou large d'exactement un cours**, et pile aux minutes
   où l'absence devient un fait : on sait qu'on n'ira pas à 18h35, pas à 19h30 ;
3. **le cas d'usage « la box régularise après coup » est réel, et il a son propre
   chemin.** `cancel_class_bookings()` n'a **délibérément pas** cette garde :
   c'est le seul geste de rattrapage dont la box dispose, il passe par une garde
   de rôle, et ses annulations sont marquées `within_window = true`, subies. Un
   test pgTAP le fixe, pour que personne n'« aligne » les deux fonctions en
   croyant refermer un oubli.

Deux points d'ordre, dans la fonction :

- la garde vient **après** le contrôle de propriété, sinon répondre « ce cours a
  déjà eu lieu » à qui vise la réservation d'un autre confirmerait qu'elle
  existe ;
- elle vient **après** le retour idempotent : une annulation faite hier reste
  rejouable aujourd'hui, quand le cours a eu lieu entre-temps. La garde protège
  une transition, pas une lecture.

Côté écran : `cancelConsequence()` gagne un troisième cas, `started`, et le
bouton disparaît — proposer un geste dont la seule issue est un refus est pire
qu'un état sans geste. Le refus reste traité à l'arrivée : un écran ouvert
traverse l'heure de début sans qu'on le relise. Le test Vitest
« ne rend jamais un nombre de minutes négatif » disait **l'inverse** avant ce
lot : à J+12 min il attendait « tardif mais faisable ». Son titre décrivait un
défaut d'affichage à corriger, là où la règle métier manquait.

Le fait est **stocké** (`cancelled_within_window`), pas dérivé :
`cancel_window_minutes` est éditable, et un drapeau recalculé réécrirait
l'histoire de toutes les annulations passées à chaque changement de réglage.

**La microcopie ne promet aucun crédit.** La spec §12.3 proposait « ton crédit
sera consommé » — pour le pilote c'est un mensonge, et annoncer une conséquence
qui n'arrivera pas ferait annuler en croyant payer, ou renoncer en croyant
perdre. La phrase dit la vérité du pilote : la place est libérée, l'annulation
est enregistrée comme tardive, la box applique sa règle hors de l'app.

**La couture avec P2-007** : `restore_booking_entitlement(booking, within_window)`,
corps vide au pilote. P2-007 y met le crédit rendu au portefeuille (RM4.4),
P1-013 la séance de carnet. Une fonction remplacée, jamais une seconde ajoutée —
le motif de `member_has_booking_right()`, qui a déjà payé.

**Trois choses à savoir le jour où ce corps s'écrira**, relevées ici pendant
qu'elles étaient sous les yeux :

1. **La fonction ne revérifie rien par elle-même.** Elle est `security definer`
   et ne contrôle ni tenant ni appartenance : elle compte sur le fait que ses
   deux appelants ont déjà validé la réservation. Sans risque tant que le corps
   est vide et qu'elle est révoquée à tout le monde, `authenticated` compris.
   Le jour où elle écrit un crédit, ce raisonnement doit être **répété dans son
   corps**, pas supposé.
2. **Elle est appelée sous le verrou de `classes`.** Un crédit rendu s'écrira
   donc dans la même transaction que le décrément — ce qui est voulu, et ce qui
   interdit d'y mettre un appel réseau.
3. **Le compare-and-swap de `cancel_booking()` est ce qui la protège du double
   appel.** Il a fallu le trouver : la première version décrémentait deux fois
   quand deux onglets annulaient la même réservation. Avec un corps vide, la
   dérive n'était qu'un compteur faux ; avec un crédit, ce serait une double
   restitution. Ne pas défaire ce `and status = 'CONFIRMED'`.

## Ce que `rls-auditor` a trouvé et que la suite ne voyait pas

Passé sur la migration après la garde « cours commencé ». `VERDICT: SAFE` sur
l'isolation — mais il a posé la question que personne n'avait posée :
**`cancel_class_bookings()` n'était appelée que par Marc, `OWNER`.** Sa garde de
rôle et sa garde de tenant étaient écrites dans le `where` du `for update`, et
**rien ne prouvait qu'elles refusaient quoi que ce soit.** Sa sœur
`cancel_booking()` avait son test d'échec depuis le premier jet ; elle, non.

Contrôle structurel contre contrôle comportemental, exactement la distinction de
`CLAUDE.md` : la forme était bonne, le comportement n'était pas mesuré. Trois
cas ajoutés — un MEMBER de la box, une `OWNER` d'une autre box, et l'état qui
n'a pas bougé après les deux. Plus un quatrième sur `cancel_booking()` : toute
la suite tournait sur **un seul tenant**, et la phrase « une réservation
inconnue et celle d'une autre box rendent la même réponse » n'était affirmée que
par un commentaire.

**Vérifié en remettant la panne**, comme pour le compare-and-swap :
`current_admin_tenant_ids()` → `current_tenant_ids()` fait rougir le cas MEMBER ;
retirer le filtre de tenant fait rougir les deux. Sans ces tests, `pnpm test:db`
serait resté vert sur les deux régressions.

D'où la règle écrite dans `.claude/rules/database.md` : **`rls-auditor` passe sur
chaque migration**, pas seulement celles qui créent une table, et pas seulement
quand une compétence y pense. Avec sa limite, écrite au même endroit : son
silence dit « rien trouvé », jamais « rien à trouver » — les cinq trous de la
règle des sœurs lui avaient échappé.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `bookings`, `book_class()`, le verrou de ligne | P1-003 | ✅ existe |
| `booking_status` avec la valeur `CANCELLED` | P1-003 | ✅ existe — posée d'avance, l'index unique partiel `where status = 'CONFIRMED'` en dépend |
| `cancel_window_minutes`, en heure locale de la box | `tenant_settings` (P0-004), `tenants.timezone` | ✅ existent |
| Le harnais de concurrence | `scripts/booking-concurrency.mjs` | ✅ existe — **à étendre**, voir ci-dessous |
| **Canal de notification** (« annuler un cours notifie tous les inscrits ») | P1-007, P2-015 | ❌ **n'existe pas.** Même blocage que P1-002 : l'écran d'annulation d'une occurrence le dit déjà à qui annule. Ce critère reste ouvert jusqu'à P1-007 |
| Liste d'attente, pour proposer la place libérée | P1-006 | ❌ à créer par P1-006 — le critère le dit déjà |
| Frais d'annulation tardive / no-show | S5, v1 | ❌ hors périmètre, et c'est écrit : ici la restitution est binaire |

## Deux choses à ne pas redécouvrir

**1. `CANCEL_WINDOW_PASSED` ne change finalement pas de liste — et c'est la
décision de conception qui en décide.**

Cette note annonçait le contraire : « `cancel_booking()` le lèvera, il devra
rejoindre `APP_ERROR_CODES` ». C'était l'hypothèse d'un ticket qui n'avait pas
encore tranché RM2.4.

**Le pilote accepte l'annulation tardive** au lieu de la refuser (voir plus bas) :
aucune fonction ne lève donc ce code, et il reste au catalogue de l'API, pour le
jour où quelque chose refusera vraiment sur la fenêtre. Une note qui prédisait
juste sur un monde qu'on n'a pas construit.

Le cas de `errors.test.ts` qui s'appuyait sur lui **ne lui cherche plus de
successeur** : il choisit son sujet à l'exécution parmi les codes d'API que le
SQL ne lève pas, et **échoue bruyamment** si cet ensemble devient vide. Déplacer
ce caillou deux fois suffisait.

**`CLASS_ALREADY_STARTED` n'est pas son successeur non plus**, et la nuance vaut
d'être lue une fois : la fenêtre dépassée n'empêche pas d'annuler — elle marque
l'annulation comme tardive — tandis que le cours commencé, si. Deux codes parce
que ce sont deux réponses, pas deux formulations de la même. Le nouveau est dans
les deux listes (la base le lève, l'API le rendra) ; `CANCEL_WINDOW_PASSED`
reste au seul catalogue de l'API, et reste donc le sujet que `errors.test.ts`
choisit.

**2. La libération de place se prouve sous contention, comme la prise.** Le
verrou de ligne de `book_class()` protège l'incrément ; `cancel_booking()`
décrémente, et rien ne garantit encore que les deux ne se croisent pas. Le
scénario à écrire est **une annulation et une réservation simultanées sur la
dernière place** : la place doit finir prise une fois, ou libre, jamais comptée
deux fois. `scripts/booking-concurrency.mjs` a déjà le mécanisme de top de
départ commun — il lui manque ce scénario.

## Notes

Le calcul de fenêtre en heure locale est la source de bug classique. Test explicite autour du changement d'heure.
