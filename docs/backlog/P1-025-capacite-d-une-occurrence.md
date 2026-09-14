# `P1-025` — Changer les places d'UNE occurrence, même déjà réservée

**Phase** `P1` · **Estimation** `0,75` j·h · **Dépend de** `P1-015` ✅ (panneau de séance) · **Spec** §7 · **Origine** usage réel du pilote, 14 septembre 2026 — **priorité 1**

## Objectif

Le staff change le nombre de places d'un cours précis — « samedi il y a un
coach en plus, on passe à 20 » — depuis le panneau de l'occurrence, y compris
quand des réservations existent déjà : **c'est le cas principal**.

## Ce que le modèle porte déjà (vérifié le 14 septembre 2026)

Le modèle est prêt ; c'est l'écran qui n'expose pas :

| Fait | Où | Conséquence |
| --- | --- | --- |
| `classes.capacity` modifiable par les admins | policy `classes_update` (admin) + `grant update (…, capacity, …, is_override, …)` — `20260902120000:431,441` | **aucune migration** |
| La règle dure existe **en base** | `classes_booked_within_capacity` : `booked_count between 0 and capacity` (`:181`) | descendre sous `booked_count` est refusé par PostgreSQL, pas par une bonne volonté d'écran |
| `is_override = true` protège du refresh | `refresh_class_schedule` (`:351`) et le refresh des séances (`20260908210000:218`) filtrent `is_override = false` | une capacité posée à la main survit aux modifs de série — **déjà câblé, il suffit de poser le drapeau** |
| Un cours réservé garde son ancienne capacité | même filtre : le refresh ne touche pas les occurrences réservées | confirmé — d'où ce ticket : rien d'autre ne peut la changer |
| Le panneau de l'occurrence | `apps/web/app/box/[slug]/planning/workout-form.tsx` | le champ « Places » s'y loge |
| Le motif « erreur de contrainte → message » | `saveIdentity` mappe le `23505` du slug (`reglages/actions.ts:102`) | même geste pour le `23514` de la capacité |

## Périmètre

- Champ « Places » dans le panneau de l'occurrence, visible `planning_admin`
  seulement (le COACH écrit la séance, il n'administre pas — frontière D-021).
- Action dédiée `saveCapacity(slug, classId, …)` : `tenantScope().update('classes', { capacity, is_override: true })`
  sur **cette** occurrence — jamais par la série.
- **Deux gardes pour un message clair** : pré-lecture de `booked_count` →
  message « N places déjà réservées » avant d'écrire ; et si la course perd
  quand même, le `23514` de `classes_booked_within_capacity` est mappé vers la
  **même** clé — jamais une erreur brute. Clé i18n neuve
  (`errors.capacity_below_booked`, FR/EN, avec `{count}` sans PluralRules).
- `revalidatePath` du planning ; la grille montre la nouvelle jauge.

## Hors périmètre

- Changer la capacité de la **série** : existe déjà (formulaire de série).
- Prévenir les inscrits d'un changement : `P1-029`.

## Critères d'acceptation

- [x] Une occurrence réservée (`booked_count > 0`) passe de 12 à 20 places
      depuis son panneau ; la grille l'affiche ; la série n'a pas bougé —
      **harnais, 14 sept. 2026** : cours à 8 réservations → 20 places,
      « Enregistré. » (`role="status"`), grille « 8 / 20 », base
      `capacity=20, is_override=t`, série intacte
- [x] Redescendre sous `booked_count` est refusé **avec le message** — prouvé
      sur une **vraie course au harnais** : l'écran affichait 5 réservations,
      la base en portait 8 (posées après le rendu), soumission de 6 → le
      plancher HTML périmé laisse passer, la garde serveur rend « Impossible
      de descendre sous le nombre de places déjà réservées » en `role="alert"`.
      Le `23514` de la contrainte rend la même clé si la course perd entre la
      pré-lecture et l'écriture
- [x] L'occurrence modifiée porte `is_override = true` — lu en base après le
      geste ; le filtre des refresh est déjà prouvé par les tests existants
- [x] Un COACH ne voit pas le champ (rendu sous `editable` seulement) et
      `contexte()` — borné `planning_admin`, D-021 — refuse son POST avant même
      la policy admin de `classes_update`, qui refuse aussi

## Notes

Pas de fonction SQL neuve : l'invariant vit déjà sur la table (là où l'état
change), et une transaction d'une seule écriture n'a pas besoin de PLpgSQL.
