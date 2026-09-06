# `P1-005a` — Places restantes en temps réel, sur le téléphone

**Phase** `P1` · **Estimation** `3` j·h · **Dépend de** `P1-003` ✅, `P1-004` ✅ · **Spec** §7.4, §10 (« Réservation temps réel »)

*Découpé de `P1-005` le 6 septembre 2026. Le volet web est parti dans
`P1-005b`, **non programmé** ; `waitlist_length` est parti dans `P1-006`.*

## Objectif

Deux personnes se disputent la dernière place d'un cours. Celle qui regarde son
téléphone **voit le compteur tomber à zéro sans toucher à rien**, au lieu
d'appuyer sur « Réserver » pour apprendre qu'il était trop tard.

## Ce que ce ticket suppose et qui doit exister

| Prérequis | Où il vit | État |
| --------- | --------- | ---- |
| `classes.booked_count`, `capacity`, `status` | `supabase/migrations/20260902120000_recurrent_class_schedules.sql:170` | ✅ existe, écrit sous verrou par `book_class()` |
| `classes_select`, tenant-scopée | `20260902120000_recurrent_class_schedules.sql:417` | ✅ existe — **c'est elle que Realtime appliquera** pour décider qui reçoit quoi |
| `grant select on public.classes to authenticated` | `20260902120000_recurrent_class_schedules.sql:429` | ✅ **table entière** : `booked_count` est lisible, donc livrable dans une charge utile |
| `seatsLeft()` | `packages/core/src/supabase/planning.ts:380` | ✅ existe, employée par les deux écrans |
| `fetchDaySchedule()`, pour le repli et la reprise | `packages/core/src/supabase/planning.ts:260` | ✅ existe, déjà bornée par un délai d'expiration |
| Écrans qui affichent des places | `apps/mobile/app/(app)/planning.tsx:500`, `apps/mobile/app/(app)/index.tsx:84` | ✅ existent |
| Un point d'accroche pour le cycle de vie (avant/arrière-plan) | `apps/mobile/lib/supabase.ts:89` — l'écouteur `AppState` de l'auto-refresh d'auth | ✅ existe, et c'est le précédent à suivre |
| Détection de connectivité | `enLigne`, déjà consommé par `planning.tsx` | ✅ existe |
| Un second client pour exercer le ticket | `pnpm --filter @rack/mobile web`, et le back-office web | ✅ existent — **voir « Le plafond »** |
| **`public.classes` dans la publication `supabase_realtime`** | *aucune occurrence de `publication` dans `supabase/`* | ❌ **à créer — par ce ticket**, migration |
| **Clés i18n de l'état du canal** | `packages/core/src/i18n/locales/{fr,en}.json` | ❌ **à créer — par ce ticket** |
| Source pour `waitlist_length` | *aucune table de liste d'attente* | ❌ **`P1-006`** — sorti du périmètre, un ticket ne peut pas dépendre de celui qui le suit |

## Ce que ce ticket rend possible, et qui l'appellera

| Ce que je livre | Appelé par | Ticket |
| --------------- | ---------- | ------ |
| La publication `supabase_realtime` sur `public.classes` | l'abonnement mobile | celui-ci |
| Le module d'abonnement dans `packages/core/src/supabase/` | `planning.tsx` et `index.tsx` | celui-ci |
| Le même module, côté web | la grille du back-office | `P1-005b` — **non programmé**, et c'est assumé |

**Aucune fonction livrée sans appelant** : le module d'abonnement est branché
sur ses deux écrans dans le même ticket. C'est la règle 7, et elle est facile à
tenir ici.

## Ce que chaque contrôle établit — et ce qu'aucun n'établit

**Section à lire avant de croire un vert.** Un test pgTAP prouve la *policy*, pas
la *livraison* : il établit qu'un `select` du tenant A ne rend pas les lignes de
B. Il n'établit **pas** qu'un abonné au canal de A ne **reçoit** pas un événement
de B — c'est le service Realtime qui en décide, pas Postgres seul, et il le
décide dans un processus que nos tests ne touchent pas.

| Contrôle | Ce qu'il établit | Ce qu'il n'établit pas |
| -------- | ---------------- | ---------------------- |
| pgTAP sur `classes_select` | la policy filtre bien par tenant | que Realtime l'applique, ni qu'il l'applique **au bon moment** |
| pgTAP sur la publication | la table y est, avec les bonnes opérations | qu'un abonné reçoit quoi que ce soit |
| Vitest sur le module d'abonnement | la logique de repli, de reprise et de désabonnement | que le canal transporte un événement réel |
| **Deux clients, deux tenants, à la main** | **qu'un événement de la box A n'arrive pas chez un membre de la box B** | rien de plus — mais c'est la seule preuve d'isolation du canal |

Les trois premiers sont nécessaires et se gardent. Le quatrième est le seul qui
réponde à la question posée, et il est **manuel**. Écrit ici pour qu'un vert
pgTAP ne se lise jamais « le canal est isolé ».

## Le plafond de mesure, décidé maintenant

**Une passe, deux clients.** Ce qui ne s'observe pas dans cette passe passe `[~]`
avec son débloqueur nommé ; **pas de second tour de mesure**. C'est la leçon de
`D-018` appliquée avant plutôt qu'après — un défaut qui ne s'observe qu'avec
plusieurs clients coûte un aller-retour par hypothèse, et ce prix se décide à
l'ouverture.

**Et il ne faut pas deux téléphones.** Le back-office web ouvert sur le même
cours — ou un second onglet du harnais `pnpm --filter @rack/mobile web` — fait un
second client. Réserver depuis l'un, regarder le compteur bouger sur l'autre :
c'est exactement le scénario. Deux comptes et deux tenants pour l'isolation. Les
critères 1 et 3 ne sont donc **pas** des `[~]` faute d'appareil, ils sont à
portée du harnais.

## Périmètre

- **Une migration** qui ajoute `public.classes` à la publication
  `supabase_realtime`, en `update` seulement — ni `insert`, ni `delete` : ce
  qu'on écoute est un compteur qui bouge sur une occurrence déjà affichée.
- **Un module d'abonnement dans `packages/core/src/supabase/`**, qui rend un
  canal par jour affiché, filtré sur le tenant actif, et rend une fonction de
  désabonnement. Une seule manière de s'abonner dans l'app, pas une par écran.
- **Branchement sur `planning.tsx` et `index.tsx`** : à réception, on remplace
  `booked_count`, `capacity` et `status` de l'occurrence concernée — **rien
  d'autre**. Un événement n'est pas une relecture ; il ne doit ni reposer de
  squelette, ni remplacer la liste.
- **Repli en polling toutes les 30 s** quand le canal est indisponible ou tombé,
  et reprise du canal quand il revient. Le repli passe par `fetchDaySchedule()`,
  déjà borné.
- **Désabonnement au démontage et au passage en arrière-plan**, sur le modèle de
  l'écouteur `AppState` de `apps/mobile/lib/supabase.ts:89`.
- **Un indicateur d'état du canal** : une pastille, avec son étiquette
  d'accessibilité, et trois états — **connecté**, **reconnexion**, **hors
  ligne**.

## Hors périmètre

- **Le web.** → `P1-005b`, écrit et chiffré, **non programmé**. Au pilote, la
  valeur du temps réel est sur le téléphone du membre, là où deux personnes se
  disputent la dernière place ; le manager qui regarde sa grille peut
  rafraîchir.
- **`waitlist_length`.** → `P1-006`, qui livre la table. Un ticket ne peut pas
  dépendre de celui qui le suit.
- **Un texte de fraîcheur relatif** (« il y a 12 s »). Trois raisons, et chacune
  suffirait : il impose un re-rendu par seconde — la nervosité que `D-018` vient
  de coûter ; sur un canal temps réel, **un compteur qui monte est l'aveu que le
  canal est tombé**, donc il dit la mauvaise chose ; et il appellerait
  `Intl.RelativeTimeFormat`, interdit hors de `packages/core/src/i18n/intl.ts` et
  non prouvé sous Hermes. Ce qu'on montre n'est pas l'âge de la donnée, c'est
  **l'état du canal**. Zéro dette Hermes.
- **Le leaderboard live** (`event:{id}` de la spec §7.4). Autre canal, autre
  phase.
- **`bookings.tsx`.** Un canal branché sur `classes` ne verra jamais passer une
  annulation. → `D-016`.

## Ce que ce ticket ne referme **pas** dans `D-016`

Le temps réel tue la moitié « places restantes » de `D-016` : sur le planning et
sur l'accueil, un compteur périmé cesse d'être possible. **Le reste de la dette
survit, et ses raisons ne sont plus les places :**

- **`index.tsx`** — le badge « Réservé » et le cours mis en avant. L'accueil est
  la racine de la pile, donc monté une fois pour toute la session ; aucun
  événement sur `classes` ne dit « cette personne a réservé ».
- **`bookings.tsx`** — une annulation faite ailleurs. Elle ne touche pas
  `classes.booked_count` de manière lisible pour cet écran, et un canal branché
  sur `classes` ne la verra jamais passer.

À relire dans `D-016`, qui porte la même note en face.

## Critères d'acceptation

- [ ] Une réservation faite depuis un client met à jour le compteur d'un **autre
      client** en moins de 3 secondes — deux comptes, un cours, le harnais et le
      back-office ouverts côte à côte
- [ ] **Un membre de la box A ne reçoit aucun événement de la box B** — deux
      comptes, deux tenants. C'est le seul contrôle qui prouve l'isolation du
      canal ; le vert pgTAP ne le remplace pas (voir « Ce que chaque contrôle
      établit »)
- [ ] Couper le temps réel bascule en polling **sans erreur visible**, et la
      pastille passe à « reconnexion »
- [ ] Le canal revenu, le polling s'arrête — on ne laisse pas les deux tourner
- [ ] Aucune fuite d'abonnement après navigation entre 20 écrans : le nombre de
      canaux ouverts revient à son niveau de départ
- [ ] Passer l'app en arrière-plan puis revenir ne laisse pas de canal orphelin,
      et l'écran retrouvé affiche l'état du moment
- [ ] **Le compteur affiché ne fait jamais autorité** : la réservation reste
      refusée par la base si la place est prise. Un test pgTAP le tient déjà
      (`book_class` sous contention) ; ce critère vérifie que l'écran **ne
      court-circuite pas** ce refus au motif qu'il croyait la place libre
- [ ] Un événement reçu ne repose **pas** de squelette et ne remplace pas la
      liste : il modifie une ligne
- [ ] La pastille d'état s'annonce par ce qu'elle **veut dire**, pas par sa
      couleur — `read_page filter=interactive`, `.claude/rules/ui.md`
- [ ] Parité i18n `fr.json` / `en.json` sur les trois états du canal

## Notes

**La vérité est la transaction SQL, toujours.** Le temps réel est du confort
d'affichage — c'est écrit dans la spec §10 en face de cette fonctionnalité, et
c'est la seule ligne du ticket qui ne se négocie pas.

**Pourquoi 3 j·h et pas moins.** La migration est courte, le module est petit ;
ce qui coûte, c'est le repli, la reprise, le désabonnement sans fuite, et une
passe à deux clients. Si le plan fait ressortir plus, il faut le dire avant
d'écrire une ligne — pas au troisième tour.
