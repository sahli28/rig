# `D-036` — Le compteur de build vit chez EAS, plus dans le dépôt

**Phase** `dette` · **Estimation** `0,25` j·h · **Dépend de** `D-031` ✅ · **Spec** — · **Origine** collision du build n°3, 14 septembre 2026 — la première soumission App Store Connect

## Objectif

Deux builds ne peuvent plus porter le même numéro : le compteur iOS vit **chez
EAS** (`appVersionSource: "remote"`), là où `autoIncrement` l'incrémente, au
lieu d'un `buildNumber` d'`app.json` qui divergeait de ce qu'Apple détenait.

## Le défaut, tel qu'il s'est payé

`appVersionSource: "local"` faisait vivre le numéro dans `app.json` : réécrit
par `autoIncrement` à chaque build, il dépendait de ce que l'arbre local avait
committé — une build depuis un état non poussé, un revert, et le fichier ne
recoupe plus ce qu'Apple a déjà accepté. **Collision sur le n°3 le jour de la
première soumission** ; la build à tester est devenue la n°4.

## Périmètre

- `eas.json` : `appVersionSource: "remote"`.
- `app.json` : le `buildNumber` **sort** — il n'y a plus de second compteur à
  désynchroniser (la valeur de vérité est chez EAS, lisible par
  `eas build:version:get`).
- Runbook `passe-mobile-iphone.md` : la section « Le compteur de build EAS est
  CHEZ EAS », avec le **geste unique commanditaire** — aligner le compteur
  distant sur le dernier build accepté par Apple (`eas build:version:set`)
  **avant** la prochaine build, sinon la collision revient par l'autre porte.

## Critères d'acceptation

- [x] `eas.json` en `remote`, plus de `buildNumber` dans `app.json`, runbook à
      jour — **fait le 14 sept. 2026**
- [ ] **geste commanditaire** : `eas build:version:set --platform ios` aligné
      sur App Store Connect, puis la build suivante s'incrémente sans
      collision — se prouve à la prochaine build
