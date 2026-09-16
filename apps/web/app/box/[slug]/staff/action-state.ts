import type { TranslationKey } from '@rack/core';

/**
 * Ce qu'une action de l'écran Staff rend à son formulaire.
 *
 * `issued` porte le jeton **en clair** — le seul moment de son existence
 * (D-005). Il traverse ce type et rien d'autre : il n'est ni journalisé, ni
 * relu, ni stocké.
 *
 * Module distinct d'`actions.ts` : un fichier `'use server'` ne peut exporter
 * que des fonctions asynchrones.
 */
export type ActionState =
  | { status: 'idle' }
  | { status: 'ok' }
  | { status: 'issued'; token: string }
  /** L'attribution d'un accès (P2-018) rend son échéance, en date locale de la box. */
  | { status: 'granted'; endsOn: string }
  | { status: 'error'; key: TranslationKey };

export const IDLE: ActionState = { status: 'idle' };
