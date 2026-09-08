# P1-008 — Check-in QR et mode kiosque

**Phase** P1 · **Estimation** `6` j·h *(ne tient pas — voir les prérequis)* · **Dépend de** P1-003 ✅ · **Spec** §4-P3, RM3.1–3.6 · **Section règle 8 écrite le 8 septembre 2026**

## Objectif

Un membre entre dans la box, montre son téléphone, et la salle sait qu'il est là
— sans qu'un coach tienne une liste à la main.

## Ce que ce ticket suppose et qui doit exister

*Écrite le 8 septembre 2026, avant ouverture. Chaque état est **vérifié dans le
dépôt**, jamais supposé.*

### Ce qui existe

| Prérequis | Où il vit | État |
| --- | --- | --- |
| `bookings`, et la réservation qu'on vient pointer | `20260903090000_bookings_and_book_class.sql:37` | ✅ |
| `class_roster` — qui est inscrit à un cours | `20260905090000_class_roster.sql:140` | ✅ le mode coach a sa source, et sa règle d'exposition d'identité est déjà tranchée |
| `hmac`, `digest`, `gen_random_bytes` | schéma `extensions`, vérifiés en base | ✅ **un jeton signé se produit et se vérifie en PLpgSQL** — la logique reste transactionnelle (règle 3), aucun service à ajouter |
| `pg_cron` | `20260902120000:389`, déjà en service | ✅ le job de no-show a son ordonnanceur |
| Les rôles `COACH` / `MANAGER` et `current_admin_tenant_ids()` | P0-004 | ✅ |
| `default_visitor_capacity` | `20260830143106:171`, éditable dans les réglages | ⚠️ **un réglage sans mécanisme** — le nombre existe, le drop-in n'existe pas |

### Ce qui manque, et qu'aucun autre ticket ne livrera

| Prérequis | État |
| --- | --- |
| Table `checkins` | ❌ **aucune occurrence** dans `supabase/migrations/`. À créer ici |
| Un statut de présence sur `bookings` | ❌ `booking_status` vaut `CONFIRMED` | `CANCELLED` (`20260903090000:30`). Ni « venu », ni « no-show » |
| Fenêtre de check-in configurable | ❌ `tenant_settings` porte `open_days_before`, `close_minutes_before`, `cancel_window_minutes`, `max_upcoming_bookings` — **rien pour le pointage** |
| Génération de QR (mobile) | ❌ aucune bibliothèque dans `apps/mobile/package.json` |
| Lecture de QR (caméra) | ❌ aucune dépendance, ni web ni mobile |
| `expo-camera` dans **Expo Go** | ⚠️ **à vérifier sur la liste des modules embarqués du SDK 57 avant de s'appuyer dessus** — même précaution que pour `expo-network`, `expo-crypto` et `expo-localization`. La réponse décide si le mode coach s'exerce en Expo Go ou attend un *development build*, ce qui n'est plus un blocage mais reste un coût |
| Un PWA web | ❌ `apps/web/public` **n'existe pas** : ni manifeste, ni service worker, ni icône |
| Une file hors ligne côté web | ❌ rien. Le cache du mobile (`schedule-cache.ts`) est mobile et ne s'y transpose pas |
| **De quoi authentifier une tablette de kiosque** | ❌ **rien, et c'est une décision à prendre, pas un objet à écrire** — voir ci-dessous |

## Trois choses que cette section a trouvées, et qui changent le ticket

### 1. Le kiosque a besoin d'HTTPS, et le seul HTTPS qu'on aura passe par le domaine

Le prérequis noté le 6 septembre se confirme et va plus loin que prévu.
`getUserMedia` n'est pas exposée hors contexte sécurisé : sur
`http://<IP>:3000`, l'API est **absente de l'objet**, pas refusée. Une tablette
qui atteint le serveur par son IP ne peut donc pas scanner — ce n'est pas un
problème de test, c'est un problème de faisabilité.

**Et la sortie la moins chère est l'application déployée**, qui demande le nom de
domaine — celui qui bloque déjà `D-008` et qui est la seconde des deux lignes du
chemin critique. Le kiosque web est donc **plus bloqué qu'il n'en avait l'air**,
et par une démarche, pas par du code.

**Le mode coach, lui, ne l'est pas** : caméra native sur le téléphone, aucun
contexte sécurisé à fournir. C'est ce qui rend la découpe évidente.

### 2. « Validation locale hors ligne » ne peut pas vouloir dire ce qu'elle dit

Le périmètre annonce « cache local des membres attendus, **validation locale**
pendant 4 h ». Vérifier une signature hors ligne demanderait **la clé de
signature sur la tablette** — une clé de box, dans un vestiaire, sur un appareil
qu'on ne contrôle pas. C'est exactement ce que la règle du dépôt sur les jetons
interdit.

**La note du ticket répond déjà, et mieux** : « ne jamais bloquer l'entrée d'un
membre pour un problème réseau. En cas de doute, le check-in passe et se
réconcilie après. » Hors ligne, on **accepte et on met en file** ; on ne vérifie
pas. La déduplication se fait à la synchronisation, sur la clé du jeton.

Le mot « validation » est donc à corriger dans le périmètre : c'est une **mise en
file**, et la nuance est toute la différence entre un secret partagé et pas de
secret du tout.

### 3. Une tablette de kiosque n'a pas d'identité, et rien n'en prévoit

L'authentification du produit est un code à six chiffres envoyé par e-mail, par
personne. Une tablette posée à l'entrée n'est pas une personne. Trois issues,
aucune gratuite :

- **un compte de staff laissé connecté** — le plus simple, et le plus mauvais :
  un appareil non surveillé porte les droits d'un `MANAGER` ;
- **un jeton de kiosque révocable**, propre à la box, à créer — nouvelle table,
  nouvelle notion, et la règle « un jeton stocké est un jeton compromis à terme »
  s'y applique ;
- **pas de kiosque au pilote** : le mode coach suffit, et il existe déjà sur un
  appareil qui a une identité.

**À trancher avant d'écrire une ligne**, parce que les trois donnent des schémas
différents.

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --- | --- | --- |
| `checkins` + la fonction de pointage | l'écran coach, le kiosque | celui-ci |
| Le statut de présence sur `bookings` | le job de no-show, et **le reporting d'assiduité** | celui-ci, puis `P2-014` |
| Le drop-in au scan | `default_visitor_capacity`, réglage **sans appelant depuis P1-001b** | celui-ci — il lui en donne un |

## Ce que la section change au ticket

**L'estimation de 6 j·h ne tient pas.** Elle ne couvre ni le PWA, ni la file hors
ligne du web, ni l'identité du kiosque, ni les deux bibliothèques à ajouter et
justifier. À recompter au lancement, comme `P1-007`.

**Découpe recommandée**, sur le modèle de `P1-005` :

- **`P1-008a` — le pointage et le mode coach.** Table `checkins`, fonction de
  pointage transactionnelle, jeton signé en base, QR sur le mobile du membre,
  scan et pointage manuel côté coach, no-show par `pg_cron`. **Rien ne le
  bloque.**
- **`P1-008b` — le kiosque web.** PWA, caméra plein écran, file hors ligne,
  identité de la tablette. **Bloqué par le nom de domaine** (HTTPS) et par la
  décision d'identité ci-dessus.

La découpe n'est pas écrite ici : elle se fait au lancement, et elle appartient à
la commanditaire.

## Périmètre

- QR dynamique côté membre : jeton signé à durée de vie 30 s lié au `membership_id`.
- Mode kiosque (web PWA sur tablette) : caméra plein écran, retour visuel et sonore immédiat.
- Mode coach : scan depuis le téléphone, roster du cours, pointage manuel.
- Fenêtre de check-in : 30 min avant à 15 min après le début (configurable).
- Détection de no-show : réservation non annulée sans check-in après le cours.
- **Mode hors ligne** : cache local des membres attendus, validation locale pendant 4 h, synchronisation au retour du réseau.

## Critères d'acceptation

- [ ] Validation en moins de 1,5 seconde avec le prénom affiché
- [ ] Un QR de plus de 60 secondes est refusé (test avec capture d'écran)
- [ ] Wifi coupé : le check-in fonctionne et se synchronise ensuite sans doublon
- [ ] Un membre sans réservation se voit proposer un drop-in, jamais un refus sec
- [ ] Le pointage manuel par le coach est toujours possible en dernier recours
- [ ] Le taux de succès du check-in dépasse 99 % sur une semaine de pilote

## Notes

**Ne jamais bloquer l'entrée d'un membre pour un problème réseau.** En cas de doute, le check-in passe et se réconcilie après.
