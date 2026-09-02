'use client';

import { useActionState } from 'react';
import { useI18n } from '@rig/ui/i18n';
import { normalizeTime } from '@rig/core/supabase';
import type { TranslationKey } from '@rig/core';
import styles from './reglages.module.css';
import { Feedback, SubmitButton } from './form-bits';
import { addOpeningHour, removeOpeningHour } from './actions';
import { IDLE, type ActionState } from './action-state';

type Creneau = { id: string; weekday: number; opens_at: string; closes_at: string };

/** 0 = lundi … 6 = dimanche, comme la colonne `weekday`. */
const JOURS: readonly TranslationKey[] = [
  'settings.weekday_monday',
  'settings.weekday_tuesday',
  'settings.weekday_wednesday',
  'settings.weekday_thursday',
  'settings.weekday_friday',
  'settings.weekday_saturday',
  'settings.weekday_sunday',
];

/**
 * Horaires d'ouverture — `opening_hours`.
 *
 * Les heures sont celles de la box, pas celles du navigateur : elles sont
 * stockées en `time` nu et affichées telles quelles. Pas de `formatTime` ici —
 * il n'y a pas d'instant à convertir, juste une heure murale.
 *
 * Un créneau se retire, il ne se modifie pas : une modification, c'est un
 * retrait et un ajout. Deux boutons valent mieux qu'un formulaire d'édition en
 * ligne pour trois champs.
 */
export function OpeningHoursForm({ slug, creneaux }: { slug: string; creneaux: Creneau[] }) {
  const { t } = useI18n();
  const [state, action] = useActionState<ActionState, FormData>(
    addOpeningHour.bind(null, slug),
    IDLE,
  );

  const parJour = JOURS.map((_, jour) => creneaux.filter((c) => c.weekday === jour));

  return (
    <>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t('settings.hours_title')}</h2>
        <p className={styles.help}>{t('settings.hours_help')}</p>

        <ul className={styles.list}>
          {JOURS.map((jourKey, jour) => (
            <li key={jourKey} className={styles.row}>
              <span className={styles.rowMain}>{t(jourKey)}</span>

              {parJour[jour]?.length === 0 ? (
                <span className={styles.rowMeta}>{t('settings.hours_closed')}</span>
              ) : (
                parJour[jour]?.map((creneau) => (
                  <span key={creneau.id} className={styles.rowMeta}>
                    {normalizeTime(creneau.opens_at)} – {normalizeTime(creneau.closes_at)}{' '}
                    <button
                      type="button"
                      className={styles.ghost}
                      onClick={() => void removeOpeningHour(slug, creneau.id)}
                    >
                      {t('settings.hours_remove')}
                    </button>
                  </span>
                ))
              )}
            </li>
          ))}
        </ul>
      </section>

      <form className={styles.card} action={action}>
        <h2 className={styles.cardTitle}>{t('settings.hours_add_title')}</h2>

        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="weekday">
              {t('settings.hours_weekday')}
            </label>
            <select id="weekday" name="weekday" className={styles.select} defaultValue="0">
              {JOURS.map((jourKey, jour) => (
                <option key={jourKey} value={jour}>
                  {t(jourKey)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="opens_at">
              {t('settings.hours_opens')}
            </label>
            <input
              id="opens_at"
              name="opens_at"
              className={styles.input}
              type="time"
              defaultValue="09:00"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="closes_at">
              {t('settings.hours_closes')}
            </label>
            <input
              id="closes_at"
              name="closes_at"
              className={styles.input}
              type="time"
              defaultValue="12:00"
              required
            />
          </div>
        </div>

        <div className={styles.actions}>
          <SubmitButton label={t('settings.hours_add')} />
          <Feedback state={state} />
        </div>
      </form>
    </>
  );
}
