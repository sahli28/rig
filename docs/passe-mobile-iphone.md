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
