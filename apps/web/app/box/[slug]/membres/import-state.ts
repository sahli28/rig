import type { TranslationKey } from '@rack/core';
import type { ImportResult } from '@rack/core/supabase';

/**
 * Module distinct d'`actions.ts` : un fichier `'use server'` ne peut exporter
 * que des fonctions asynchrones.
 */
export type ImportState =
  | { status: 'idle' }
  | { status: 'done'; result: ImportResult }
  | { status: 'error'; key: TranslationKey };

export const IDLE: ImportState = { status: 'idle' };
