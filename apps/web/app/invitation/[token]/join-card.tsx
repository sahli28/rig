'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@rack/ui/i18n';
import { browserClient } from '../../../lib/supabase/client';
import type { InvitationPreview } from '@rack/core/supabase';
import type { TranslationKey } from '@rack/core';
import styles from './invitation.module.css';
import { IDLE, type ActionState } from './action-state';
import { joinBox, sendInvitationLink } from './actions';

const ROLE_KEYS: Record<string, TranslationKey> = {
  OWNER: 'invitation.role_owner',
  MANAGER: 'invitation.role_manager',
  COACH: 'invitation.role_coach',
  MEMBER: 'invitation.role_member',
};

/**
 * Trois états, un seul écran.
 *
 * Sans session : l'adresse et le lien magique. Avec session : le bouton qui
 * consomme l'invitation. Après : le mot de bienvenue et où aller ensuite.
 */
export function JoinCard({
  token,
  preview,
  session,
}: {
  token: string;
  preview: InvitationPreview;
  /** Nulle sans session ; `matches` dit si l'invitation vaut pour cette adresse. */
  session: { email: string; matches: boolean } | null;
}) {
  const { t } = useI18n();
  const router = useRouter();

  async function changerDeCompte() {
    await browserClient().auth.signOut();
    router.refresh();
  }

  const [etatLien, envoyerLien] = useActionState<ActionState, FormData>(
    sendInvitationLink.bind(null, token),
    IDLE,
  );
  const [etatAdhesion, rejoindre] = useActionState<ActionState, FormData>(
    joinBox.bind(null, token),
    IDLE,
  );

  const staff = preview.role === 'OWNER' || preview.role === 'MANAGER';
  const signedIn = session !== null;

  if (etatAdhesion.status === 'joined') {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>{t('invitation.welcome_title', { box: preview.name })}</h1>
          <p className={styles.muted}>
            {t(staff ? 'invitation.welcome_staff' : 'invitation.welcome_member')}
          </p>
          {staff ? (
            <Link className={styles.primaryLink} href={`/box/${preview.slug}`}>
              {t('invitation.welcome_open_backoffice')}
            </Link>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('invitation.title', { box: preview.name })}</h1>
        <p className={styles.muted}>
          {t('invitation.intro', { role: t(ROLE_KEYS[preview.role] ?? 'invitation.role_member') })}
        </p>

        <Feedback state={signedIn ? etatAdhesion : etatLien} />

        {session !== null && !session.matches ? (
          // Connecté·e, mais pas avec l'adresse que l'invitation attend. Sans
          // cette branche, le bouton mènerait à un refus de la base et à rien
          // d'autre : ni avancer, ni revenir.
          <>
            <p className={styles.hint}>{t('invitation.other_account', { email: session.email })}</p>
            <button type="button" className={styles.primary} onClick={() => void changerDeCompte()}>
              {t('invitation.switch_account')}
            </button>
          </>
        ) : session !== null ? (
          <form action={rejoindre}>
            <button type="submit" className={styles.primary}>
              {t('invitation.join', { box: preview.name })}
            </button>
          </form>
        ) : etatLien.status === 'sent' ? (
          <>
            <h2 className={styles.subtitle}>{t('login.sent_title')}</h2>
            <p className={styles.muted}>{t('login.sent_body', { email: etatLien.email })}</p>
          </>
        ) : (
          <form className={styles.form} action={envoyerLien}>
            <label className={styles.label} htmlFor="email">
              {t('auth.email_label')}
            </label>

            {/* Nominative : on affiche l'adresse **masquée**, jamais en clair.
                Assez pour que la personne reconnaisse la sienne, pas assez pour
                qu'un curieux la découvre. Et l'adresse saisie est vérifiée
                avant l'envoi du lien, donc avant qu'un compte soit créé. */}
            {preview.nominative && preview.email_masked !== null ? (
              <p className={styles.hint}>
                {t('invitation.nominative_hint', { email: preview.email_masked })}
              </p>
            ) : null}

            <input
              id="email"
              name="email"
              className={styles.input}
              type="email"
              autoComplete="email"
              required
              placeholder={t('auth.email_placeholder')}
            />

            <button type="submit" className={styles.primary}>
              {t('login.submit')}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function Feedback({ state }: { state: ActionState }) {
  const { t } = useI18n();
  if (state.status !== 'error') return null;

  return (
    <p className={styles.error} role="alert">
      {t(state.key)}
    </p>
  );
}
