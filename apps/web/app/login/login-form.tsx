'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useI18n } from '@rig/ui/i18n';
import { errorMessageKeyOf, type TranslationKey } from '@rig/core';
import { browserClient } from '../../lib/supabase/client';
import { supabaseConfigured } from '../../lib/supabase/config';
import styles from './login.module.css';

const EmailSchema = z.string().trim().email();

/**
 * Connexion au back-office, par **lien**.
 *
 * Le même e-mail que le mobile porte le code à six chiffres *et* le lien : le
 * mobile saisit le code parce qu'un lien y impose du deep linking, le web suit
 * le lien parce qu'il n'y a rien à installer. Deux chemins, un seul envoi.
 */
export function LoginForm({ next, erreur }: { next: string; erreur: string | null }) {
  const { t } = useI18n();

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(
    erreur === 'lien' ? 'login.error_link' : erreur === 'session' ? 'login.error_expired' : null,
  );

  async function envoyer() {
    const parsed = EmailSchema.safeParse(email);
    if (!parsed.success) {
      setErrorKey('auth.email_invalid');
      return;
    }
    if (!supabaseConfigured) {
      setErrorKey('login.error_not_configured');
      return;
    }

    setBusy(true);
    setErrorKey(null);

    const redirection = new URL('/auth/callback', window.location.origin);
    redirection.searchParams.set('next', next);

    const { error } = await browserClient().auth.signInWithOtp({
      email: parsed.data,
      options: { emailRedirectTo: redirection.toString(), shouldCreateUser: false },
    });

    setBusy(false);

    if (error) {
      setErrorKey(
        (error as { status?: number }).status === 429
          ? 'auth.too_many_requests'
          : errorMessageKeyOf(error),
      );
      return;
    }

    setEmail(parsed.data);
    setEnvoye(true);
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('login.title')}</h1>

        {errorKey === null ? null : (
          <p className={styles.error} role="alert">
            {t(errorKey)}
          </p>
        )}

        {envoye ? (
          <>
            <h2 className={styles.subtitle}>{t('login.sent_title')}</h2>
            {/* Le vérificateur PKCE est propre à ce navigateur : un lien ouvert
                ailleurs échouera, et c'est mieux de le dire avant. */}
            <p className={styles.muted}>{t('login.sent_body', { email })}</p>
            <button
              type="button"
              className={styles.ghost}
              onClick={() => {
                setEnvoye(false);
                setErrorKey(null);
              }}
            >
              {t('login.another_email')}
            </button>
          </>
        ) : (
          <>
            <p className={styles.muted}>{t('login.intro')}</p>

            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                void envoyer();
              }}
            >
              <label className={styles.label} htmlFor="email">
                {t('auth.email_label')}
              </label>
              <input
                id="email"
                className={styles.input}
                type="email"
                autoComplete="email"
                required
                value={email}
                placeholder={t('auth.email_placeholder')}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
              />
              <p className={styles.hint}>{t('login.hint')}</p>

              <button type="submit" className={styles.primary} disabled={busy}>
                {busy ? t('common.loading') : t('login.submit')}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
