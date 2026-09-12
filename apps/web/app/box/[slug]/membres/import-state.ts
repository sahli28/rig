import type { TranslationKey } from '@rack/core';
import type { ImportResult } from '@rack/core/supabase';

/**
 * Module distinct d'`actions.ts` : un fichier `'use server'` ne peut exporter
 * que des fonctions asynchrones.
 */
export type ImportState =
  | { status: 'idle' }
  | { status: 'done'; result: ImportResult }
  | {
      status: 'sent';
      sent: number;
      failed: number;
      /**
       * Les adresses en échec, séparées par nature : `permanent` (invalide, à
       * corriger dans le fichier) et `temporary` (quota/réseau, à réessayer). Un
       * 429 ne doit pas ressembler à une adresse morte.
       */
      failures: { email: string; kind: 'permanent' | 'temporary' }[];
    }
  | { status: 'error'; key: TranslationKey };

export const IDLE: ImportState = { status: 'idle' };
