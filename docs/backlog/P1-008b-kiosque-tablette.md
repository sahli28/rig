# `P1-008b` — Le check-in QR : le membre scanne lui-même

**Phase** `P1` · **Estimation** `6` j·h · **Dépend de** `P1-008a` · **Spec** §4-P3, §10, RM3.1–3.6 · **Non programmé** — déclencheur ci-dessous

*Découpé de `P1-008` le 8 septembre 2026, puis **élargi le même jour** : le
retour de la box pilote a déplacé ici tout ce qui scanne.*

## Objectif

Le membre pointe lui-même — son téléphone montre un QR, une tablette à l'entrée
ou le téléphone du coach le lit — et une box qui ne connaît pas ses adhérents par
leur prénom sait quand même qui est venu.

## Pourquoi il est non programmé, et pourquoi ce n'est pas « abandonné »

**La box pilote n'en a pas besoin.** Son coach connaît tous ses adhérents par
leur prénom et vérifie sa liste seul, sans trouver ça pénible. `P1-008a` lui
donne l'endroit où enregistrer ce qu'il sait déjà ; le scan ne lui apporterait
rien.

**Mais ce n'est pas un si, c'est un quand.** La spec §10 classe le check-in QR
« attendu par le marché, valeur perçue élevée pour un coût faible ». **Une box de
200 membres avec des coachs qui tournent ne connaît pas ses adhérents par leur
prénom** — et c'est le cas général, pas l'exception.

> ### Le déclencheur, datable
>
> **`P1-008b` s'ouvre à la première box qui n'est pas la box pilote** — ou plus
> tôt si une box en fait une condition d'achat.

## Ce que ce ticket suppose et qui doit exister

*Section écrite le 8 septembre 2026 pour `P1-008`, avant que le retour de la box
pilote ne la déplace ici. **Elle a trouvé trois choses, et chacune aurait coûté
une journée en plein développement.** Elle a servi à décider de **ne pas** lancer
le ticket — c'est le meilleur usage qu'on ait fait de la règle 8 jusqu'ici.*

### Ce qui existe

| Prérequis | Où il vit | État |
| --- | --- | --- |
| L'horodatage de présence, la fenêtre de pointage, le job de no-show | `P1-008a` | ❌ **`P1-008a`** |
| `class_roster` | `20260905090000_class_roster.sql:140` | ✅ |
| `hmac`, `digest`, `gen_random_bytes` | schéma `extensions`, **vérifiés en base** | ✅ **le jeton signé se produit et se vérifie en PLpgSQL** : la logique reste transactionnelle (règle 3), aucun service à ajouter |
| **`expo-camera`, scan de code-barres compris** | doc Expo SDK 57, **vérifiée le 8 sept. 2026** | ✅ **« Included in Expo Go »**, Android et iOS, **appareil physique uniquement**. Aucun development build pour le scan côté coach |
| `default_visitor_capacity` | `20260830143106:171`, éditable depuis P1-001b | ⚠️ un réglage **sans appelant** — le nombre existe, le drop-in n'existe pas. Ce ticket lui en donne un |

### Ce qui manque

| Prérequis | État |
| --- | --- |
| Table `checkins` | ❌ **à créer ici**, avec la reprise de ce que `P1-008a` porte sur `bookings` — un pointage peut désormais exister **sans réservation** (le drop-in), ce qui est précisément la raison de la table |
| Génération de QR sur mobile | ❌ aucune bibliothèque. Une à ajouter, justifiée au commit |
| Un PWA web | ❌ `apps/web/public` **n'existe pas** : ni manifeste, ni service worker, ni icône |
| Une file hors ligne côté web | ❌ rien. Le cache mobile (`schedule-cache.ts`) ne s'y transpose pas |
| **De quoi authentifier une tablette de kiosque** | ❌ **décision non prise, et volontairement** — voir ci-dessous |

## Les trois trouvailles, à ne pas repayer

### 1. « Validation locale » hors ligne ne peut pas vouloir dire ce qu'elle dit

Le périmètre d'origine annonçait « cache local des membres attendus, **validation
locale** pendant 4 h ». Vérifier une signature hors ligne demanderait **la clé de
signature sur l'appareil** — une clé de box, dans un vestiaire, sur une tablette
qu'on ne contrôle pas. C'est ce que la règle du dépôt sur les jetons interdit.

**RM3.5 répond déjà, et mieux** : « ne jamais bloquer l'entrée d'un membre pour
un problème réseau. En cas de doute, le check-in passe et se réconcilie après. »
Hors ligne, on **accepte et on met en file**. On ne vérifie pas ; la
déduplication se fait à la synchronisation.

Le mot est corrigé dans le périmètre ci-dessous. **Sans cette correction,
quelqu'un implémenterait la mauvaise version en citant le ticket — et il aurait
raison de le citer.**

### 2. Le kiosque a besoin d'HTTPS, et le seul HTTPS passe par le domaine

`getUserMedia` n'est **pas exposée** hors contexte sécurisé : sur
`http://<IP>:3000`, l'API est *absente de l'objet*, pas refusée. Une tablette qui
atteint le serveur par son adresse locale ne peut pas scanner.

Le scan **depuis le téléphone du coach** n'est pas concerné : caméra native.

### 3. Une tablette de kiosque n'a pas d'identité, et rien n'en prévoit

L'authentification du produit est un code à six chiffres par e-mail, **par
personne**. Une tablette posée à l'entrée n'est pas une personne.

| Issue | Verdict, le 8 septembre 2026 |
| --- | --- |
| Un **compte de staff laissé connecté** | ❌ **écarté net.** Une tablette non surveillée portant les droits d'un `MANAGER` dans un vestiaire est indéfendable, et **impossible à écrire dans le registre RGPD** |
| Un **jeton de kiosque révocable** | ✅ la bonne réponse, **mais sans appelant** tant qu'aucune box ne le demande. Règle 7, dans ce sens-là aussi |
| **Pas de kiosque au pilote** | ✅ **retenu** |

**Le volet kiosque porte donc deux blocages indépendants** — pas d'HTTPS sans le
domaine, pas d'identité de tablette — et les nommer tous les deux importe :
**acheter le domaine ne le débloquerait pas**. Le volet « QR + scan du coach »,
lui, n'en porte aucun : il attend seulement une box qui en ait besoin.

## Périmètre

- **Le jeton QR** : signé en base (`hmac`), lié au `membership_id`, durée de vie
  30 s, régénéré tant qu'il est affiché. L'écran QR du membre.
- **Le scan depuis le téléphone du coach** — `expo-camera`. *(Contrainte relevée
  à la vérification : « only one Camera preview can be active at any given
  time » — l'écran de scan doit **libérer la caméra au blur**, sans quoi le
  suivant ouvre un aperçu noir. Le dépôt a l'outil et la leçon avec
  `useRelireAuRetour` et `D-018`, mais dans l'autre sens.)*
- **Le kiosque tablette** : PWA installable, caméra plein écran, retour visuel et
  sonore, et l'identité de la tablette dans la forme qui aura été tranchée.
- **Le drop-in au scan**, dans la limite de `default_visitor_capacity`.
- **La table `checkins`** et la reprise de ce que `P1-008a` porte sur `bookings`.
- **Hors ligne : on accepte et on met en file**, la synchronisation dédoublonne.

## Critères d'acceptation

- [ ] Validation en moins de 1,5 seconde, avec le prénom affiché
- [ ] Un QR de plus de 60 secondes est refusé — testé avec une capture d'écran,
      qui est le vrai geste de fraude
- [ ] Wifi coupé : le pointage passe et se synchronise ensuite **sans doublon**
- [ ] Un membre sans réservation se voit proposer un drop-in, jamais un refus sec
- [ ] Le pointage manuel du coach reste possible en dernier recours — il existe
      déjà (`P1-008a`), et ce ticket ne doit pas le dégrader
- [ ] Quitter l'écran de scan **libère la caméra** : l'écran suivant qui l'ouvre
      ne voit pas un aperçu noir
- [ ] La tablette **ne porte aucun droit** au-delà du pointage — c'est le critère
      qui décide de la forme de son identité
- [ ] Retirer une tablette du parc coupe son accès immédiatement *(et à écrire
      quand ce sera vrai : une session révoquée reste utilisable jusqu'à quinze
      minutes — `.claude/rules/api.md`)*

## Notes

**6 j·h**, contre 3 quand ce ticket n'était que le kiosque. Il porte désormais
tout ce qui scanne — et il est hors du total ① tant que son déclencheur n'est pas
survenu.
