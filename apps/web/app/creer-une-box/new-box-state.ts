import type { TranslationKey } from '@rack/core';

/**
 * Module distinct d'`actions.ts` : un fichier `'use server'` ne peut exporter
 * que des fonctions asynchrones. Pas d'état `success` : la création **redirige**
 * vers `/box/[slug]`, elle ne revient pas.
 */
export type NewBoxState = { status: 'idle' } | { status: 'error'; key: TranslationKey };

export const IDLE: NewBoxState = { status: 'idle' };
