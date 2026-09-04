'use client';

import { useFormStatus } from 'react-dom';
import { useI18n } from '@rack/ui/i18n';
import styles from './reglages.module.css';
import type { ActionState } from './action-state';

/**
 * Le retour d'une action, en une ligne : une confirmation, ou une **clé** i18n
 * d'erreur. Le client réagit au code, jamais au texte (`.claude/rules/api.md`) ;
 * ce composant est le seul endroit qui transforme l'un en l'autre.
 */
export function Feedback({ state }: { state: ActionState }) {
  const { t } = useI18n();

  if (state.status === 'ok') {
    return (
      <span className={styles.feedback} role="status">
        {t('settings.saved')}
      </span>
    );
  }

  if (state.status === 'error') {
    return (
      <span className={styles.error} role="alert">
        {t(state.key)}
      </span>
    );
  }

  return null;
}

/** Bouton d'envoi. `useFormStatus` évite d'entretenir un état « en cours ». */
export function SubmitButton({ label }: { label: string }) {
  const { t } = useI18n();
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={styles.primary} disabled={pending}>
      {pending ? t('common.loading') : label}
    </button>
  );
}
