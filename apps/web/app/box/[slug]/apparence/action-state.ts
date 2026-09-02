import type { TranslationKey } from '@rig/core';

/**
 * Module distinct d'`actions.ts` : un fichier `'use server'` ne peut exporter
 * que des fonctions asynchrones.
 */
export type ActionState =
  { status: 'idle' } | { status: 'ok' } | { status: 'error'; key: TranslationKey };

export const IDLE: ActionState = { status: 'idle' };
