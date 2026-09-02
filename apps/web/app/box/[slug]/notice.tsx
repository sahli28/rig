'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@rig/ui/i18n';
import type { TranslationKey } from '@rig/core';
import { browserClient } from '../../../lib/supabase/client';
import styles from './notice.module.css';

type Kind = 'unknown_box' | 'staff_only' | 'not_configured' | 'coming_soon' | 'invalid_invitation';

const TEXTS: Record<Kind, { title: TranslationKey; body: TranslationKey }> = {
  unknown_box: { title: 'shell.unknown_box_title', body: 'shell.unknown_box_body' },
  staff_only: { title: 'shell.staff_only_title', body: 'shell.staff_only_body' },
  not_configured: { title: 'shell.not_configured_title', body: 'shell.not_configured_body' },
  coming_soon: { title: 'shell.coming_soon_title', body: 'shell.coming_soon_body' },
  // Inconnue, expirée, révoquée, consommée, ou box fermée : un seul message
  // pour les cinq, comme « box inconnue ou accès refusé ».
  invalid_invitation: { title: 'invitation.invalid_title', body: 'invitation.invalid_body' },
};

/**
 * Les états où il n'y a rien à afficher — et où il faut dire quoi faire.
 *
 * « Box inconnue » et « accès refusé » partagent volontairement le même
 * message : la résolution du slug se fait parmi ses propres appartenances, donc
 * les deux cas sont indiscernables, et le message ne doit pas prétendre le
 * contraire. Confirmer l'existence d'une box à qui n'y a pas accès serait déjà
 * une divulgation.
 */
export function Notice({ kind }: { kind: Kind }) {
  const { t } = useI18n();
  const router = useRouter();
  const { title, body } = TEXTS[kind];

  async function seDeconnecter() {
    await browserClient().auth.signOut();
    router.refresh();
    router.push('/login');
  }

  return (
    <div className={styles.notice}>
      <h1 className={styles.title}>{t(title)}</h1>
      <p className={styles.body}>{t(body)}</p>
      {kind === 'coming_soon' ? null : (
        <Link className={styles.link} href="/">
          {t('shell.back_home')}
        </Link>
      )}

      {/* Sortie de secours d'un cul-de-sac réel : la coquille — donc le menu de
          compte, donc la déconnexion — ne se rend que pour un OWNER ou un
          MANAGER. Un COACH ou un MEMBER connecté sur le web n'avait donc aucun
          moyen de se déconnecter. Invisible tant que le web n'ouvrait de session
          qu'au staff ; la page d'invitation en ouvre désormais à tous les rôles. */}
      {kind === 'staff_only' ? (
        <button type="button" className={styles.link} onClick={() => void seDeconnecter()}>
          {t('shell.sign_out')}
        </button>
      ) : null}
    </div>
  );
}
