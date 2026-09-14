'use client';

/**
 * Un cours **ponctuel** (P1-026) : date + heure, type, salle, coach, places —
 * pas de récurrence, pas de ligne dans la liste des séries. La série d'un
 * jour est exactement l'encombrement que ce formulaire remplace.
 */

import { useActionState, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useI18n } from '@rack/ui/i18n';
import type { Choice } from '@rack/core/supabase';
import { createOneOff } from './actions';
import { Feedback, SubmitButton } from './form-bits';
import { IDLE } from './action-state';
import styles from './planning.module.css';

export function OneOffForm({
  slug,
  classTypes,
  rooms,
  coaches,
  trigger,
}: {
  slug: string;
  classTypes: Choice[];
  rooms: Choice[];
  coaches: Choice[];
  trigger: React.ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createOneOff.bind(null, slug), IDLE);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.dialog}>
          <Dialog.Title className={styles.dialogTitle}>{t('planning.one_off_title')}</Dialog.Title>

          <p className={styles.help}>{t('planning.one_off_hint')}</p>

          <form action={formAction} className={styles.form}>
            <div className={styles.fields}>
              <label className={styles.field}>
                <span className={styles.label}>{t('planning.field_type')}</span>
                <select name="class_type_id" className={styles.select} required>
                  {classTypes.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>{t('planning.field_room')}</span>
                <select name="room_id" className={styles.select} required>
                  {rooms.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>{t('planning.field_coach')}</span>
                <select name="coach_membership_id" className={styles.select} required>
                  {coaches.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>{t('planning.field_date')}</span>
                <input type="date" name="date" className={styles.input} required />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>{t('planning.field_time')}</span>
                <input type="time" name="time" className={styles.input} required />
                <span className={styles.hint}>{t('planning.field_time_hint')}</span>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>{t('planning.field_capacity')}</span>
                <input
                  type="number"
                  name="capacity"
                  className={styles.input}
                  min={1}
                  max={999}
                  defaultValue={12}
                  required
                />
              </label>
            </div>

            <div className={styles.actions}>
              <SubmitButton label={t('planning.one_off_save')} />
              <Dialog.Close asChild>
                <button type="button" className={styles.secondary}>
                  {t('common.close')}
                </button>
              </Dialog.Close>
            </div>

            <Feedback state={state} />
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
