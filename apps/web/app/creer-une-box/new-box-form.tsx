'use client';

import { useActionState } from 'react';
import { useI18n } from '@rack/ui/i18n';
import styles from './creer-une-box.module.css';
import { IDLE, type NewBoxState } from './new-box-state';
import { createBox } from './actions';

/**
 * Le formulaire de création : nom + slug, rien de plus. Le fuseau, la devise et
 * la langue prennent les défauts de la table et se règlent ensuite dans les
 * réglages (`P1-001b`). Le succès redirige vers `/box/[slug]`.
 */
export function NewBoxForm() {
  const { t } = useI18n();
  const [state, action] = useActionState<NewBoxState, FormData>(createBox, IDLE);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('box_new.title')}</h1>
        <p className={styles.muted}>{t('box_new.intro')}</p>

        {state.status === 'error' ? (
          <p className={styles.error} role="alert">
            {t(state.key)}
          </p>
        ) : null}

        <form className={styles.form} action={action}>
          <label className={styles.label} htmlFor="name">
            {t('box_new.name_label')}
          </label>
          <input id="name" name="name" className={styles.input} required maxLength={80} />

          <label className={styles.label} htmlFor="slug">
            {t('box_new.slug_label')}
          </label>
          <input
            id="slug"
            name="slug"
            className={styles.input}
            required
            maxLength={80}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <p className={styles.hint}>{t('box_new.slug_hint')}</p>

          <button type="submit" className={styles.primary}>
            {t('box_new.submit')}
          </button>
        </form>
      </div>
    </main>
  );
}
