# `D-042` — La checklist renvoie le lien de paiement vers un assistant qui ne le contient pas

**Estimation** `0,5` j·h · **Origine** `P2-004`, session réelle du 19 septembre 2026 · **Spec** §12.5

## Symptôme

Sur le dashboard, l'item de checklist **« Un lien de paiement »** → bouton
**« Configurer »** mène à `/mise-en-route` (l'assistant en 5 étapes), où **ce
réglage n'existe pas**. L'utilisateur tourne en rond et ne peut pas poser son
lien de paiement depuis la checklist. Trouvé en session réelle par la
commanditaire.

## Cause

Deux surfaces qui ne comptent pas pareil :

- `apps/web/app/box/[slug]/dashboard-screen.tsx` envoie **tous** les items non
  cochés vers un seul `setupHref = ${base}/mise-en-route` (aucun lien par item).
- `apps/web/app/box/[slug]/mise-en-route/page.tsx` compose l'assistant avec
  **5 formulaires** : identité, horaires, lieux, cours, règles. **Le lien de
  paiement n'y est pas** — il vit dans **Réglages → onglet Paiement**
  (`PaymentLinkForm`, livré par `P2-019`).

La checklist a **6 items**, l'assistant **5 étapes**. L'item paiement — le 6e —
n'a donc **aucune destination fonctionnelle** : il retombe dans un assistant qui
ne le contient pas.

*(Note secondaire : les onglets de Réglages ne sont pas pilotables par URL —
`SettingsTabs` utilise `defaultValue={premier}`, ouvrant toujours « Identité ».
Donc pointer vers `/reglages` n'ouvrirait pas non plus l'onglet Paiement.)*

## Correctif retenu : rendre checklist (6) et assistant (6) symétriques

- **Ajouter `PaymentLinkForm` comme 6e étape de l'assistant** de mise en route
  (étape optionnelle — une box peut fonctionner sans, le règlement est hors app).
  La checklist et l'assistant couvrent alors les **mêmes 6 items**.
- **Chaque « Configurer » ouvre SON étape**, pas l'étape 1 : le lien de la
  checklist cible l'étape correspondante (`/mise-en-route?step=<id>` ou
  équivalent). Corrige au passage un défaut plus large — aujourd'hui cliquer
  « Configurer » sur n'importe quel item dépose l'utilisateur au début de
  l'assistant, pas sur le réglage qu'il visait.

*Alternative écartée :* pointer l'item paiement vers `/reglages` onglet Paiement.
Cela obligerait à rendre les onglets Radix pilotables par URL **et** casserait la
symétrie checklist ↔ assistant. Le paiement reste réglable dans les Réglages
(inchangé) ; on lui ajoute juste sa place dans la mise en route.

## Critères d'acceptation

- [x] Depuis la checklist, « Un lien de paiement » → « Configurer » mène à un
      endroit où l'on **peut réellement poser le lien** — `PaymentLinkForm`, 6e
      étape de l'assistant (`?step=paiement`). Vérifié en session le 19 sept. 2026.
- [x] Chaque item « Configurer » ouvre **sa** destination, pas l'étape 1 — les
      quatre items-étapes ciblent `?step=<id>` (wizard `initialStep`) ; les deux
      qui ne sont pas des réglages pointent vers leur écran (« au planning » →
      /planning, « premier membre » → /staff). Six hrefs vérifiés.
- [x] Poser le lien **coche l'item** — dérivation déjà en place
      (`box_dashboard.checklist.payment_link`, prouvée en pgTAP) ; l'étape rend le
      `PaymentLinkForm` de P2-019, inchangé.
- [x] L'étape paiement est **optionnelle** : « Terminer » (6/6) ne l'exige pas.
- [x] `pnpm i18n:check` vert — la 6e étape réutilise `settings.tab_payment`
      (FR « Paiement » / EN « Payment »), aucune clé nouvelle.

**Note (hors périmètre, signalée) :** la checklist reste visible à un COACH (droit
`dashboard`) alors que l'assistant exige `settings` — un coach qui clique
« Configurer » verrait le Notice `role_forbidden`. Pré-existant à P2-004, non
élargi ici ; à rouvrir si l'usage le demande. Réglages → Paiement : inchangé.
