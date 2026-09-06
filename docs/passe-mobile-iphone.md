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
   pendant une passe font rougir `pnpm test:db` ensuite : ce n'est pas une
   régression, c'est le décor. Relancer `test:db:fresh` **après** la passe avant
   de croire un rouge.
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

## Journal des passes

Une passe se périme — Expo bouge, l'IP change, le trousseau se vide. Les dates
sont donc la moitié de l'information.

| Date | Appareil | Résultat |
| --- | --- | --- |
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
