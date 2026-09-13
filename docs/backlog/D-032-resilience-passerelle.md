# `D-032` — Un timeout de l'hébergé ne rend plus un 500 nu

**Phase** `dette` · **Estimation** `0,75` j·h · **Dépend de** `P1-017` ✅ · **Spec** §12 (états d'erreur) · **Origine** mise en service du 13 septembre 2026 : `Gateway Timeout` **intermittents** sur `rack-web-eight` (logs Runtime Vercel, digests 1311484239 / 3470477515)

## Objectif

Quand Supabase hébergé (plan gratuit) ne répond pas à temps, la personne voit
« le serveur n'a pas répondu, réessaie » — avec un bouton pour le faire, et sa
saisie préservée dans les formulaires — au lieu d'un 500 nu, page blanche.

## Le défaut, tel qu'il s'est produit

`POST /box/…/reglages` et `POST /box/…/planning` → 500, `[Error:
{"message":"Gateway Timeout"}]`. **Intermittent** : les mêmes pages rendent
200 juste avant et juste après — pas un bug logique d'écran, la fonction
serveur n'atteint pas Supabase dans le délai. Chaîne vérifiée dans le dépôt :
les wrappers de `packages/core` **lèvent** quand PostgREST rend une erreur
(choix bon et conservé), et ni les pages ni le `contexte()` des actions
n'attrapaient — l'exception remontait en 500 de Next.

## Ce qui est fait, à trois étages

1. **Transport** (`packages/core/src/supabase/resilient-fetch.ts`, testé 6/6,
   branché dans `serverClient()`) : délai de 5 s par requête, **rejeu borné aux
   lectures `GET`/`HEAD`** sur 502/503/504/522/524 et sur échec réseau, et
   journal des requêtes lentes (> 2 s) et des échecs — **le chemin seul, jamais
   la query string**, qui porte des adresses (`privacy.md`). Les POST ne sont
   **jamais** rejoués : un 504 de passerelle dit « pas de réponse à temps »,
   pas « pas exécuté » — rejouer une écriture peut la doubler, et les RPC
   (lectures comprises, `me()`) passent en POST sans que le transport sache
   les distinguer.
2. **Frontières d'erreur** : `app/box/[slug]/error.tsx` (la coquille reste,
   bouton « Réessayer » → `reset()`) et `app/error.tsx` (tout le reste — dont
   le layout `[slug]`, que la frontière du même segment ne peut pas voir, et
   l'accueil). Clés `shell.unavailable_*` + `shell.retry`, FR/EN.
3. **Actions** : le `contexte()` des **cinq** fichiers d'actions du
   back-office (planning, réglages, staff, apparence, membres — règle des
   sœurs : le rapport n'en nommait que deux) rend un état
   `{ status: 'error', key: 'errors.unknown' }` (« Une erreur est survenue.
   Réessaie dans un instant. ») au lieu de laisser `fetchMe()` lever. Le
   formulaire affiche le message en place, la saisie survit.

Et **une requête de moins** sur la page la plus chargée : les deux semaines du
planning se lisaient en deux appels `classes` parallèles — une seule fenêtre
de quinze jours désormais, coupée en mémoire.

## Le plan gratuit est-il le facteur limitant ? — la donnée à collecter

C'est l'hypothèse la plus probable (cold start / ressources partagées du plan
gratuit ; l'intermittence sur des pages sans point commun l'appuie), mais elle
n'était **pas mesurable** le 13 septembre : rien ne journalisait les durées.
C'est fait — le journal du transport dit désormais, dans les logs Vercel,
**quelle** requête dépasse et de combien. À la prochaine occurrence :

- des lenteurs **groupées au réveil** (première requête après une accalmie) →
  cold start du plan gratuit → **le passage Supabase Pro, déjà critère de
  `P1-016`, gagne sa preuve chiffrée** ;
- une **même** requête toujours lente → un index ou une vue à revoir
  (`member_admin_directory` est la candidate la plus lourde du planning) —
  ticket dédié à ce moment-là, pas avant la mesure (« pas d'optimisation sans
  problème mesuré »).

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --- | --- | --- |
| Le client serveur unique | `apps/web/lib/supabase/server.ts` | ✅ — un seul endroit à brancher |
| `I18nProvider` au-dessus des frontières d'erreur | `app/layout.tsx` → `providers.tsx` | ✅ vérifié |
| Le motif `ActionState { status, key }` | chaque `actions.ts` du back-office | ✅ — l'état d'indisponibilité s'y coule |
| `AbortSignal.timeout`/`any` | Node ≥ 20 (Vercel) ; jamais appelé sous Hermes | ✅ — aucun accès au chargement du module |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| `resilientFetch()` | `serverClient()`, chaque requête du back-office | celui-ci |
| Le journal des requêtes lentes | la prochaine session de diagnostic (logs Vercel) | l'arbitrage Pro de `P1-016` |

## Hors périmètre

- Rejouer les RPC de lecture (`me()`) : demanderait de marquer les RPC sûres
  une à une — à ouvrir si la mesure montre que `me()` est le maillon.
- Dédoublonner les `fetchMe()` layout + page (3 par navigation) via `cache()`
  de React : réel candidat d'allégement, **après mesure**.
- Le passage Supabase **Pro** : critère de `P1-016`, que la mesure ci-dessus
  vient armer.
- La consolidation des alias Vercel (`rack-web-rack8` périmé) : runbook,
  décision commanditaire.

## Critères d'acceptation

- [x] Le transport rejoue une lecture sur 504 et rend le 200 suivant ; ne
      rejoue **jamais** un POST ; coupe au délai ; journalise sans query
      string — 6 tests Vitest
- [x] Chaque `contexte()` du back-office rend un état au lieu de lever —
      les cinq fichiers, y compris les trois `fetchMe` inline de `membres`
- [x] Les frontières d'erreur rendent le message traduit et un « Réessayer »
- [x] La page planning fait une requête `classes` au lieu de deux, données
      identiques (grille et pré-remplissage inchangés en local)
- [ ] **hébergé** : à la prochaine occurrence réelle, l'écran montre le
      message au lieu du 500, et les logs Vercel nomment la requête lente —
      s'observe en usage, pas en CI

## Notes

Le rejeu au niveau transport est volontairement **timide** : la correction de
fond n'est pas « réessayer plus fort », c'est la mesure (ce journal) puis le
plan adapté à une box réelle. Un rejeu agressif masquerait précisément la
donnée qu'on cherche.
