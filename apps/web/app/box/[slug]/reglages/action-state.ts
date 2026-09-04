import type { TranslationKey } from '@rack/core';

/**
 * Ce qu'une action de l'écran Réglages rend à son formulaire : une **clé** i18n,
 * jamais un message. Le texte est décidé à l'affichage, dans la langue de la
 * personne (`.claude/rules/api.md` — le client réagit au code, pas au texte).
 *
 * Ce module existe séparément d'`actions.ts` parce qu'un fichier `'use server'`
 * **ne peut exporter que des fonctions asynchrones** : y laisser la constante
 * `IDLE` fait échouer le rendu à l'exécution, pas au typecheck.
 */
export type ActionState =
  { status: 'idle' } | { status: 'ok' } | { status: 'error'; key: TranslationKey };

export const IDLE: ActionState = { status: 'idle' };
