import type { TranslationKey } from '@rig/core';

/**
 * Les quatre états du parcours d'invitation.
 *
 * Dans un module à part parce qu'un fichier `'use server'` ne peut exporter que
 * des fonctions asynchrones — une constante y passe le typecheck et casse le
 * rendu à l'exécution.
 */
export type ActionState =
  | { status: 'idle' }
  | { status: 'sent'; email: string }
  | { status: 'joined' }
  | { status: 'error'; key: TranslationKey };

export const IDLE: ActionState = { status: 'idle' };
