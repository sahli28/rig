'use client';

import { useActionState, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useI18n } from '@rack/ui/i18n';
import { RRULE_DAYS, parseWeeklyRrule } from '@rack/core/supabase';
import { archiveSchedule, createSchedule, updateSchedule } from './actions';
import { Feedback, SubmitButton } from './form-bits';
import { IDLE } from './action-state';
import styles from './planning.module.css';
import { DAY_LABELS, type Choice, type Serie } from '@rack/core/supabase';

/**
 * Créer ou modifier une série.
 *
 * Le formulaire n'écrit **jamais** la chaîne RRULE : il envoie des jours, un
 * intervalle et une fin, et `buildWeeklyRrule()` la compose côté serveur, sous
 * sa forme canonique. Laisser une chaîne libre traverser le formulaire serait
 * rouvrir toute la grammaire que la base refuse.
 */
export function SeriesForm({
  slug,
  serie,
  classTypes,
  rooms,
  coaches,
  trigger,
}: {
  slug: string;
  serie?: Serie;
  classTypes: Choice[];
  rooms: Choice[];
  coaches: Choice[];
  trigger: React.ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const action =
    serie === undefined
      ? createSchedule.bind(null, slug)
      : updateSchedule.bind(null, slug, serie.id);
  const [state, formAction] = useActionState(action, IDLE);

  const recurrence = serie === undefined ? null : parseWeeklyRrule(serie.rrule);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.dialog}>
          <Dialog.Title className={styles.dialogTitle}>
            {t(serie === undefined ? 'planning.new_series' : 'planning.edit_series')}
          </Dialog.Title>

          <form action={formAction} className={styles.form}>
            <div className={styles.fields}>
              <label className={styles.field}>
                <span className={styles.label}>{t('planning.field_type')}</span>
                <select
                  name="class_type_id"
                  className={styles.select}
                  defaultValue={serie?.class_type_id ?? ''}
                  required
                >
                  {classTypes.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>{t('planning.field_room')}</span>
                <select
                  name="room_id"
                  className={styles.select}
                  defaultValue={serie?.room_id ?? ''}
                  required
                >
                  {rooms.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>{t('planning.field_coach')}</span>
                <select
                  name="coach_membership_id"
                  className={styles.select}
                  defaultValue={serie?.coach_membership_id ?? ''}
                  required
                >
                  {coaches.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>{t('planning.field_start_date')}</span>
                <input
                  type="date"
                  name="starts_on"
                  className={styles.input}
                  defaultValue={serie?.starts_on ?? ''}
                  required
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>{t('planning.field_time')}</span>
                <input
                  type="time"
                  name="starts_at_local"
                  className={styles.input}
                  defaultValue={serie?.starts_at_local.slice(0, 5) ?? ''}
                  required
                />
                <span className={styles.hint}>{t('planning.field_time_hint')}</span>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>{t('planning.field_capacity')}</span>
                <input
                  type="number"
                  name="capacity"
                  className={styles.input}
                  min={1}
                  max={500}
                  defaultValue={serie?.capacity ?? 16}
                  required
                />
              </label>
            </div>

            {/*
              Un `fieldset` et non une pile de cases : les sept jours forment un
              seul champ, et un lecteur d'écran doit annoncer la légende avant
              chaque case (`.claude/rules/ui.md`).
            */}
            <fieldset className={styles.field}>
              <legend className={styles.label}>{t('planning.field_days')}</legend>
              <div className={styles.days}>
                {RRULE_DAYS.map((day) => (
                  <label key={day} className={styles.day}>
                    <input
                      type="checkbox"
                      name="days"
                      value={day}
                      defaultChecked={recurrence?.days.includes(day) ?? false}
                    />
                    {t(DAY_LABELS[day])}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className={styles.fields}>
              <label className={styles.field}>
                <span className={styles.label}>{t('planning.field_interval')}</span>
                <select
                  name="interval"
                  className={styles.select}
                  defaultValue={String(recurrence?.interval ?? 1)}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {t('planning.interval_weeks', { n })}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>{t('planning.field_until')}</span>
                <input
                  type="date"
                  name="until"
                  className={styles.input}
                  defaultValue={recurrence?.until ?? ''}
                />
                <span className={styles.hint}>{t('planning.field_until_hint')}</span>
              </label>
            </div>

            <div className={styles.actions}>
              <SubmitButton label={t('planning.save')} />
              <Dialog.Close asChild>
                <button type="button" className={styles.secondary}>
                  {t('common.cancel')}
                </button>
              </Dialog.Close>
              <Feedback state={state} />
            </div>
          </form>

          {serie !== undefined && (
            <div className={styles.form}>
              <p className={styles.hint}>{t('planning.archive_series_hint')}</p>
              <button
                type="button"
                className={styles.danger}
                onClick={() => void archiveSchedule(slug, serie.id)}
              >
                {t('planning.archive_series')}
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
