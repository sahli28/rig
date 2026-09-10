# `P1-007b` — Le push sur iOS : APNs, le build dédié, et le deep link

**Phase** `P1` · **Estimation** `1` j·h *(à recompter à l'ouverture)* · **Dépend de** `P1-007a` (l'émetteur, le token, le journal) et du **premier *development build* iOS** · **Découpé de `P1-007` le 10 septembre 2026**

## Objectif

La même notification que `P1-007a` envoie déjà, mais **reçue sur un iPhone**, et
qui — touchée — ouvre l'écran concerné plutôt que l'accueil.

## Ce qu'il ajoute, et ce qu'il n'ajoute pas

**Aucune logique neuve.** L'émetteur, l'enregistrement du jeton, le journal, les
quiet hours, les réglages par catégorie vivent dans `P1-007a` et sont
plateforme-agnostiques : l'API Expo Push route vers APNs ou FCM sans que le code
le sache. `P1-007b` n'ajoute que **le transport iOS et son épreuve sur
appareil** :

- la **clé APNs** et l'**identifiant d'app**, côté compte Apple ;
- la **configuration EAS iOS** et le **premier *development build* iOS** (Expo Go
  ne fait plus de push depuis le SDK 53) ;
- la vérification que le deep link **`rack://`** ouvre le bon écran — ce que
  seul un build dédié permet.

## Ce que ce ticket suppose et qui doit exister

*Chaque état est vérifié dans le dépôt, le 10 septembre 2026.*

| Prérequis | Où il vit | État |
| --- | --- | --- |
| L'émetteur, le token, le journal, les quiet hours | `P1-007a` | ⏳ **livrés par `P1-007a`** — ce ticket ne les refait pas |
| `devices.platform = 'ios'` | `20260830143108:75` (CHECK) | ✅ déjà admis |
| **Compte développeur Apple** | — | ✅ **actif depuis le 8 sept. 2026**, jusqu'au 8 sept. 2027, App Store Connect ouvert |
| **Clé APNs + identifiant d'app** | — | ❌ à générer sur le compte Apple |
| **`eas.json` avec les *credentials* iOS** | `P1-007a` crée le `eas.json` de base | ⚠️ à compléter pour iOS |
| **Le premier *development build* iOS** | *rien* | ❌ **l'événement** : il ferme des critères de **trois** tickets — voir ci-dessous |
| Schéma d'URL `rack://` | `apps/mobile/app.json:5` | ⚠️ déclaré, jamais exercé — Expo Go ouvre en `exp://`. Le build dédié le rend réel |

> ### Le premier *development build* iOS se prépare comme un événement
>
> Il ne ferme pas qu'un critère de ce ticket. Il ferme aussi **le reliquat
> `rack://` de `D-013`** et **le critère `[~]` resté ouvert de `P1-003b`** (le
> schéma d'URL, qu'Expo Go ne pouvait pas exercer). **Un seul build, trois
> critères de trois tickets.** Rassembler cette liste *avant* de lancer le build,
> comme la passe groupée l'a fait pour les dettes d'appareil — c'est écrit ici
> pour que le build ne soit pas subi comme un effet de bord de `P1-007b`. Ce
> build est aussi l'un des lots de `P1-016` (mise en service) : le coordonner.

## Critères d'acceptation

- [ ] **iOS** — une notification arrive en moins de 30 secondes (dev build iOS,
      APNs). *(Était `[~]` jusqu'au 8 sept. 2026 : le compte Apple étant actif,
      le build lève le blocage.)*
- [ ] Toucher la notification ouvre l'écran concerné via `rack://`, pas
      l'accueil. **Ferme du même coup** le critère `rack://` resté ouvert de
      `P1-003b` et le reliquat de `D-013`
- [ ] **appareil (iPhone)** — reçu, touché, l'écran s'ouvre ; en clair comme en
      sombre. Geste : `docs/passe-mobile-iphone.md`

## Estimation

**1 j·h** à la découpe, « à recompter à l'ouverture ». Pas de logique : de la
configuration Apple/EAS et une passe sur appareil. Le coût réel dépend du nombre
d'allers-retours du premier build iOS, qu'on ne connaît qu'en le faisant.

## Notes

`P1-006` (liste d'attente) est satisfaite pour Android dès `P1-007a` ; sa
garantie « la promotion part en moins de 30 s » **sur iOS** attend ce ticket.
C'est le seul endroit où le blocage iOS se transmet encore — à dire dans la
dépendance de `P1-006`, aujourd'hui indifférenciée.
