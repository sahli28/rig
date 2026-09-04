import type { TranslationKey } from '@rack/core';

/**
 * Ce qu'une action du planning rend à son formulaire : une **clé** i18n, jamais
 * un message (`.claude/rules/api.md` — le client réagit au code, pas au texte).
 *
 * Module séparé d'`actions.ts` parce qu'un fichier `'use server'` **ne peut
 * exporter que des fonctions asynchrones**. Y laisser `IDLE` passe le typecheck
 * et casse le rendu à l'exécution, sur un message qui ne nomme pas le coupable.
 */
export type ActionState =
  { status: 'idle' } | { status: 'ok' } | { status: 'error'; key: TranslationKey };

export const IDLE: ActionState = { status: 'idle' };

/**
 * L'horizon de matérialisation, en jours. **Même valeur que
 * `maintain_class_occurrences()`**, qui matérialise `current_date + 56`.
 *
 * Elle est ici parce que créer une série doit peupler la grille tout de suite :
 * attendre le job de 00h05 pour voir apparaître ce qu'on vient de saisir serait
 * illisible. Si la valeur change côté SQL, elle doit changer ici — sinon la
 * grille et le job ne montrent pas la même chose, et personne ne saura pourquoi.
 */
export const HORIZON_DAYS = 56;
