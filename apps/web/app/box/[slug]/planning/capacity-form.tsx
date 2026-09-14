'use client';

/**
 * Les places d'**une** occurrence (P1-025) — le cas d'usage est « samedi il y
 * a un coach en plus », donc un cours souvent déjà réservé.
 *
 * Le `min` HTML pose le plancher visible (`booked_count`) ; la vraie garde est
 * au serveur, deux fois (pré-lecture + contrainte de base). Envoi en variante
 * secondaire : l'action primaire du dialogue reste l'enregistrement de la
 * séance, le geste quotidien (D-021).
 */

import { useActionState } from 'react';
import { useI18n } from '@rack/ui/i18n';
import { saveCapacity } from './actions';
import { IDLE, type ActionState } from './action-state';
import { Feedback, SubmitButton } from './form-bits';
import styles from './planning.module.css';

export function CapacityForm({
  slug,
  classId,
  capacity,
  booked,
}: {
  slug: string;
  classId: string;
  capacity: number;
  booked: number;
}) {
  const { t } = useI18n();
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveCapacity.bind(null, slug, classId),
    IDLE,
  );

  return (
    <form action={formAction} className={styles.form}>
      <label className={styles.field}>
        <span className={styles.label}>{t('planning.field_capacity')}</span>
        <input
          name="capacity"
          type="number"
          className={styles.input}
          defaultValue={capacity}
          min={Math.max(1, booked)}
          max={999}
          required
        />
        <span className={styles.hint}>{t('planning.capacity_hint', { booked })}</span>
      </label>
      <div className={styles.actionsEnd}>
        <SubmitButton label={t('planning.capacity_save')} variant="secondary" />
      </div>
      <Feedback state={state} />
    </form>
  );
}
