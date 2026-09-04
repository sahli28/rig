'use client';

import { useActionState } from 'react';
import { useI18n } from '@rack/ui/i18n';
import { LOCALES } from '@rack/core';
import { timeZoneOptions } from '@rack/core/supabase';
import styles from './reglages.module.css';
import { Feedback, SubmitButton } from './form-bits';
import { saveIdentity } from './actions';
import { IDLE, type ActionState } from './action-state';

type Identite = {
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  default_locale: string;
};

/**
 * Identité de la box — **propriétaire uniquement**.
 *
 * La frontière du back-office se coupe par table : `tenants` reste à l'OWNER,
 * l'opérationnel s'ouvre au MANAGER. Pour un gestionnaire, ce bloc est en
 * lecture seule **avec la phrase qui l'explique** : un champ grisé sans raison
 * ressemble à une panne.
 */
export function IdentityForm({
  slug,
  identite,
  editable,
}: {
  slug: string;
  identite: Identite;
  editable: boolean;
}) {
  const { t } = useI18n();
  const [state, action] = useActionState<ActionState, FormData>(
    saveIdentity.bind(null, slug),
    IDLE,
  );

  const fuseaux = timeZoneOptions(identite.timezone);

  if (!editable) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t('settings.identity_title')}</h2>
        <p className={styles.readonly}>{t('settings.identity_owner_only')}</p>
        <dl className={styles.grid}>
          <div className={styles.field}>
            <dt className={styles.label}>{t('settings.identity_name')}</dt>
            <dd className={styles.value}>{identite.name}</dd>
          </div>
          <div className={styles.field}>
            <dt className={styles.label}>{t('settings.identity_slug')}</dt>
            <dd className={styles.value}>{identite.slug}</dd>
          </div>
          <div className={styles.field}>
            <dt className={styles.label}>{t('settings.identity_timezone')}</dt>
            <dd className={styles.value}>{identite.timezone}</dd>
          </div>
          <div className={styles.field}>
            <dt className={styles.label}>{t('settings.identity_currency')}</dt>
            <dd className={styles.value}>{identite.currency}</dd>
          </div>
          <div className={styles.field}>
            <dt className={styles.label}>{t('settings.identity_locale')}</dt>
            <dd className={styles.value}>
              {t(identite.default_locale === 'en' ? 'settings.locale_en' : 'settings.locale_fr')}
            </dd>
          </div>
        </dl>
      </section>
    );
  }

  return (
    <form className={styles.card} action={action}>
      <h2 className={styles.cardTitle}>{t('settings.identity_title')}</h2>
      <p className={styles.help}>{t('settings.identity_help')}</p>

      <div className={styles.grid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="name">
            {t('settings.identity_name')}
          </label>
          <input
            id="name"
            name="name"
            className={styles.input}
            defaultValue={identite.name}
            maxLength={80}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="slug">
            {t('settings.identity_slug')}
          </label>
          <input
            id="slug"
            name="slug"
            className={styles.input}
            defaultValue={identite.slug}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            required
          />
          {/* Le slug est dans l'URL : le changer casse les liens déjà partagés. */}
          <span className={styles.rowMeta}>{t('settings.identity_slug_help')}</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="timezone">
            {t('settings.identity_timezone')}
          </label>
          <select
            id="timezone"
            name="timezone"
            className={styles.select}
            defaultValue={identite.timezone}
          >
            {fuseaux.map((fuseau) => (
              <option key={fuseau} value={fuseau}>
                {fuseau}
              </option>
            ))}
          </select>
          {/* Règle 9 : c'est ce fuseau qui gouverne la fenêtre d'annulation. */}
          <span className={styles.rowMeta}>{t('settings.identity_timezone_help')}</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="currency">
            {t('settings.identity_currency')}
          </label>
          <input
            id="currency"
            name="currency"
            className={styles.input}
            defaultValue={identite.currency}
            pattern="[A-Z]{3}"
            maxLength={3}
            required
          />
          <span className={styles.rowMeta}>{t('settings.identity_currency_help')}</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="default_locale">
            {t('settings.identity_locale')}
          </label>
          <select
            id="default_locale"
            name="default_locale"
            className={styles.select}
            defaultValue={identite.default_locale}
          >
            {LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {t(locale === 'fr' ? 'settings.locale_fr' : 'settings.locale_en')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.actions}>
        <SubmitButton label={t('settings.save')} />
        <Feedback state={state} />
      </div>
    </form>
  );
}
