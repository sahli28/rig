'use client';

import { useActionState, useState } from 'react';
import { useI18n } from '@rig/ui/i18n';
import { grantableRoles, invitationPath, invitationState } from '@rig/core/supabase';
import type { TranslationKey } from '@rig/core';
import styles from './staff.module.css';
import { IDLE, type ActionState } from './action-state';
import { issueInvitation, revokeInvitation } from './actions';

type InvitationRow = {
  id: string;
  role: string;
  status: string;
  expires_at: string;
  email: string | null;
  created_at: string;
};

const ROLE_KEYS: Record<string, TranslationKey> = {
  OWNER: 'staff.role_owner',
  MANAGER: 'staff.role_manager',
  COACH: 'staff.role_coach',
  MEMBER: 'staff.role_member',
};

const STATE_KEYS: Record<string, TranslationKey> = {
  PENDING: 'staff.invitation_pending',
  EXPIRED: 'staff.invitation_expired',
  ACCEPTED: 'staff.invitation_accepted',
  REVOKED: 'staff.invitation_revoked',
};

export function Invitations({
  slug,
  invitations,
  actorRole,
}: {
  slug: string;
  invitations: InvitationRow[];
  actorRole: string;
}) {
  const { t } = useI18n();
  const [etat, emettre] = useActionState<ActionState, FormData>(
    issueInvitation.bind(null, slug),
    IDLE,
  );

  const roles = grantableRoles(actorRole);

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>{t('staff.invitations_title')}</h2>
      <p className={styles.help}>{t('staff.invitations_help')}</p>

      {invitations.length === 0 ? (
        <p className={styles.empty}>{t('staff.invitations_empty')}</p>
      ) : (
        <ul className={styles.list}>
          {invitations.map((invitation) => (
            <InvitationRowItem key={invitation.id} slug={slug} invitation={invitation} />
          ))}
        </ul>
      )}

      <form className={styles.filters} action={emettre}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="invitation-email">
            {t('staff.invitation_email')}
          </label>
          <input id="invitation-email" name="email" className={styles.input} type="email" />
          {/* Sans adresse, c'est le QR mural : réutilisable jusqu'à révocation. */}
          <span className={styles.rowMeta}>{t('staff.invitation_email_help')}</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="invitation-role">
            {t('staff.invitation_role')}
          </label>
          <select id="invitation-role" name="role" className={styles.select} defaultValue="MEMBER">
            {roles.map((valeur) => (
              <option key={valeur} value={valeur}>
                {t(ROLE_KEYS[valeur] ?? 'staff.role_member')}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <button type="submit" className={styles.primary}>
            {t('staff.invitation_create')}
          </button>
        </div>
      </form>

      {etat.status === 'issued' ? <IssuedLink token={etat.token} /> : null}
      {etat.status === 'error' ? (
        <p className={styles.error} role="alert">
          {t(etat.key)}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Le lien, montré **une seule fois**.
 *
 * La base ne garde que l'empreinte du jeton (D-005) : ce qui s'affiche ici
 * n'existe nulle part ailleurs et ne se récupère par aucun chemin. C'est le
 * motif des clés d'API — montré une fois, perdu ensuite, et « réafficher »
 * n'existe pas, seulement « régénérer », qui invalide le précédent.
 *
 * Le lien complet, pas le jeton nu : c'est ce qu'on colle dans un message, et
 * c'est ce qu'un QR encode.
 */
function IssuedLink({ token }: { token: string }) {
  const { t } = useI18n();
  const [copie, setCopie] = useState(false);

  // `window` n'existe qu'au rendu client, et ce composant n'apparaît qu'après
  // une action : l'origine est donc toujours disponible ici.
  //
  // Le chemin vient de `@rig/core`, pas d'un littéral : c'est le **même** module
  // que le mobile utilise pour relire ce lien. Recopié à la main des deux côtés,
  // il avait déjà divergé — `apps/mobile` n'avait aucune route pour cette URL,
  // et le jeton d'invitation se perdait sans que rien ne le signale.
  const lien = `${window.location.origin}${invitationPath(token)}`;

  return (
    <div className={styles.issued} role="status">
      <p className={styles.warning}>{t('staff.invitation_once')}</p>
      <code className={styles.token}>{lien}</code>
      <button
        type="button"
        className={styles.ghost}
        onClick={() => {
          void navigator.clipboard.writeText(lien).then(() => setCopie(true));
        }}
      >
        {copie ? t('staff.invitation_copied') : t('staff.invitation_copy')}
      </button>
    </div>
  );
}

function InvitationRowItem({ slug, invitation }: { slug: string; invitation: InvitationRow }) {
  const { t } = useI18n();
  const [etat, revoquer] = useActionState<ActionState, void>(
    revokeInvitation.bind(null, slug, invitation.id),
    IDLE,
  );

  // Le statut brut mentirait : la base ne bascule `PENDING` en `EXPIRED` qu'à la
  // tentative d'usage, donc une invitation périmée depuis six mois s'affiche
  // encore « en attente » si on la lit telle quelle.
  const etatReel = invitationState(invitation);

  return (
    <li className={styles.row}>
      <span className={styles.rowMain}>{invitation.email ?? t('staff.invitation_wall_qr')}</span>
      <span className={styles.rowMeta}>{t(ROLE_KEYS[invitation.role] ?? 'staff.role_member')}</span>
      <span className={styles.badge}>{t(STATE_KEYS[etatReel] ?? 'staff.invitation_pending')}</span>

      {etatReel === 'PENDING' ? (
        <button type="button" className={styles.ghost} onClick={() => void revoquer()}>
          {t('staff.invitation_revoke')}
        </button>
      ) : null}

      {etat.status === 'error' ? (
        <span className={styles.error} role="alert">
          {t(etat.key)}
        </span>
      ) : null}
    </li>
  );
}
