'use client';

import { useI18n } from '@rack/ui/i18n';
import { POLICY_VERSION } from '@rack/core';
import styles from './politique.module.css';
import { PolicyFr } from './policy-fr';
import { PolicyEn } from './policy-en';

/**
 * L'enveloppe du document : le titre, la ligne de version, puis le corps dans
 * la langue courante. La date vient de `POLICY_VERSION` — jamais recopiée dans
 * le texte, pour qu'il n'existe qu'une seule source (le test l'impose). La
 * version brute est affichée telle quelle à côté de la date formatée : c'est
 * la valeur exacte que `consents.policy_version` enregistre, celle qu'un
 * membre peut vouloir comparer.
 */
export function PolicyScreen() {
  const { t, locale, formatDate } = useI18n();

  return (
    <main className={styles.page}>
      <article className={styles.document} lang={locale}>
        <h1 className={styles.title}>{t('privacy_policy.title')}</h1>
        <p className={styles.meta}>
          {t('privacy_policy.updated_on', { date: formatDate(POLICY_VERSION) })}
          {' · '}
          {t('privacy_policy.version', { version: POLICY_VERSION })}
        </p>
        {locale === 'en' ? <PolicyEn /> : <PolicyFr />}
      </article>
    </main>
  );
}
