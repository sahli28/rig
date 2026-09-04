'use client';

import { useI18n } from '@rack/ui/i18n';
import { LOCALES } from '@rack/core';

/**
 * Prouve le critère du ticket : l'interface bascule sans rechargement.
 * Rejoindra les réglages du compte quand ils existeront.
 */
export function LanguageSwitcher() {
  const { t, locale, setLocale } = useI18n();

  return (
    <fieldset
      style={{
        border: '1px solid var(--rack-color-border)',
        borderRadius: 'var(--rack-radius-md)',
        padding: 12,
        margin: '16px 0',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <legend style={{ fontSize: 'var(--rack-text-caption)' }}>{t('language.label')}</legend>
      {LOCALES.map((value) => (
        <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="radio"
            name="locale"
            value={value}
            checked={locale === value}
            onChange={() => setLocale(value)}
          />
          {t(value === 'fr' ? 'language.fr' : 'language.en')}
        </label>
      ))}
    </fieldset>
  );
}
