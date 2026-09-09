# Passe manuelle — l'app mobile sur un iPhone

Première mise en service de `apps/mobile` sur un appareil réel, via Expo Go.
Elle ferme les quatre critères restés en `[~]` depuis P0-001 et P0-002, et elle
lève l'inconnue qui pèse sur P1-002b puis sur P1-003.

Compter 30 minutes la première fois, 3 minutes ensuite.

---

## Ce qui doit être vrai avant de commencer

- Supabase local démarré (`pnpm exec supabase status` répond).
- L'iPhone et le PC sur **le même réseau Wi-Fi**.
- Expo Go installé depuis l'App Store.

---

## 1. L'adresse de la machine sur le réseau local

Le téléphone ne connaît pas `127.0.0.1` : cette adresse, pour lui, c'est
lui-même. Il lui faut l'adresse du PC sur le Wi-Fi.

Dans PowerShell :

```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.InterfaceAlias -notmatch 'Loopback|WSL|vEthernet' } |
  Select-Object InterfaceAlias, IPAddress
```

Retenir celle de l'interface Wi-Fi — de la forme `192.168.x.x` ou `10.x.x.x`.
Dans la suite, elle s'écrit `<IP>`.

## 2. `apps/mobile/.env.local`

À créer à la main, à côté de `package.json` de l'app mobile :

```
EXPO_PUBLIC_SUPABASE_URL=http://<IP>:55321
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

La clé est **la même** que celle du web (`supabase status`, ligne
« publishable key »). Jamais la `sb_secret_…` : elle contourne toute la RLS et
elle finirait dans un bundle JavaScript lisible sur le téléphone.

Le préfixe `EXPO_PUBLIC_` n'est pas décoratif : Metro remplace le texte
`process.env.EXPO_PUBLIC_…` au moment du bundling, et ne remplace rien d'autre.

## 3. Vérifier que le téléphone atteint la base — avant de lancer Expo

**C'est l'étape qui décide de tout le reste.** La quasi-totalité des « Expo ne
marche pas » sont en réalité un téléphone qui n'atteint pas le PC.

Sur l'iPhone, dans Safari, ouvrir :

```
http://<IP>:55321/rest/v1/
```

Réponse attendue — un texte JSON du genre :

```json
{"message":"No API key found in request"}
```

**C'est un succès.** Le serveur a répondu ; il refuse simplement une requête
sans clé, ce qui est son travail. Si la page tourne dans le vide ou dit qu'elle
ne peut pas se connecter, s'arrêter là et régler ça d'abord :

| Cause probable | Ce qu'on fait |
|---|---|
| Pas le même réseau (Wi-Fi vs 5G) | Désactiver les données mobiles sur l'iPhone |
| Pare-feu Windows | Autoriser Docker Desktop / le port 55321 en réseau privé |
| Wi-Fi public, box opérateur en « isolation des clients » | **Partage de connexion depuis l'iPhone** : connecter le PC au hotspot du téléphone, puis **refaire l'étape 1** — l'IP a changé |

## 4. Démarrer Metro

```bash
pnpm --filter @rack/mobile exec expo start --clear
```

`--clear` vide le cache : sans lui, un `.env.local` créé après un premier
démarrage n'est pas relu, et l'app se plaint d'une configuration absente alors
que le fichier est là.

Sur l'iPhone : ouvrir l'app **Appareil photo** (pas le scanner d'Expo Go),
viser le QR code du terminal, toucher la notification.

## 5. Les cinq vérifications

| # | Geste | Attendu |
|---|---|---|
| 1 | L'app s'ouvre | Écran de bienvenue, aux couleurs du thème, en français |
| 2 | Saisir `marc@rueil.example`, demander le code | Écran de saisie du code à six chiffres |
| 3 | Sur le PC, Mailpit `http://127.0.0.1:55324` → dernier message → recopier le code sur le téléphone | Connexion acceptée, puis l'écran des consentements |
| 4 | Accepter, arriver sur l'accueil | On voit l'écran d'accueil membre |
| 5 | **Tuer l'app** (glisser vers le haut depuis le sélecteur), la rouvrir | **On est toujours connectée** |

La cinquième est la seule qui compte vraiment. Elle éprouve le découpage de la
session en morceaux de 2 Ko dans le trousseau (`chunkedStore`) — du code écrit
le 31 août, testé unitairement, jamais exécuté sur un vrai trousseau iOS. Si
quelque chose casse dans cette passe, c'est probablement là.

**Sixième vérification, depuis que P1-002b est clos : le mode avion.** Ce n'est
plus un bonus et la dégradation n'est plus « attendue », elle est spécifiée.

| Geste | Attendu |
|---|---|
| Mode avion, rouvrir l'app sur un jour **déjà visité** | Le planning s'affiche, avec « Hors ligne. Planning enregistré … » et l'heure d'enregistrement |
| Mode avion, aller sur un jour **jamais visité** | Un message qui dit qu'il n'a rien pu charger — **pas** « aucun cours ce jour-là », **pas** de squelette — et il arrive tout de suite, le même à chaque essai |

Le bandeau parle du **jour affiché**, jamais de la dernière écriture du cache :
c'est le défaut trouvé le 4 septembre 2026, et le geste qui le vérifie est de
changer de jour hors ligne sans quitter l'écran.

## 5 bis. Le parcours d'invitation

Ajouté après la passe du 3 septembre 2026, qui l'a trouvé cassé de bout en bout
alors que les cinq vérifications ci-dessus étaient vertes.

| # | Geste | Attendu |
|---|---|---|
| 1 | Ouvrir `http://<IP>:8081/--/invitation/inv-rueil-0001` (ou le lien collé depuis le back-office) | L'écran de bienvenue dit **« Bienvenue chez CF Rueil »**, en **orange** |
| 2 | Continuer, se connecter en `nouveau@example.com` | Code reçu dans Mailpit |
| 3 | Arriver sur l'accueil | La box active est **CrossFit Rueil**, pas « aucune box » |

**La couleur fait partie du critère.** Depuis que la marque de la plateforme est
un graphite (`#1F2933`) et non plus l'orange de Rueil, « c'est orange » prouve
que le thème du tenant a été résolu. Avant, les deux étaient identiques et
l'écran de bienvenue a pu rester à la marque par défaut pendant tout le parcours
sans que personne le voie.

Contrôle négatif, à faire dans la foulée : ouvrir `/welcome` **sans jeton**.
L'écran doit dire « Bienvenue sur Rack » et le bouton doit être **gris-bleu**. Si
les deux écrans se ressemblent, la passe ne prouve rien.

Le seed ne porte qu'une invitation Rueil et elle est à usage unique :
`pnpm db:reset` la remet à `PENDING` avant chaque essai.

## 5 ter. L'annulation (P1-004)

**Oui, ce lot demande une passe**, et pas au titre de la prudence : il livre un
geste destructeur sur mobile — une feuille de confirmation, une mise à jour
optimiste, un bouton qui **disparaît** dans un état — et deux de ses quatre
états ne sont **pas atteignables par l'app**. Aucun test ne les regarde à
l'écran ; la passe du 5 septembre a couvert la réservation, pas l'annulation.

### Geste 0 — le décor, à rejouer après chaque `pnpm db:reset`

`book_class()` refuse un cours à moins de `close_minutes_before` (15 min) : on ne
peut donc **pas** réserver dans l'app un cours en train de se dérouler ni un
cours passé. Ces deux réservations-là s'écrivent en SQL ; les deux autres se
prennent dans l'app, parce que c'est le chemin qu'on veut exercer.

```bash
export PATH="$PATH:/c/Users/sahli/AppData/Local/Programs/DockerDesktop/resources/bin"
docker exec -i supabase_db_imys psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/fixtures/passe-p1-004.sql
```

Le script est **rejouable** : il efface son propre décor avant de le reposer, et
ne touche à rien d'autre. Après un `db:reset`, le relancer tel quel. Il finit par
un tableau qui dit ce qui a été posé — **le lire** : c'est lui qui donne les
heures locales à chercher dans le planning.

Un point à garder en tête : le cours « dans 2 h » tombe sur **le lendemain** si
la passe se fait après 22 h. Le planning le range au jour de son heure locale,
pas au jour où on est.

### Scénario A — annuler dans la fenêtre (cours **1**, demain)

| # | Geste | Attendu |
|---|---|---|
| 1 | Planning → le jour de demain → ouvrir le cours de l'heure donnée par le tableau | Écran du cours, bouton **Réserver** |
| 2 | Réserver | État **Réservé**, une place de moins |
| 3 | Toucher **Annuler ma réservation** | **Aucune feuille** — dans la fenêtre, il n'y a rien à annoncer, et une friction sans information est du bruit |
| 4 | — | Toast « Réservation annulée. Ta place est libérée. » ; VoiceOver annonce **le cours et l'heure**, pas seulement « annulé » |
| 5 | — | Le compteur de places remonte **tout de suite** |
| 6 | Réserver à nouveau le même cours | Accepté — annuler puis re-réserver est permis |

### Scénario B — annuler hors fenêtre (cours **2**, dans ~2 h)

| # | Geste | Attendu |
|---|---|---|
| 1 | Ouvrir le cours, **Réserver** | Accepté : 2 h, c'est au-delà des 15 min de fermeture |
| 2 | Toucher **Annuler ma réservation** | Feuille **« Annulation tardive »** |
| 3 | Lire la phrase | Elle ne promet **aucun crédit** : place libérée, annulation enregistrée comme tardive, la box applique sa règle hors de l'app |
| 4 | **Garder ma place** | La feuille se ferme, **rien n'a bougé** — le contrôle négatif |
| 5 | Rouvrir la feuille → **Annuler quand même** | Toast de succès, place libérée |

Puis, sur le PC, vérifier que le jugement est bien écrit :

```bash
docker exec -i supabase_db_imys psql -U postgres -d postgres -c "select idempotency_key, status, cancelled_within_window from public.bookings where class_id = 'cf000000-0000-4000-8000-000000000002';"
```

`cancelled_within_window` doit valoir **`f`**.

### Scénario C — le cours a commencé (cours **3**, il y a 20 min)

**C'est le cœur du lot.** Le no-show de RM3.4 ne doit pas être effaçable.

| # | Geste | Attendu |
|---|---|---|
| 1 | Planning → **aujourd'hui** → ouvrir le cours commencé | État **Réservé** |
| 2 | Chercher le bouton | **Il n'y a pas de bouton « Annuler ma réservation »** |
| 3 | VoiceOver / `read_page filter=interactive` | Aucune action d'annulation dans l'arbre — pas un bouton grisé, **absent** |

### Scénario D — le cours d'hier (cours **4**)

Même écran, un jour plus tôt dans le sélecteur de semaine. Même attendu que C :
aucun bouton. Il vaut d'être fait séparément parce qu'il passe par la navigation
vers un jour passé, ce que C ne fait pas.

### Scénario E — le refus du serveur, qu'on ne voit qu'en le provoquant

Le bouton disparaît **au rendu**. Un écran resté ouvert traverse l'heure de
début sans se relire : c'est le seul chemin par lequel le refus
`CLASS_ALREADY_STARTED` arrive vraiment à l'écran, et c'est celui qu'on veut
avoir vu au moins une fois.

1. Réserver le cours **2** dans l'app, **laisser l'écran du cours ouvert**.
2. Sur le PC, faire commencer le cours :

```bash
docker exec -i supabase_db_imys psql -U postgres -d postgres -c "update public.classes set starts_at = now() - interval '1 minute', ends_at = now() + interval '59 minutes' where id = 'cf000000-0000-4000-8000-000000000002';"
```

3. Sur le téléphone, **sans quitter l'écran**, toucher **Annuler ma réservation**
   puis **Annuler quand même**.

| Attendu | Pourquoi ça compte |
|---|---|
| Toast rouge : « Ce cours a déjà eu lieu : il ne s'annule plus. Contacte ta box si c'est une erreur. » | Le message dit **quoi faire**, et vient du code applicatif, jamais du texte SQL |
| Le compteur de places **revient** à sa valeur d'avant | La mise à jour optimiste décrémente puis se fait démentir — si le compteur reste faux, c'est le défaut |
| La réservation est toujours **Réservé** après rafraîchissement | Le no-show tient |

### À lire pendant la passe, et à trancher après

`booking.cancel_confirm_late` dit « Il reste moins de **{minutes}** minutes avant
le cours », et l'écran y passe **les minutes restantes réelles** (≈ 127 pour le
cours 2), pas la fenêtre de la box (240). La phrase devient « il reste moins de
127 minutes » : vraie, mais « moins de » annonce un seuil, et le nombre n'en est
pas un. À lire sur l'écran avant de décider — soit la phrase passe à la fenêtre,
soit elle perd son « moins de ». Repéré à la relecture, pas corrigé : la
formulation se juge en la lisant.

## 5 quater. Le badge « Réservé » (P1-012)

**Trois critères sur sept ne se voient que sur l'appareil** — hors ligne, purge à
la déconnexion, deux boxes sur le même compte — et ils sont « tenus par
construction », ce qui n'est pas la même chose qu'observés. Mais ce n'est pas la
vraie raison de cette passe.

Le lot a pris **deux décisions qui créent chacune un cas neuf** : `BookedDays`
change de forme (jour → *identifiants* au lieu de jour → *nombre*), donc **les
caches déjà posés sur le téléphone ne valident plus** ; et la relecture au retour
est devenue silencieuse et concurrente (un jeton, deux déclencheurs). Ni l'une ni
l'autre n'existait quand les critères du ticket ont été écrits.

### ⚠️ L'ordre compte, et le premier geste est destructeur

**Le cache de l'ancienne forme, posé par P1-014, est sur le téléphone
maintenant. La première lecture en ligne le remplace définitivement.** Si la
passe commence par ouvrir l'app avec du réseau, le scénario A n'est plus
exerçable sans désinstaller — et c'est le seul scénario qui exerce la montée de
version que vivra la box pilote.

Donc : **mode avion avant d'ouvrir l'app**, et scénario A en premier.

### Geste 0 — le décor

Sur le PC, dans cet ordre :

1. **L'IP a changé** si la box wifi a changé : reprendre les sections 1 à 3 de
   cette page. Un badge absent parce que la requête n'est jamais partie
   ressemble beaucoup à un badge cassé.
2. `pnpm test:db:fresh` — un seed neuf. Les réservations prises dans l'app
   pendant une passe font rougir `pnpm test:db` ensuite : c'est souvent le
   décor. **« Souvent » n'est pas « toujours » — voir la règle du décor en fin
   de page.**
3. `pnpm --filter @rack/mobile start -c` — le `-c` n'est pas décoratif ici : le
   bundle change de forme de cache.

Compte : `lea@example.com`. Pour le scénario F : `julie@example.com`, membre de
deux boxes.

### Scénario A — le cache d'hier, sur une app d'aujourd'hui

Le seul scénario à durée de vie limitée. Téléphone **en mode avion**, app **pas
encore ouverte** depuis la mise à jour.

| # | Geste | Attendu |
|---|---|---|
| 1 | Mode avion, puis ouvrir l'app | Le planning s'affiche depuis le cache, sans écran rouge |
| 2 | Regarder les jours du calendrier | **Aucune pastille** — l'ancien cache a été jeté, il ne pouvait pas être relu |
| 3 | Regarder la liste du jour | **Aucun badge « Réservé »**, pour la même raison |
| 4 | **Lire l'écran comme une membre** | C'est le point à juger : l'écran dit-il quelque part qu'il est hors ligne, ou **affirme-t-il en creux « tu n'as rien réservé »** ? |
| 5 | Couper le mode avion, revenir sur le planning | Pastilles et badges apparaissent, sans relancer l'app |

Le geste 4 est le seul de cette page qui ne se coche pas : il se **tranche**. Le
ticket avait écarté l'option A (« hors ligne, aucun marqueur ») parce qu'un
planning qui s'affiche sans ses réservations est moins fiable que le reste de
l'app. La montée de version recrée exactement cet état, une fois, pour chaque
membre. Si l'écran ment, c'est un ticket — pas un correctif glissé ici.

### Scénario B — le parcours nominal, celui que le ticket promet

| # | Geste | Attendu |
|---|---|---|
| 1 | Planning, jour de demain, cours de 18h30 | La ligne dit `16 places` et **aucun badge** |
| 2 | Ouvrir la fiche, **Réserver**, revenir par le retour | La ligne dit **`Réservé`** *et* `15 places` — **les deux**, sans relancer l'app |
| 3 | Regarder le calendrier | La pastille du jour est là |
| 4 | Rouvrir la fiche, **Annuler**, revenir | Le badge disparaît, la ligne repasse à `16 places` |
| 5 | Regarder le calendrier | La pastille a disparu |

Si le badge suit mais pas le nombre de places — ou l'inverse — c'est le volet
`D-016` qui n'est absorbé qu'à moitié.

### Scénario C — la relecture est silencieuse

À faire l'œil sur l'écran, pas sur le résultat.

| # | Geste | Attendu |
|---|---|---|
| 1 | Réserver, puis revenir sur le planning | **Aucun squelette, aucun clignotement.** La liste reste affichée et se met à jour |
| 2 | Refaire le retour trois fois | Toujours pas de clignotement — un défaut de ce genre est intermittent |

Remplacer un affichage périmé par un scintillement à chaque retour serait un
mauvais échange, et c'est le risque explicite de la décision prise.

> ❌ **Échoué le 6 septembre 2026.** Toute la page clignote au retour, après
> réservation comme après annulation. Pas la liste : l'écran entier. Parti en
> **`D-018`**, avec la vérification qui exclut déjà le mécanisme de P1-012 —
> le chemin de relecture est bien silencieux, ce qui clignote est au-dessus.

### Scénario D — feuilleter les mois sans perdre les badges

C'est le trou que le ticket ne voyait pas, trouvé en le codant.

| # | Geste | Attendu |
|---|---|---|
| 1 | Sur un jour où l'on a une réservation, ouvrir le calendrier | Pastille visible sur ce jour |
| 2 | Feuilleter jusqu'au **mois suivant**, sans choisir de jour | Le calendrier montre octobre ; **la liste en dessous n'a pas bougé** |
| 3 | Regarder la liste | **Le badge « Réservé » est toujours là.** Il ne dépend pas du mois affiché au-dessus |
| 4 | Revenir au mois courant | Rien n'a bougé, pas de rechargement visible |
| 5 | Feuilleter deux mois en avant puis choisir un jour | Le jour s'ouvre, ses badges sont justes |

### Scénario E — hors ligne, avec un cache de la bonne forme

Après le scénario B, donc avec un cache neuf. **Ferme un des trois critères.**

| # | Geste | Attendu |
|---|---|---|
| 1 | Réserver un cours, revenir, vérifier le badge | Badge présent |
| 2 | Mode avion, tuer l'app, la rouvrir | Le planning s'affiche depuis le cache, **badge et pastille compris** |
| 3 | Ouvrir un jour jamais visité en ligne | Le message hors ligne habituel, pas d'écran vide muet |

### Scénario F — ce qui reste du compte précédent, et des deux boxes

**Ferme les deux derniers critères.** C'est le geste que `D-011` réclame depuis
le 4 septembre : il se joue ici.

| # | Geste | Attendu |
|---|---|---|
| 1 | Avec `lea@example.com`, réserver un cours (badge visible) | Badge présent |
| 2 | Se déconnecter, se reconnecter en `julie@example.com` | **Aucun badge de Léa nulle part**, aucune pastille héritée |
| 3 | Julie réserve dans **sa première box**, revenir au planning | Badge sur le bon cours |
| 4 | Basculer sur **sa seconde box** | ⛔ **Impossible aujourd'hui** — voir ci-dessous |

> ⛔ **Gestes 4 à 6 non exerçables, et le noter vaut mieux que les bricoler.**
> Constaté le 6 septembre 2026 : **il n'existe aucun moyen de changer de box
> sans se déconnecter** et refaire un code — c'est `P1-009`, le sélecteur de
> box, qui n'est pas livré.
>
> Passer par la déconnexion **ne prouve rien** : elle déclenche la purge du
> cache (`clearScheduleCache()`). On observerait « aucun marqueur de la
> première box » parce que **tout** a été effacé, pas parce que la clé est
> partitionnée par `(userId, tenantId)`. Ce serait un vert obtenu par le
> mauvais mécanisme — précisément ce que cette page existe pour éviter.
>
> Le critère « deux boxes ne mélangent pas leurs marqueurs » reste donc `[~]`,
> et ce qui le rendra exerçable a un nom : **P1-009**.

### Scénario G — le badge existe pour tout le monde

| # | Geste | Attendu |
|---|---|---|
| 1 | VoiceOver, balayer jusqu'à une ligne réservée | L'annonce **dit « Réservé »** — le badge est un texte, pas une couleur seule |
| 2 | Réglages → Affichage → taille du texte à 200 %, revenir | Le badge ne chevauche pas le nombre de places, la ligne ne se tronque pas |
| 3 | Thème sombre (le correctif `D-017` vient de passer) | Le badge est lisible, et l'ouverture de l'app ne flashe pas en blanc |

### Scénario H — deux déclencheurs qui courent ensemble

La relecture est devenue concurrente : le drapeau d'annulation est devenu un
jeton. Cet invariant se casse en allant vite, pas en allant bien.

| # | Geste | Attendu |
|---|---|---|
| 1 | Réserver, revenir, et **changer de jour immédiatement** | Le badge du jour précédent **n'apparaît jamais** sur le nouveau jour |
| 2 | Enchaîner cinq changements de jour rapides | Aucun badge ne « colle » à un jour où il n'a rien à faire |
| 3 | Réseau lent (mode avion une seconde, puis rétabli) pendant un changement de jour | La liste et les badges parlent du **même** jour, toujours |

## Ce qu'Expo Go ne peut pas exercer, quoi qu'on fasse

À connaître avant d'écrire un critère qui l'attend pour rien.

**Le schéma personnalisé.** Expo Go ouvre les liens par `exp://` ; `rack://`
n'existe que dans un *development build*. Un critère « le lien `rack://` ouvre
l'app » n'est donc pas « à faire à la prochaine passe », il est **à faire au
premier build dédié** — donc après le compte développeur Apple. Établi le
5 septembre 2026, sur le reliquat de `D-013`.

**Un p95 qui veuille dire quelque chose.** Le téléphone et la base sont sur le
même Wi-Fi, et la base tourne sur la machine d'à côté : les durées mesurées sont
un **plancher**. Elles prouvent que l'instrumentation fonctionne, pas que le T1
de la spec §16.4 est tenu. Ce seuil se mesurera contre un environnement distant.

## Sans téléphone : `pnpm --filter @rack/mobile web`

Le bundle web d'Expo exerce le routeur, les fournisseurs, les écrans et les
appels réseau — tout sauf le trousseau, `expo-localization` et le rendu natif.
Il ne coche **aucun** critère de cette page, et il attrape ce que refaire une
passe coûte trop cher à attraper : c'est lui qui a montré, en une navigation,
que `/invitation/<jeton>` tombait sur « Unmatched Route ».

## Ce que le moteur offre — à regarder quand un écran plante « à la construction »

Le produit tourne sous **Hermes**, qui n'a qu'une partie d'`Intl`. Les tests,
eux, tournent sous Node : ils ne peuvent pas voir ce qui manque.

Le symptôme à reconnaître d'un coup d'œil :

    Render Error — undefined cannot be used as a constructor

C'est presque toujours un `new Quelquechose(...)` où `Quelquechose` n'existe pas
sur ce moteur. Le 4 septembre 2026, c'était `Intl.PluralRules`, sur la première
clé au pluriel jamais rendue par le mobile.

`crypto` relève du même symptôme et n'a **jamais** été exercé sur appareil :
Hermes ne l'a pas du tout, et le runtime « winter » d'Expo ne l'installe pas.
L'app doit poser sa source d'aléa au démarrage (`installRandomBytesSource()`,
`packages/core/src/crypto.ts`) ; si elle ne l'a pas fait, le premier tap sur
« Réserver » lève une erreur qui le dit en toutes lettres, au lieu de fabriquer
une clé d'idempotence avec `Math.random()`. C'est **le premier de la famille
qu'on a vu venir** plutôt que subi.

Ce qui est **prouvé** sur appareil à ce jour : `Intl.DateTimeFormat` avec un
`timeZone` — la même trace montre que l'en-tête de jour et les heures s'étaient
affichés avant le plantage. Ce qui ne l'est **pas** : `Intl.NumberFormat`, jamais
exercé faute d'écran affichant un montant.

Le reste de la réponse est dans `packages/core/src/i18n/intl.ts`, seul module
autorisé à toucher `Intl`, où chaque fonction dit ce qu'elle suppose. Et
`D-010` chiffre ce que coûterait un filet qui s'exécute vraiment sous Hermes.

## 5 quinquies. Le temps réel (P1-005a)

**Un seul critère n'a pas pu être exercé au harnais**, et il vaut sa section :
un onglet caché n'est pas un téléphone. Écrit ici parce qu'une case à cocher
dans un ticket et une ligne de journal ne disent pas **quoi faire** — c'est
exactement ce que `D-014` décrit, « un trou connu qui ne vit que dans un message
de commit finit par ne vivre nulle part ».

### Le geste qui décide est plus étroit que « passer en arrière-plan »

`apps/mobile/lib/use-realtime-classes.ts` se débranche sur **tout ce qui n'est
pas `active`** :

```ts
if (etat === 'active') { brancher(); rappels.current.relire(); }
else { debrancher(); }
```

Or iOS n'a pas deux états mais trois, et `inactive` arrive **beaucoup** plus
souvent qu'on ne le croit en l'écrivant : centre de contrôle tiré, bandeau
d'appel ou de notification, aperçu du sélecteur d'apps, Siri. À chaque fois, sur
le code actuel : canal coupé, pastille en « reconnexion », et une **relecture
réseau** au retour.

Donc le geste n'est pas « verrouiller le téléphone ». Ce sont deux gestes
distincts, et ils testent deux moitiés différentes : le centre de contrôle
décide de la nervosité, le verrouillage décide du canal.

**Les gestes eux-mêmes sont dans le bloc C de la passe groupée** (§ 5 sexies),
avec les trois autres dettes d'appareil. Cette section garde le raisonnement,
parce que c'est lui qui explique pourquoi le geste est celui-là et pas l'autre.

**Ce qui est déjà prouvé et n'a pas à être rejoué** : le compteur qui bouge en
moins de 3 s, l'isolation entre boxes, le repli à 30 s et son arrêt au retour du
canal, l'absence de fuite sur 20 écrans. Tout ça a été mesuré au harnais le
6 septembre 2026 — la passe ne couvre que ce que le navigateur ne sait pas faire.

## 5 septies. La séance du cours (P1-015)

**Un seul critère d'appareil, et c'est celui qui décide du ticket.** P1-015 est
le premier ticket venu d'un client : son effet ne se juge pas au harnais, il se
juge sur l'écran où le coach lit sa propre séance et sur celui où le membre la
découvre.

### Le décor

Sur le PC, dans le back-office (`http://localhost:3000/box/crossfit-rueil/planning`),
en **coach** — `sarah@example.com` — et non en gérant : c'est le droit que le
ticket a ouvert, et le seul geste qui prouve que `current_staff_tenant_ids()`
sert.

> #### ⛔ Ce décor n'est pas jouable aujourd'hui — `D-021`
>
> **Passe du 9 septembre 2026 : Sarah n'entre pas.** La porte du back-office
> (`apps/web/app/box/[slug]/layout.tsx:56`) arrête tout ce qui n'est ni OWNER ni
> MANAGER, et `P1-015` ne l'a pas touchée. Les gestes ci-dessous ont donc été
> joués avec un compte d'administration, ce qui vérifie la séance **et pas le
> droit du coach**.
>
> **`D-021` ouvre la porte** (branche `feat/D-021-la-porte-du-coach`, 9 sept.
> 2026). Dès qu'il est sur `main`, ce décor se joue tel qu'il est écrit — **mais
> le geste 1 vit désormais côté web** : `docs/passe-manuelle-web.md`, extension
> A″, gestes A10 à A15, et c'est A14 qui ferme le critère de `P1-015`. Ici ne
> restent que les gestes 2 à 8, sur l'iPhone. Le slug est `crossfit-rueil` —
> `/box/rueil/…` n'existe pas, et cette page l'a écrit pendant un jour.

| # | Geste | Attendu |
|---|---|---|
| 1 | Ouvrir une occurrence, écrire une séance sur **trois blocs séparés par des lignes vides** (échauffement / force / metcon), cocher « Publier », enregistrer | Enregistré, et l'écran dit que **publier ne prévient personne** |
| 2 | Sur l'iPhone, ouvrir la fiche de ce cours | La séance s'affiche **avec ses sauts de ligne** — les trois blocs restent trois blocs |
| 3 | Titre laissé vide au geste 1 ? | L'écran affiche **le nom du cours**, pas « Séance » |
| 4 | Mode sombre, puis texte à **200 %** | Le texte reste lisible et ne déborde pas |
| 5 | Sur une occurrence **sans** séance publiée | **Aucune section** — pas de bloc vide, pas de « rien à afficher » |
| 6 | Écrire une séance **sans** cocher « Publier », rouvrir la fiche sur l'iPhone | **Rien.** Un brouillon n'existe pas pour un membre |

### Le geste qui décide vraiment

| # | Geste | Attendu |
|---|---|---|
| 7 | Sur le PC, **vider le champ** d'une séance existante et enregistrer | Une confirmation apparaît. **Sans la cocher, rien n'est supprimé** |
| 8 | Idem avec **une seule espace** dans le champ | Même confirmation — « une espace » ne vaut pas « supprime » |

Les gestes 7 et 8 sont ceux qui protègent le travail du dimanche soir. Le reste
du ticket est vérifié en base et au harnais ; ceux-là ne se voient qu'à l'écran.

**Et le geste 1 a trouvé autre chose, que personne n'avait vu en lisant le
code** : pour atteindre « La séance », on traverse le champ « Motif » et le
bouton « Annuler ce cours » du panneau d'annulation, en variante primaire. Deux
zones de texte se suivent sans séparation, et se tromper de champ, c'est écrire
son WOD dans celui qui annule le cours. Parti en `D-021` avec la porte.

**Et les gestes 7 et 8 ont trouvé un défaut en base, le soir** : la
confirmation apparaît, mais la confirmer répondait « Une erreur est survenue »
— l'archivage était refusé par la policy de lecture (piège 13 de
`database.md`), et sa sœur cassait « supprimer une série » depuis P1-002 sans
que personne le sache. Corrigé dans `fix/P1-015-gestes-7-et-8` ; **ces deux
gestes se rejouent sur `main`**, et c'est là qu'on vérifie aussi que l'écran
dit « Séance supprimée » et non « Enregistré », et que le bouton de suppression
n'est plus orange.

### Le repère, à noter au journal

**Chronométrer la saisie d'une semaine complète**, pré-remplissage compris, et la
comparer à Hustle Up. C'est le seul repère du ticket : si le coach perd, il garde
son outil et la fonctionnalité aura été livrée **sans gagner l'usage**. Une vue
semaine deviendra alors un ticket — avec la mesure qui le justifie, pas avant.

## 5 sexies. La passe groupée — quatre dettes, une passe

**Pourquoi groupée**, décidé le 6 septembre 2026 : quatre tickets ont laissé un
critère d'appareil ouvert, et jouer quatre passes coûterait quatre fois le
décor, quatre fois l'IP, quatre fois le seed. C'est tout l'intérêt de les avoir
laissées s'accumuler — à condition de ne pas laisser passer la fenêtre.

| Bloc | Ce qu'il ferme | Ticket |
| --- | --- | --- |
| **A** | Ce qui reste du compte précédent, le fuseau, le contenu du cache | `D-011` (3 critères) |
| **B** | L'accueil retrouvé après une réservation | `D-016` (1 critère) |
| **C** | L'arrière-plan et le canal temps réel | `P1-005a` (1 critère) |
| **D** | Le balayage iOS | `D-009` (1 critère, le dernier) |

### ⚠️ L'ordre compte, et pour deux raisons différentes

**Le bloc A d'abord, et son geste 1 avant tout autre.** « Arriver sur un second
compte sans passer par la déconnexion » ne s'exerce qu'une fois : dès qu'on
touche « Se déconnecter », `clearScheduleCache()` efface tout le préfixe et le
geste ne montre plus rien — il exercerait l'effacement, pas le cloisonnement.
C'est la remarque centrale de `D-011`, et elle se perd si la passe commence par
se promener dans l'app.

**Le bloc B a une contrainte d'heure, et elle a déjà coûté une vérification.**
La carte de l'accueil n'affiche que le prochain cours **du jour**. Au harnais du
7 septembre, la passe s'est faite à 23 h 55 heure de la box : il n'y avait plus
de cours, et le critère est resté `[ ]` alors que le mécanisme était bon.
**Vérifier qu'un cours reste aujourd'hui avant de commencer**, sinon décaler un
cours dans le décor (commande au geste B0).

### Geste 0 — le décor

Sur le PC, dans cet ordre :

1. **L'IP a changé** si la box wifi a changé : reprendre les sections 1 à 3.
2. `pnpm test:db:fresh` — un seed neuf. Les réservations prises pendant la passe
   font rougir `pnpm test:db` ensuite : c'est **souvent** le décor. La règle qui
   décide est en fin de section.
3. `pnpm --filter @rack/mobile start -c`.

Comptes : `lea@example.com` (principal), `sarah@example.com` (le second compte du
bloc A), `julie@example.com` (pour provoquer des changements depuis l'autre
côté).

---

### Bloc A — le cache, là où il vit (`D-011`)

**A1. Ce qui reste du compte précédent — à jouer en premier.**

Le chemin qui prouve quelque chose n'est pas la déconnexion, c'est la **session
perdue** : elle n'appelle pas `signOut()`, donc pas `clearScheduleCache()`, et
c'est la clé `(utilisateur, box, jour)` qui doit protéger toute seule.

> ### ⚠️ Révoquer la session ne suffit pas — corrigé le 8 septembre 2026
>
> **Trouvé en jouant le bloc A, et c'est la procédure qui avait tort, pas le
> produit.** Supprimer la ligne d'`auth.sessions` révoque le *refresh token* ;
> l'*access token* est un JWT autonome, vérifié par signature et expiration,
> **sans jamais interroger la base**. `config.toml` porte `jwt_expiry = 900` et
> `session.tsx` ne fait que `getSession()` (lecture locale) et
> `onAuthStateChange` — aucun `getUser()`. L'app reste donc connectée jusqu'à
> **quinze minutes** après la révocation, sans une seule requête au serveur.
>
> D'où l'étape 0 ci-dessous. **L'ordre compte** : seuls les jetons émis *après*
> le changement sont courts, donc il faut se reconnecter entre les deux.

| #   | Geste                                                                                                                                                                                     | Attendu                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 0   | Dans `supabase/config.toml`, passer `jwt_expiry` à `60`, puis `pnpm exec supabase stop && pnpm exec supabase start`                                                                        | Les prochains jetons émis vivront une minute. **Remettre `900` après la passe**                                  |
| 1   | **Se reconnecter** en `lea@example.com` — l'ancien jeton dure encore quinze minutes, il faut en émettre un neuf                                                                            | Session active, jeton court                                                                                      |
| 2   | Ouvrir le planning et **feuilleter trois jours** pour poser du cache                                                                                                                      | Les trois journées s'affichent                                                                                   |
| 3   | Sur le PC : `docker exec supabase_db_imys psql -U postgres -d postgres -c "delete from auth.sessions where user_id='33333333-0000-4000-8000-000000000001';"`                                | La session de Léa est révoquée **sans que l'app le sache**                                                       |
| 4   | **Attendre une minute**, puis tuer l'app et la rouvrir                                                                                                                                    | Elle retombe sur l'écran de connexion — session expirée, **aucune déconnexion**                                  |
| 5   | Se connecter en `sarah@example.com`, aller au planning, feuilleter les mêmes jours                                                                                                        | **Rien du planning de Léa n'apparaît**, à aucun moment, pas même une fraction de seconde avant le chargement      |

**Et surtout : ne pas atteindre l'écran de connexion par « Se déconnecter ».**
`clearScheduleCache()` efface tout le préfixe, et le vert serait faux —
exactement le piège du scénario « deux boxes ».

**A2. Le fuseau.** Réglages iOS → Général → Date et heure → fuseau **Tokyo**
(l'écart ne se confond avec rien). Rouvrir le planning : **les heures restent
celles de la box**. Le calcul a douze tests, son effet à l'écran n'en a aucun.
Remettre Paris ensuite.

**A3. Le contenu du cache.** Menu développeur d'Expo Go → débogage JS →
dans la console : `Object.keys(localStorage).filter(k => k.startsWith('rack.'))`,
puis lire une valeur. Attendu : la clé porte `rack.schedule.<utilisateur>.<box>.<jour>`,
et la valeur ne contient **ni adresse e-mail, ni nom d'inscrit, ni jeton**. La
forme `DaySchedule` l'interdit déjà — c'est la relecture qui le prouve, et c'est
tout l'objet du geste.

> Le harnais web montre les mêmes clés (vérifié le 7 sept. 2026). Il prouve la
> **forme**, pas ce qui est écrit sur l'appareil : il ne remplace pas ce geste.

---

### Bloc B — l'accueil retrouvé (`D-016`)

**B0. Vérifier qu'un cours reste aujourd'hui**, sinon la carte est absente et le
geste ne montre rien :

```bash
docker exec supabase_db_imys psql -U postgres -d postgres -c "select starts_at from public.classes where tenant_id='aaaaaaaa-0000-4000-8000-000000000001' and starts_at > now() order by starts_at limit 1;"
```

S'il n'en reste pas pour aujourd'hui, décaler un cours dans le décor — et
`pnpm test:db:fresh` après la passe.

| # | Geste | Attendu |
|---|---|---|
| 1 | Depuis l'accueil, lire la carte « Ton prochain cours » : noter le nombre de places | Une carte, avec son compteur et sa pastille d'état |
| 2 | Aller au planning, ouvrir ce cours, **réserver**, revenir à l'accueil | Le badge et le compteur de la carte **sont à jour**, et **sans squelette** |
| 3 | Mode avion, quitter l'accueil et y revenir | La carte **reste affichée** telle quelle — une relecture qui échoue ne remplace pas une information correcte par rien |

Le geste 2 est le critère resté ouvert : l'accueil est la racine de la pile, il
ne remonte jamais, et jusqu'à `D-016` il affichait l'état du lancement de l'app.

---

### Bloc C — l'arrière-plan et le canal (`P1-005a`)

Le raisonnement est au § 5 quinquies : l'écouteur se débranche sur tout ce qui
n'est pas `active`, et iOS émet `inactive` bien plus souvent qu'on ne le croit.

**Le décor** : un second client pour provoquer les changements — le back-office
web, ou `book_class()` en `psql` avec `julie@example.com`.

| # | Geste | Attendu | Ce que ça décide |
|---|---|---|---|
| 1 | Sur le planning, **tirer le centre de contrôle et le refermer** aussitôt. Trois fois de suite | La pastille **ne devrait pas** clignoter en « reconnexion » pour une demi-seconde de centre de contrôle | Si elle clignote et qu'une lecture part à chaque fois : **une nervosité à arbitrer, pas un vert.** Le correctif candidat tient en un mot — ne se débrancher que sur `background`, pas sur `inactive` — mais c'est un arbitrage : `inactive` couvre aussi des cas où le socket est réellement gelé |
| 2 | **Verrouiller l'écran**, attendre 30 s, déverrouiller | Le canal se rebranche et l'écran affiche l'état du moment | L'autre moitié : le canal survit-il à un vrai passage en arrière-plan |
| 3 | Pendant l'app verrouillée, réserver depuis le PC, puis déverrouiller | Le compteur est à jour **sans** squelette ni rechargement visible | Les événements manqués ne se rattrapent pas : c'est la relecture au retour qui doit les couvrir, silencieusement |
| 4 | Après les trois, sur le PC : `select count(*) from realtime.subscription;` | **2** — l'accueil et le planning, pas un de plus | Aucun canal orphelin. Le compte monte transitoirement (`removeChannel()` est asynchrone) : laisser retomber quelques secondes avant de lire |

---

### Bloc D — le balayage iOS (`D-009`)

Le dernier critère de `D-009`, et le seul que le harnais ne peut pas exercer.

| # | Geste | Attendu |
|---|---|---|
| 1 | Depuis le planning, ouvrir une fiche de cours, puis **balayer depuis le bord gauche** | Retour au planning, sur le jour qu'on regardait |
| 2 | Balayer depuis un écran atteint par une redirection (après connexion, par exemple) | **Aucun retour vers un écran interdit** — `dismissAll()` avant `replace()` doit avoir vidé la pile |
| 3 | Balayer à moitié puis relâcher | L'écran revient en place, sans état intermédiaire figé |

---

### Après la passe

- **La règle du décor, et c'est une étape, pas un conseil** (`D-020`) :

  > **Un rouge attribué au décor se prouve sur un seed neuf, ou il n'est pas
  > attribué.**

  `pnpm test:db:fresh`, puis **noter le verdict dans le journal des passes** :

  | Résultat | Ce que ça veut dire | Ce qu'on fait |
  | --- | --- | --- |
  | **vert** | c'était le décor | on le note, avec la date. Fin |
  | **rouge** | c'est un défaut | **il prend un ticket.** Pas une explication, pas « effet d'interaction » |

  Aucune troisième issue. « Sans doute le décor » n'en est pas une — c'est
  exactement la phrase qui a avalé un vrai défaut le 6 septembre 2026, revenu
  deux jours plus tard (`D-020`). L'instruction qui apprend à ignorer un rouge
  est justifiée, le bruit est réel ; c'est pour ça qu'elle doit rendre un
  **résultat** plutôt qu'une impression de fin de session.
- **Remettre `jwt_expiry = 900` dans `supabase/config.toml`** et redémarrer
  Supabase (bloc A1, étape 0). Une minute de jeton laissée en place ferait
  reconnecter l'app sans arrêt, et on chercherait longtemps pourquoi.
- Remettre le fuseau du téléphone sur Paris (bloc A2).
- **Dater le journal ci-dessous.** Une passe non datée ne prouve rien : c'est
  écrit dans `D-011` et c'est vrai des quatre.
- Cocher dans chaque ticket **ce qui a été observé**, pas ce qui a été déduit.
  Un mécanisme qui fonctionne n'est pas un critère tenu — `D-016` en a fait la
  démonstration le 7 septembre.

## Journal des passes

Une passe se périme — Expo bouge, l'IP change, le trousseau se vide. Les dates
sont donc la moitié de l'information.

**Le verdict du décor s'écrit ici** (`D-020`) : chaque ligne de passe se termine
par `test:db:fresh` — **vert = décor**, **rouge = défaut, et il a un ticket**.
Une passe dont le journal ne dit pas ce que ce contrôle a rendu n'a pas eu lieu
en entier.

| Date | Appareil | Résultat |
| --- | --- | --- |
| **9 sept. 2026**, soir | **harnais web sur le PC**, `sarah@example.com` (COACH) puis `marc@rueil.example` | **`D-021`, extension A″ de `passe-manuelle-web.md`. A14 ✅ : Sarah entre et écrit sa séance — le critère d'écran de `P1-015` est fermé.** La restriction du coach se voit à trois endroits sans la chercher : navigation réduite à Tableau de bord et Planning, séries sans « Modifier » ni « Nouvelle série », panneau sans annulation. En propriétaire, la disposition est conforme : séance, trait, « Annuler ce cours » en danger, « Enregistrer » seule action primaire. **Provenance** : jouée sur l'arbre de travail de la branche, **avant la fusion du code** — PR #68 n'avait fusionné que la documentation, ce que personne n'a vu avant de relire `origin/main`. **Non consignés** : A9, A11–A12, le badge « Coach ». **Verdict du décor : `test:db:fresh` vert (465)** — les trois fichiers rouges de `test:db` (cinq séances là où le seed en a une, une série coachée par Marc), c'était bien le décor. **Et les gestes 7 et 8 : NOK.** La confirmation apparaît, la confirmer rend « Une erreur est survenue ». **Ce n'est pas le décor, c'est un défaut en base, reproduit en SQL sous l'identité du coach puis du propriétaire** : `update … set deleted_at` refusé par la policy de lecture — piège 13 de `database.md`. Sa sœur `class_schedules_select` avait le même trou depuis P1-002. Corrigés le soir même, **à rejouer sur `main`** |
| **9 sept. 2026** | iPhone + back-office sur le PC, `lea@example.com` (membre) et un compte d'administration | **P1-015, § 5 septies. L'essentiel passe** : le pré-remplissage trouve sa source, la publication annonce qu'elle ne notifie personne, l'état passe bien à « Publiée — visible des membres », et la séance se lit sur la fiche de cours. **Deux défauts, tous deux invisibles en test** → `D-021`. **Le premier a empêché de jouer le décor** : `sarah@example.com`, COACH, est refusée par `layout.tsx:56` — `P1-015` a ouvert le droit du coach à **trois niveaux sur quatre** et pas à la porte, inchangée depuis `P1-001a`. La passe a donc été jouée en administration, et le critère du droit coach **repasse en `[ ]`** : le cocher aurait été un faux vert. **Le second n'est pas un défaut de code** : le formulaire de la séance est logé **sous** le panneau d'annulation, donc le geste quotidien traverse « Motif » et un « Annuler ce cours » primaire — trouvé en jouant, pas en lisant. **Une valeur littérale fausse corrigée dans cette page** : le décor disait `/box/rueil/…`, le slug du seed est `crossfit-rueil`. **Verdict du décor : `test:db:fresh` non consigné** — à rejouer et à écrire ici, la passe n'a pas eu lieu en entier sans lui |
| **8 sept. 2026** | iPhone, `lea@example.com` + `sarah@example.com` | **La passe groupée, blocs A à D. Les quatre passent, aucun défaut trouvé** — et c'est la première passe qui ferme **six critères sur quatre tickets** : les trois gestes de `D-011` (compte précédent atteint par session expirée, fuseau Tokyo, contenu du cache), l'accueil de `D-016`, l'arrière-plan de `P1-005a`, le balayage de `D-009` — son dernier, ouvert depuis le 3 sept. **Un soupçon levé, consigné comme résultat** : le centre de contrôle ne fait **pas** clignoter la pastille, donc le correctif candidat de `P1-005a` reste non appliqué sur une mesure et non sur une hypothèse. **Verdict du décor : `test:db:fresh` vert (437)** — c'était bien le décor. `jwt_expiry` remis à 900, et vérifié dans le conteneur (`GOTRUE_JWT_EXP=900`) : le fichier ne ment pas sur ce qui tourne |
| **3 sept. 2026** | iPhone 12 Pro Max, Expo Go, SDK 57 | Les cinq vérifications passent. **Quatre défauts trouvés**, aucun visible en test : la langue (D-004), le parcours d'invitation cassé de bout en bout (corrigé), le sélecteur de box sans retour (P1-009), les retours de navigation vers des écrans interdits (D-009) |
| **4 sept. 2026** | idem | Tout passe, contrôle négatif compris : `/welcome` sans jeton est graphite, `/invitation/<jeton>` est orange et nomme la box, `nouveau@example.com` atterrit membre de CrossFit Rueil. Thème sombre et texte à 200 % tiennent ; la reconnexion après déconnexion est propre |
| **4 sept. 2026**, après PR #27 | idem, `lea@example.com` | Le hors ligne repasse : mode avion sur un jour jamais visité, message final immédiat et identique à chaque essai, bandeau qui parle du jour affiché. **Ferme P1-002b.** Trois gestes n'y étaient pas et sont partis en `D-011` : le fuseau du téléphone, la relecture du contenu du cache, ce qui reste du compte précédent |
| **6 sept. 2026** | idem, `lea@example.com` + `julie@example.com` | **P1-012, scénarios A à H.** Le parcours nominal passe dans les deux sens, badge et compteur de places ensemble ; le feuilletage de mois ne perd rien ; hors ligne avec cache neuf tient ; VoiceOver annonce « Réservé ». **Un défaut : toute la page clignote au retour** (scénario C) → `D-018`. **Un geste impossible** : changer de box sans se déconnecter, faute de `P1-009` — le critère « deux boxes » reste `[~]`, le valider par la déconnexion aurait été un faux vert. Passe web validée le même jour |
| **6 sept. 2026**, soir | **harnais web, deux clients** (pas d'iPhone) | **P1-005a, temps réel.** Dix critères sur onze au vert. Une réservation faite ailleurs bouge le compteur en moins de 2 s ; le repli à 30 s relit en 25 s canal coupé, et s'arrête quand le canal revient (zéro lecture en 38 s) ; 20 transitions d'écran laissent `realtime.subscription` à son niveau de départ. **L'isolation est prouvée là où pgTAP ne peut pas** : une sonde sans filtre de box, avec le jeton de Léa, ne reçoit qu'un des deux événements déclenchés — celui de sa box. **Un défaut trouvé, invisible en test unitaire** : deux écrans demandaient le même nom de canal, et `channel()` rend l'existant → écran blanc. Corrigé. **Un critère reste `[ ]` : l'arrière-plan**, qu'un onglet caché ne sait pas exercer — prochaine passe iPhone |
| **5 sept. 2026** | idem, `lea@example.com`, seed neuf | **P1-003b, gestes 1 à 11 : tout passe, VoiceOver compris.** Trois annonces distinctes nommant cours et heure ; la confirmation s'annonce seule — `announceForAccessibility()` fait son travail là où `accessibilityLiveRegion`, Android seul, aurait laissé un vert trompeur. Quatre refus avec les nombres des réglages. Hors ligne : aucune action proposée. **Aucun défaut trouvé — une première.** Deux critères restent ouverts et non par oubli : le p95 (impossible à mesurer honnêtement en Wi-Fi local, et borné à 3 réservations sans P1-004) et le schéma `rack://`, qu'Expo Go ne peut pas exercer |

## 6. Ce qu'on note, et ce qu'on ne commite pas

En cas d'écran rouge : la première ligne du message, et les dernières lignes du
terminal Metro. Rien d'autre — surtout pas une capture où figure une clé.

Puis, avant de commiter quoi que ce soit :

```bash
git status -s
```

`expo start` réécrit parfois `apps/mobile/tsconfig.json` et `app.json`. Ces
modifications ne font pas partie de la passe : les relire avant de les garder.
`.env.local` est ignoré par git — vérifié — et doit le rester.
