'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@rig/ui/i18n';
import { browserClient } from '../../lib/supabase/client';
import type { PendingInvitation } from '@rig/core/supabase';
import type { TranslationKey } from '@rig/core';
import styles from './invitations.module.css';
import { IDLE, type JoinState } from './join-state';
import { joinFromPending } from './actions';

const ROLE_KEYS: Record<string, TranslationKey> = {
  OWNER: 'invitation.role_owner',
  MANAGER: 'invitation.role_manager',
  COACH: 'invitation.role_coach',
  MEMBER: 'invitation.role_member',
};

export function PendingList({
  invitations,
  email,
}: {
  invitations: PendingInvitation[];
  email: string;
}) {
  const { t } = useI18n();
  const router = useRouter();

  async function changerDeCompte() {
    await browserClient().auth.signOut();
    router.refresh();
    router.push('/login?next=%2Finvitations&inscription=1');
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('pending.title')}</h1>

        {invitations.length === 0 ? (
          // Rien à montrer n'est pas une erreur : c'est le cas de quelqu'un qui a
          // déjà tout accepté, ou dont la box a utilisé une autre adresse. Le
          // dire, plutôt que d'afficher une page vide.
          <>
            <p className={styles.muted}>{t('pending.empty', { email })}</p>
            <button type="button" className={styles.primary} onClick={() => void changerDeCompte()}>
              {t('invitation.switch_account')}
            </button>
            <p>
              <Link className={styles.link} href="/">
                {t('shell.back_home')}
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className={styles.muted}>{t('pending.intro', { email })}</p>
            <ul className={styles.list}>
              {invitations.map((invitation) => (
                <PendingRow key={invitation.invitation_id} invitation={invitation} />
              ))}
            </ul>
            <p className={styles.rowMeta}>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => void changerDeCompte()}
              >
                {t('invitation.switch_account')}
              </button>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function PendingRow({ invitation }: { invitation: PendingInvitation }) {
  const { t } = useI18n();
  const [state, rejoindre] = useActionState<JoinState, FormData>(
    joinFromPending.bind(null, invitation.invitation_id, invitation.tenant_slug),
    IDLE,
  );

  if (state.status === 'joined') {
    return (
      <li className={styles.row}>
        <span className={styles.rowMain}>
          {t('invitation.welcome_title', { box: invitation.tenant_name })}
        </span>
        {/* Un COACH ou un MEMBER n'a rien à faire dans le back-office : la
            coquille lui répondrait « espace réservé au staff ». */}
        {invitation.role === 'OWNER' || invitation.role === 'MANAGER' ? (
          <Link className={styles.link} href={`/box/${state.slug}`}>
            {t('invitation.welcome_open_backoffice')}
          </Link>
        ) : (
          <span className={styles.rowMeta}>{t('invitation.welcome_member')}</span>
        )}
      </li>
    );
  }

  return (
    <li className={styles.row}>
      <span className={styles.rowMain}>{invitation.tenant_name}</span>
      <span className={styles.rowMeta}>
        {t(ROLE_KEYS[invitation.role] ?? 'invitation.role_member')}
      </span>

      <form action={rejoindre}>
        <button type="submit" className={styles.primary}>
          {t('pending.join')}
        </button>
      </form>

      {state.status === 'error' ? (
        <span className={styles.error} role="alert">
          {t(state.key)}
        </span>
      ) : null}
    </li>
  );
}
