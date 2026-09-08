# `P1-008a` — Le pointage, et le coach qui scanne

**Phase** `P1` · **Estimation** `7` j·h *(6 → 7 le 8 septembre 2026, avant ouverture — voir « Ce que la section a coûté »)* · **Dépend de** `P1-003` ✅, `P1-003c` ✅ · **Spec** §4-P3, RM3.1–3.6

*Découpé de `P1-008` le 8 septembre 2026. Le kiosque tablette est parti dans
`P1-008b`, **hors du pilote** — deux raisons indépendantes, voir là-bas.*

## Objectif

Un membre entre dans la box, montre son téléphone au coach, et la salle sait
qu'il est là — sans que personne tienne une liste à la main.

## Ce que ce ticket suppose et qui doit exister

*Chaque état est **vérifié dans le dépôt** ou à sa source, jamais supposé.*

### Ce qui existe

| Prérequis | Où il vit | État |
| --- | --- | --- |
| `bookings`, la réservation qu'on vient pointer | `20260903090000_bookings_and_book_class.sql:37` | ✅ |
| `class_roster` — qui est inscrit à un cours | `20260905090000_class_roster.sql:140` | ✅ le mode coach a sa source, **et sa règle d'exposition d'identité est déjà tranchée** (`.claude/rules/privacy.md`) |
| `hmac`, `digest`, `gen_random_bytes` | schéma `extensions`, **vérifiés en base** | ✅ **le jeton signé se produit et se vérifie en PLpgSQL** : la logique reste transactionnelle (règle 3), aucun service à ajouter |
| `pg_cron` | `20260902120000:389`, déjà en service | ✅ le job de no-show a son ordonnanceur |
| Les rôles `COACH` / `MANAGER`, `current_admin_tenant_ids()` | P0-004 | ✅ |
| Le formulaire des règles de réservation | `apps/web/app/box/[slug]/reglages/booking-rules-form.tsx:34` | ✅ **existe et liste ses champs** : rendre la fenêtre de pointage configurable, c'est y ajouter deux lignes, pas construire un écran |
| **`expo-camera`, scan de QR compris** | doc Expo, SDK 57 — **vérifié le 8 sept. 2026** | ✅ **« Included in Expo Go »**, Android et iOS. **Aucun development build n'est nécessaire pour ce ticket** |
| `default_visitor_capacity` | `20260830143106:171`, éditable depuis P1-001b | ⚠️ un réglage **sans appelant** — le nombre existe, le drop-in n'existe pas. Ce ticket lui en donne un (règle 7) |

### Ce qui manque, et que ce ticket crée

| Prérequis | État |
| --- | --- |
| Table `checkins` | ❌ **aucune occurrence** dans `supabase/migrations/`. À créer ici, avec `tenant_id`, RLS `force`, policies, grants et index (`.claude/rules/database.md`) |
| Un statut de présence | ❌ `booking_status` vaut `CONFIRMED` \| `CANCELLED` (`20260903090000:30`). Ni « venu », ni « no-show » |
| Fenêtre de pointage configurable | ❌ `tenant_settings` porte quatre réglages de réservation, **aucun de pointage** |
| Génération de QR sur mobile | ❌ aucune bibliothèque. Une à ajouter, justifiée au commit |

**Aucun `❌` ne renvoie à un autre ticket** : ils appartiennent tous à celui-ci,
et c'est ce qui le rend lançable.

## Deux corrections au périmètre d'origine

### « Validation locale » hors ligne — le mot était faux

Le périmètre de `P1-008` annonçait « cache local des membres attendus,
**validation locale** pendant 4 h ». **Vérifier une signature hors ligne
demanderait la clé de signature sur l'appareil** — une clé de box, dans un
vestiaire ou dans la poche d'un coach, sur un téléphone qu'on ne contrôle pas.
C'est exactement ce que la règle du dépôt sur les jetons interdit (« un jeton
stocké est un jeton compromis à terme »).

**RM3.5 répond déjà, et mieux** : « ne jamais bloquer l'entrée d'un membre pour
un problème réseau. En cas de doute, le check-in passe et se réconcilie après. »

Hors ligne, on **accepte et on met en file**. On ne vérifie pas. La
déduplication se fait à la synchronisation, sur l'identifiant du jeton.

> **C'est écrit ici et pas seulement dans un message**, parce que le périmètre
> d'origine est ce que quelqu'un relira dans six mois : sans cette correction, il
> implémenterait la mauvaise version en citant le ticket, et il aurait raison de
> le citer.

### Une caméra à la fois, et elle se démonte au blur

Contrainte de `expo-camera`, relevée à la vérification : « **Only one Camera
preview can be active at any given time.** If you have multiple screens in your
app, you should unmount `Camera` components whenever a screen is unfocused. »

Le dépôt a déjà l'outil et la leçon — `useRelireAuRetour` et `D-018` — mais dans
l'autre sens : ici il ne s'agit pas de **relire** au focus, il s'agit de
**libérer** au blur. Un écran de scan qui reste monté sous la pile prend la
caméra en otage, et le suivant ouvre un aperçu noir.

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --- | --- | --- |
| `checkins` + la fonction de pointage | l'écran coach | celui-ci |
| Le statut de présence | le job de no-show, puis le **reporting d'assiduité** | celui-ci, puis `P2-014` |
| Le drop-in au scan | `default_visitor_capacity`, réglage sans appelant depuis P1-001b | celui-ci |
| Le jeton signé et sa vérification | l'écran QR du membre, le scan du coach | celui-ci |

## Périmètre

- **Le jeton QR** : signé en base (`hmac`), lié au `membership_id`, durée de vie
  30 s, régénéré à l'écran tant qu'il est affiché.
- **La fonction de pointage** : transactionnelle, idempotente sur l'identifiant
  du jeton, elle refuse hors fenêtre et accepte le drop-in dans la limite de
  `default_visitor_capacity`.
- **La fenêtre de pointage** : deux colonnes dans `tenant_settings`, deux champs
  dans le formulaire des règles, valeurs par défaut 30 min avant / 15 min après.
- **Le statut de présence** et le job `pg_cron` qui marque les no-show après le
  cours.
- **L'écran QR du membre** sur mobile, et **l'écran de scan du coach** — feuille
  du cours, scan, et **pointage manuel toujours possible** (RM3.6).
- **Hors ligne** : le coach accepte et met en file, la synchronisation dédoublonne.
- pgTAP pour chaque fonction PLpgSQL, i18n FR + EN dans le même commit.

## Hors périmètre

- **Le kiosque tablette** → `P1-008b`, hors du pilote.
- **Le reporting d'assiduité** → `P2-014`. Ce ticket livre la donnée, pas l'écran
  qui la lit.
- Toute notion de jeton d'appareil : il n'y en a pas ici, le coach est une
  personne authentifiée.

## Critères d'acceptation

- [ ] Validation en moins de 1,5 seconde, avec le prénom affiché
- [ ] Un QR de plus de 60 secondes est refusé — testé avec une capture d'écran,
      qui est le vrai geste de fraude
- [ ] **appareil** — wifi coupé : le pointage passe, et se synchronise ensuite
      **sans doublon**
- [ ] Un membre sans réservation se voit proposer un drop-in, jamais un refus sec
- [ ] Le pointage manuel par le coach est toujours possible, en dernier recours
- [ ] Hors fenêtre, le pointage est refusé **par la base**, pas par l'écran
- [ ] Un no-show apparaît après le cours, et **seulement** pour une réservation
      confirmée sans pointage
- [ ] **appareil** — quitter l'écran de scan libère la caméra : l'écran suivant
      qui l'ouvre ne voit pas un aperçu noir
- [ ] Parité i18n, et l'arbre d'accessibilité relu sur les deux écrans

## Ce que la section a coûté, et pourquoi c'est une bonne nouvelle

**6 → 7 j·h**, et c'est le **quatrième dérapage d'estimation du projet — le
premier vu avant de commencer.** C'est tout l'objet de la règle 8 ; les trois
autres se sont déclarés en cours de route (P0-005 : 5 → 17, P1-001 : 4 → 11,5,
P1-003c : 2 → 3,5).

Le détail, pour qu'il soit contestable :

| Lot | j·h |
| --- | ---: |
| `checkins`, RLS, grants, index | 0,5 |
| Statut de présence + job `pg_cron` de no-show | 0,5 |
| Fenêtre de pointage : deux colonnes, deux champs dans un formulaire existant | 0,25 |
| Jeton signé (`hmac`) : production, rotation, vérification | 1 |
| Fonction de pointage : transaction, idempotence, drop-in | 1,25 |
| pgTAP de tout ce qui précède | 1 |
| Écran QR du membre (bibliothèque comprise) | 1 |
| Écran de scan du coach : feuille, scan, pointage manuel, libération de la caméra | 1 |
| i18n, accessibilité, passe appareil | 0,5 |

**Ce qui aurait pu coûter plus et ne coûtera pas** : `hmac` en base évite un
service d'émission de jetons, le formulaire de règles existe déjà, et
`expo-camera` est dans Expo Go — donc **aucun development build**, alors que le
contraire était l'hypothèse de travail il y a deux jours.

## Notes

**Ne jamais bloquer l'entrée d'un membre pour un problème réseau** (RM3.5). En
cas de doute, le pointage passe et se réconcilie après. C'est la seule ligne de
ce ticket qui ne se négocie pas, et c'est elle qui rend l'absence de vérification
hors ligne non seulement acceptable mais **juste**.
