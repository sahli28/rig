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

Bonus utile : passer en mode avion et rouvrir l'app. Le cache hors ligne est
P1-002b, donc la dégradation est **attendue** — noter simplement ce qu'elle
donne : un écran vide, un message clair, ou un plantage. Les trois ne se
corrigent pas de la même façon.

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
