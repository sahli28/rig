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
pnpm --filter @rig/mobile exec expo start --clear
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
L'écran doit dire « Bienvenue sur RIG » et le bouton doit être **gris-bleu**. Si
les deux écrans se ressemblent, la passe ne prouve rien.

Le seed ne porte qu'une invitation Rueil et elle est à usage unique :
`pnpm db:reset` la remet à `PENDING` avant chaque essai.

## Sans téléphone : `pnpm --filter @rig/mobile web`

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
