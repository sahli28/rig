# `P1-008a` — Le coach coche sa feuille, et l'absent est marqué

**Phase** `P1` · **Estimation** `3,75` j·h *(6 → 7 → 3,75 — voir « Le ticket a été retourné »)* · **Dépend de** `P1-003` ✅, `P1-003c` ✅ · **Spec** §4-P3, RM3.4, RM3.6 · **Origine** retour de la box pilote, 8 septembre 2026

## Objectif

Le coach sait qui est venu, et l'absent qui n'a pas annulé est marqué comme tel.

## ⤾ Le ticket a été retourné, et c'est le client qui l'a retourné

`P1-008` s'ouvrait sur : « un membre entre, montre son téléphone, et la salle
sait qu'il est là — **sans qu'un coach tienne une liste à la main** ».

**C'est exactement le geste que le coach de la box pilote fait, et il ne le
trouve pas pénible.** Il connaît tous ses adhérents par leur prénom et vérifie la
liste des inscrits avant et pendant la séance, seul.

Ce dont il a besoin était **en dernière ligne du périmètre, présenté comme un
repli** : RM3.6, le pointage manuel par le coach. **Le repli est le produit ; le
QR est l'extra.**

Il veut sanctionner les absents, donc **la détection de no-show garde tout son
sens**. Mais il sait déjà qui n'est pas venu : il lui faut **un endroit où
l'enregistrer**, pas un lecteur de code-barres.

Tout le reste — QR dynamique, kiosque, drop-in au scan, PWA, file hors ligne —
part dans `P1-008b`, **non programmé**. Avec lui part la section « ce que ce
ticket suppose » écrite le matin même : c'est elle qui portait la valeur, et ses
trois trouvailles auraient coûté une journée chacune en plein développement.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| `bookings` | `20260903090000_bookings_and_book_class.sql:37` | ✅ c'est **la** ligne qu'on marque : pointer, c'est dire « cette réservation a été honorée » |
| `class_roster` — qui est inscrit à ce cours | `20260905090000_class_roster.sql:140` | ✅ la feuille existe, **et sa règle d'exposition d'identité est déjà tranchée** |
| `pg_cron` | `20260902120000:389`, en service | ✅ le job de no-show a son ordonnanceur |
| Les rôles `COACH` / `MANAGER` | P0-004 | ✅ |
| Le formulaire des règles de réservation | `apps/web/app/box/[slug]/reglages/booking-rules-form.tsx:34` | ✅ la fenêtre de pointage, c'est **deux champs de plus**, pas un écran |
| **Un horodatage de présence** | *rien* — `booking_status` vaut `CONFIRMED` \| `CANCELLED` (`20260903090000:30`) | ❌ à créer ici |
| **Une fenêtre de pointage** | *rien* dans `tenant_settings` | ❌ à créer ici |
| **Un écran de feuille de cours côté coach** | *rien* — `class_roster` n'a **aucun écran** | ❌ à créer ici, **et sur mobile** — voir la décision ci-dessous |
| **Une surface coach dans l'app mobile** | *rien* — `apps/mobile/app/(app)/` ne porte que cinq écrans membre, et **le mot `role` n'apparaît nulle part** dans `apps/mobile` (vérifié le 9 sept. 2026) | ❌ **la feuille sera la première surface de l'app qui dépend d'un rôle.** Ce n'est pas un écran de plus : c'est un point d'entrée, une garde et une navigation qui n'existent pas |

### La feuille de cours est **mobile**, et c'est tranché

**Décidé le 9 septembre 2026, hors ticket, pendant que la question était
claire** — précisément pour qu'elle ne se découvre pas en cours de route.

Le geste se fait **en salle, téléphone en main, pendant que les membres
arrivent**. Pas sur un ordinateur portable posé quelque part. La spec le dit
déjà en §4-P3 : « le coach scanne avec son téléphone », et `Coach Roster` y
figure parmi les écrans du parcours, pas parmi ceux du back-office.

**Trois conséquences, et la deuxième est celle qui coûte :**

1. `D-021`, qui ouvre la porte du back-office web aux COACH, **ne sert pas ce
   ticket**. Elle sert `P1-015` — le coach écrit son WOD le dimanche soir, sur un
   ordinateur. Les deux gestes du coach ne vivent pas sur le même appareil, et
   c'est normal : l'un se fait assis, l'autre debout ;
2. **la feuille sera la première surface de l'app mobile qui dépend d'un rôle.**
   Aujourd'hui `apps/mobile` ne lit jamais `membership.role` — cinq écrans
   membre, une pile, aucune bifurcation. Il faut donc un point d'entrée visible
   d'un coach et invisible d'un membre, une garde, et un retour. **Le lot
   « écran de feuille » à 1,25 j·h ne couvre pas ça** : il a été chiffré comme un
   écran, et c'est un mode ;
3. la fenêtre de pointage reste **web** — deux champs dans le formulaire de
   réglages existant, qui est un geste de gérant, pas de coach.

> **L'estimation de 3,75 j·h est donc à recompter à l'ouverture**, comme celle
> de `P1-007`. Elle n'est pas fausse d'un lot entier — la base, la fonction, le
> job et le pgTAP ne bougent pas — mais le lot d'écran est sous-évalué, et le
> dire maintenant vaut mieux que de le constater au troisième jour.
>
> **C'est le cinquième dérapage d'estimation vu avant l'ouverture**, et la
> consigne est la même que pour les quatre autres : **réestimer à l'ouverture,
> pas absorber, et dire de combien.** Première lecture, à confirmer ou corriger
> le jour même — le lot d'écran passe de 1,25 à **2,5** (point d'entrée réservé
> au coach, garde, la feuille, le retour), soit **+1,25, 3,75 → 5**. Le total ①
> ne bouge pas avant que ce chiffre soit tenu par quelqu'un qui a ouvert le
> ticket.
>
> **Et `P1-017` se joue pendant ce ticket** — le projet Supabase hébergé et le
> déploiement web, sortis de `P1-016` pour ne pas concentrer l'inconnu la
> semaine de la box. Ils ne touchent pas ce lot ; ils partagent son calendrier.

### La présence va sur `bookings`, et pas dans une table `checkins`

**C'est une décision, pas un raccourci.** Un pointage manuel marque **une
réservation** comme honorée : la donnée a exactement la forme de la ligne qui
existe déjà.

Une table `checkins` n'a de sens que le jour où un pointage peut exister **sans
réservation** — le drop-in — ou porter des événements propres : l'appareil,
l'heure exacte, la source. Ces deux besoins sont dans `P1-008b`. **Créer la table
maintenant serait un mécanisme avant son appelant** (règle 7), et il faudrait
deviner ses colonnes sans le cas d'usage qui les dicte.

`P1-008b` porte donc explicitement la reprise : il crée `checkins` et migre ce
qui est sur `bookings`. C'est écrit **là-bas**, pour que ce ne soit pas une
surprise.

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --- | --- | --- |
| L'horodatage de présence | le job de no-show, puis le **reporting d'assiduité** | celui-ci, puis `P2-014` |
| L'écran de feuille de cours | le coach, tous les jours | celui-ci |
| Le statut de no-show | les frais d'absence | **`S5`, v1** — la box pilote punit à l'erg, ce qui n'est pas du logiciel |

## Périmètre

- **Un horodatage de présence sur `bookings`**, posé et retiré par le coach.
- **L'écran de feuille de cours** : les inscrits, une case par personne, écriture
  immédiate — pas de bouton « Enregistrer », même raison que dans l'écran de
  préférences.
- **La fenêtre de pointage** : deux colonnes dans `tenant_settings`, deux champs
  dans le formulaire existant, 30 min avant / 15 min après par défaut.
- **Le job de no-show** : `pg_cron` marque après le cours les réservations
  confirmées sans pointage.
- Fonction PLpgSQL transactionnelle et son pgTAP, i18n FR + EN.

## Hors périmètre

- **Tout ce qui scanne** → `P1-008b` : QR dynamique, kiosque, drop-in au scan,
  PWA, file hors ligne.
- **Les frais d'absence** → `S5`, v1. Confirmé par la box pilote le 8 septembre
  2026 : elle aimerait facturer 5 €, et dit elle-même « pas tout de suite ».
- **Le reporting d'assiduité** → `P2-014`. Ce ticket livre la donnée.

## ✅ Clos le 10 septembre 2026

Fusionné (PR #72) **et** passe iPhone jouée le jour même (§ 5 octies), geste 8
compris : le coach ouvre la feuille et coche d'une main, le membre est refusé
par l'adresse. Les sept critères sont verts. Le no-show sanctionnable existe
sans QR, et `R4` bouge encore : le coach a un second geste dans l'app.

## Ce qui a été fait — 10 septembre 2026

**Quatre lots, sur `feat/P1-008a-pointage`** (voir « Ordre des lots » du plan) :
la base SQL (deux colonnes sur `bookings`, la fenêtre dans `tenant_settings`, la
vue `class_attendance_sheet`, `set_attendance()`, le job `mark_no_shows()`), le
module core (`attendance.ts`, `canTakeAttendance()`), les deux champs web, et le
mode coach mobile (route `/attendance/:id` + point d'entrée gardé).

**Découverte qui a corrigé le ticket** : `class_roster` était annoncée « la
feuille existe ✅ » — elle est *peer-scoped*, inutilisable par un coach. D'où une
**vue neuve**, et l'arbitrage RGPD de la 4e audience (`privacy.md`), tranché
prénom + initiale, `hidden_from_roster` ignoré (traitement légitime).

`pnpm test:db` vert (498, dont `attendance_test.sql` 27, contrôles négatifs
joués), `rls-auditor` **SAFE**, 489 tests Vitest, typecheck/lint/sondes/i18n
verts.

## Critères d'acceptation

- [x] Le coach ouvre la feuille d'un cours, coche une personne, et c'est écrit —
      sans bouton d'enregistrement. Mécanisme prouvé au harnais, **et joué sur
      l'iPhone à la passe du 10 septembre 2026** (§ 5 octies)
- [x] Décocher retire le pointage : c'est un geste réversible, pas un
      enregistrement définitif — pgTAP `set_attendance(false)` remet
      `attended_at` à `null`, et l'écran l'appelle
- [x] Hors fenêtre de pointage, la base refuse — pas seulement l'écran. pgTAP,
      code applicatif `ATTENDANCE_WINDOW_CLOSED`, **contrôle négatif joué**
      (fenêtre élargie → l'appel hors-fenêtre passe)
- [x] Un no-show apparaît après le cours, et **seulement** pour une réservation
      confirmée sans pointage. Une réservation annulée n'est pas un no-show —
      pgTAP, et le job idempotent
- [x] Un coach d'une autre box ne pointe rien ici — pgTAP dans les deux sens
      (Sarah sur Nanterre refusée ; un membre refusé ; la vue cloisonnée des
      deux côtés)
- [x] **Parité i18n** (493 clés, alignées). Arbre d'accessibilité : chaque case
      porte **le nom** en libellé (« Léa M. »), pas « case à cocher » — **lecture
      VoiceOver confirmée à la passe du 10 septembre 2026**
- [x] **appareil** — la feuille se tient d'une main, en salle, cours en cours ;
      l'entrée « Feuille de présence » est **visible d'un coach, invisible d'un
      membre** ; VoiceOver annonce chaque case par qui elle pointe. **Passe du
      10 septembre 2026 OK** (§ 5 octies), geste 8 compris — le membre est bien
      refusé par l'adresse

## Estimation

| Lot | j·h |
| --- | ---: |
| Horodatage de présence, fenêtre de pointage, deux champs dans le formulaire existant | 1 |
| Fonction de pointage transactionnelle + job `pg_cron` de no-show | 1 |
| pgTAP | 0,75 |
| Écran de feuille de cours côté coach — **sous-évalué, voir « La feuille de cours est mobile »** | 1,25 |
| i18n, accessibilité, passe appareil | 0,5 |

**3,75 j·h**, contre 7 pour la version qui scannait. **Ce n'est pas une
réestimation, c'est un autre ticket** : le QR, le kiosque et leurs prérequis sont
partis, et avec eux la bibliothèque à ajouter, le jeton signé et sa rotation.

### Réestimé à l'ouverture — 3,75 → 5,5 (10 septembre 2026)

La consigne du ticket : réestimer à l'ouverture, **dire de combien**. Deux
moteurs, mesurés en écrivant, pas devinés :

- **l'écran mobile est un mode** (+1,25, déjà pressenti) : point d'entrée gardé,
  garde de rôle, route, retour — pas « un écran » ;
- **la vue coach + l'arbitrage RGPD** (+0,5) : l'estimation supposait la feuille
  existante ; `class_roster` étant peer-scoped, il a fallu une vue neuve, son
  pgTAP, et trancher la 4e audience de `privacy.md`.

Le lot « écran de feuille » passe de 1,25 à 2,5 ; le lot base gagne 0,25 pour la
vue. **Total 5,5.** Le total ① bouge en conséquence à l'ouverture (voir
`README.md`).

## Notes

**Ne jamais bloquer l'entrée d'un membre pour un problème réseau** (RM3.5) reste
vrai et devient facile : il n'y a plus de scan à faire échouer. Le coach coche
quand il peut ; s'il n'a pas de réseau, il coche après.
