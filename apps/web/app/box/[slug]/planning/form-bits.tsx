'use client';

import { useFormStatus } from 'react-dom';
import { useI18n } from '@rack/ui/i18n';
import styles from './planning.module.css';
import type { ActionState } from './action-state';

/**
 * Le retour d'une action, en une ligne : une confirmation, ou une **clé** i18n
 * d'erreur. Le client réagit au code, jamais au texte (`.claude/rules/api.md`).
 *
 * Jumeau de celui de l'écran Réglages, et non un import : les deux écrans ont
 * leur propre `ActionState` et leur propre feuille de style. Le jour où un
 * troisième arrive, ce sera le moment de le remonter dans `packages/ui` — pas
 * avant, sinon on partage un composant pour partager quinze lignes.
 */
export function Feedback({ state }: { state: ActionState }) {
  const { t } = useI18n();

  if (state.status === 'ok') {
    return (
      <span className={styles.feedback} role="status">
        {t(state.key ?? 'planning.saved')}
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

/**
 * Bouton d'envoi. `useFormStatus` évite d'entretenir un état « en cours ».
 *
 * `danger` pour un envoi destructeur — annuler un cours. Une seule action
 * primaire par écran (`.claude/rules/ui.md`) : dans le dialogue d'une
 * occurrence, c'est l'enregistrement de la séance, le geste quotidien, et
 * l'annulation ne doit pas lui ressembler (`D-021`).
 */
export function SubmitButton({
  label,
  variant = 'primary',
}: {
  label: string;
  variant?: 'primary' | 'danger';
}) {
  const { t } = useI18n();
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={variant === 'danger' ? styles.danger : styles.primary}
      disabled={pending}
    >
      {pending ? t('common.loading') : label}
    </button>
  );
}
