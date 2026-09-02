'use client';

import { useActionState } from 'react';
import { useI18n } from '@rig/ui/i18n';
import type { TranslationKey } from '@rig/core';
import styles from './reglages.module.css';
import { Feedback, SubmitButton } from './form-bits';
import { saveBookingRules } from './actions';
import { IDLE, type ActionState } from './action-state';

type Regles = {
  open_days_before: number;
  close_minutes_before: number;
  cancel_window_minutes: number;
  max_upcoming_bookings: number;
  default_visitor_capacity: number;
};

const CHAMPS: ReadonlyArray<{
  name: keyof Regles;
  labelKey: TranslationKey;
  helpKey: TranslationKey;
  min: number;
  max: number;
}> = [
  {
    name: 'open_days_before',
    labelKey: 'settings.rules_open_days',
    helpKey: 'settings.rules_open_days_help',
    min: 0,
    max: 365,
  },
  {
    name: 'close_minutes_before',
    labelKey: 'settings.rules_close_minutes',
    helpKey: 'settings.rules_close_minutes_help',
    min: 0,
    max: 10080,
  },
  {
    name: 'cancel_window_minutes',
    labelKey: 'settings.rules_cancel_window',
    helpKey: 'settings.rules_cancel_window_help',
    min: 0,
    max: 10080,
  },
  {
    name: 'max_upcoming_bookings',
    labelKey: 'settings.rules_max_upcoming',
    helpKey: 'settings.rules_max_upcoming_help',
    min: 1,
    max: 100,
  },
  {
    name: 'default_visitor_capacity',
    labelKey: 'settings.rules_visitor_capacity',
    helpKey: 'settings.rules_visitor_capacity_help',
    min: 0,
    max: 500,
  },
];

/**
 * Règles de réservation — `tenant_settings`, ouvertes au gestionnaire.
 *
 * Les bornes des champs reprennent celles du schéma Zod, qui reprend celles de
 * la contrainte `tenant_settings_windows_positive`. Trois couches qui disent la
 * même chose : le navigateur pour l'ergonomie, Zod pour le message, la base
 * pour la vérité.
 */
export function BookingRulesForm({ slug, regles }: { slug: string; regles: Regles }) {
  const { t } = useI18n();
  const [state, action] = useActionState<ActionState, FormData>(
    saveBookingRules.bind(null, slug),
    IDLE,
  );

  return (
    <form className={styles.card} action={action}>
      <h2 className={styles.cardTitle}>{t('settings.rules_title')}</h2>
      <p className={styles.help}>{t('settings.rules_help')}</p>

      <div className={styles.grid}>
        {CHAMPS.map((champ) => (
          <div key={champ.name} className={styles.field}>
            <label className={styles.label} htmlFor={champ.name}>
              {t(champ.labelKey)}
            </label>
            <input
              id={champ.name}
              name={champ.name}
              className={styles.input}
              type="number"
              inputMode="numeric"
              min={champ.min}
              max={champ.max}
              step={1}
              defaultValue={regles[champ.name]}
              required
            />
            <span className={styles.rowMeta}>{t(champ.helpKey)}</span>
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <SubmitButton label={t('settings.save')} />
        <Feedback state={state} />
      </div>
    </form>
  );
}
