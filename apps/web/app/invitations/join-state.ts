import type { TranslationKey } from '@rack/core';

/**
 * Module distinct d'`actions.ts` : un fichier `'use server'` ne peut exporter
 * que des fonctions asynchrones.
 */
export type JoinState =
  | { status: 'idle' }
  | { status: 'joined'; slug: string }
  | { status: 'error'; key: TranslationKey };

export const IDLE: JoinState = { status: 'idle' };
