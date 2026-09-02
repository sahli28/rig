'use client';

import { useActionState, useMemo, useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useI18n } from '@rig/ui/i18n';
import {
  MEMBERSHIP_ROLES,
  MEMBERSHIP_STATUSES,
  displayName,
  filterDirectory,
  grantableRoles,
  type DirectoryRow,
} from '@rig/core/supabase';
import type { TranslationKey } from '@rig/core';
import styles from './staff.module.css';
import { IDLE, type ActionState } from './action-state';
import { changeRole, excludeMember } from './actions';

const ROLE_KEYS: Record<string, TranslationKey> = {
  OWNER: 'staff.role_owner',
  MANAGER: 'staff.role_manager',
  COACH: 'staff.role_coach',
  MEMBER: 'staff.role_member',
};

const STATUS_KEYS: Record<string, TranslationKey> = {
  ACTIVE: 'staff.status_active',
  SUSPENDED: 'staff.status_suspended',
  LEFT: 'staff.status_left',
  REMOVED: 'staff.status_removed',
};

/**
 * L'annuaire administratif de la box.
 *
 * Recherche et filtres en mémoire (`filterDirectory`) : une box a des centaines
 * de membres, et un aller-retour par frappe coûterait plus qu'il ne rapporte.
 */
export function Directory({
  slug,
  rows,
  actorRole,
}: {
  slug: string;
  rows: DirectoryRow[];
  actorRole: string;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');

  const visibles = useMemo(
    () => filterDirectory(rows, { q, role, status }),
    [rows, q, role, status],
  );

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>{t('staff.directory_title')}</h2>
      <p className={styles.help}>{t('staff.directory_help')}</p>

      <div className={styles.filters}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="staff-search">
            {t('staff.search')}
          </label>
          <input
            id="staff-search"
            className={styles.input}
            type="search"
            value={q}
            placeholder={t('staff.search_placeholder')}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="staff-role">
            {t('staff.filter_role')}
          </label>
          <select
            id="staff-role"
            className={styles.select}
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="">{t('staff.filter_all')}</option>
            {MEMBERSHIP_ROLES.map((valeur) => (
              <option key={valeur} value={valeur}>
                {t(ROLE_KEYS[valeur] ?? 'staff.role_member')}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="staff-status">
            {t('staff.filter_status')}
          </label>
          <select
            id="staff-status"
            className={styles.select}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">{t('staff.filter_all')}</option>
            {MEMBERSHIP_STATUSES.map((valeur) => (
              <option key={valeur} value={valeur}>
                {t(STATUS_KEYS[valeur] ?? 'staff.status_active')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className={styles.empty}>{t('staff.directory_empty')}</p>
      ) : (
        <ul className={styles.list}>
          {visibles.map((row) => (
            <MemberRow key={row.membership_id} slug={slug} row={row} actorRole={actorRole} />
          ))}
        </ul>
      )}
    </section>
  );
}

function MemberRow({
  slug,
  row,
  actorRole,
}: {
  slug: string;
  row: DirectoryRow;
  actorRole: string;
}) {
  const { t } = useI18n();

  const [etatRole, changer] = useActionState<ActionState, FormData>(
    changeRole.bind(null, slug, row.membership_id),
    IDLE,
  );
  const [etatRetrait, retirer] = useActionState<ActionState, void>(
    excludeMember.bind(null, slug, row.membership_id),
    IDLE,
  );

  // L'écran masque ce que la fonction refuse : un gestionnaire ne touche ni un
  // propriétaire ni un autre gestionnaire (`MANAGER_CANNOT_MODIFY_ADMIN`).
  const modifiable = actorRole === 'OWNER' || (row.role !== 'OWNER' && row.role !== 'MANAGER');
  const roles = grantableRoles(actorRole);

  return (
    <li className={styles.row}>
      <span className={styles.rowMain}>
        {displayName(row)}
        {/* L'annuaire administratif porte l'e-mail : la box est responsable de
            traitement de ses membres (privacy.md). Ce n'est pas la vue des
            pairs, qui reste à construire en P1-003. */}
        <span className={styles.rowMeta}> · {row.email}</span>
      </span>

      <span className={styles.badge}>{t(STATUS_KEYS[row.status] ?? 'staff.status_active')}</span>

      {modifiable ? (
        <form action={changer} className={styles.inline}>
          <label className={styles.srOnly} htmlFor={`role-${row.membership_id}`}>
            {t('staff.change_role')}
          </label>
          {/* `key` sur le rôle : le `select` n'est pas contrôlé, donc React
              garderait la valeur affichée par le navigateur après un changement
              réussi — l'écran montrerait « Membre » sur quelqu'un devenu coach.
              Remonter le composant quand la donnée serveur change règle ça sans
              en faire un champ contrôlé. */}
          <select
            key={row.role}
            id={`role-${row.membership_id}`}
            name="role"
            className={styles.select}
            defaultValue={row.role}
          >
            {roles.map((valeur) => (
              <option key={valeur} value={valeur}>
                {t(ROLE_KEYS[valeur] ?? 'staff.role_member')}
              </option>
            ))}
          </select>
          <button type="submit" className={styles.ghost}>
            {t('staff.apply')}
          </button>
        </form>
      ) : (
        <span className={styles.rowMeta}>{t(ROLE_KEYS[row.role] ?? 'staff.role_member')}</span>
      )}

      {modifiable && row.status === 'ACTIVE' ? (
        <RemoveButton nom={displayName(row)} onConfirm={() => void retirer()} />
      ) : null}

      <Feedback state={etatRole} />
      <Feedback state={etatRetrait} />
    </li>
  );
}

/**
 * Le retrait passe par une confirmation, et pas seulement pour la forme :
 * `remove_member()` pose `REMOVED`, qui n'est **pas** un départ volontaire — la
 * personne ne revient plus que sur invitation nominative.
 *
 * Radix porte le comportement : focus piégé, échappement, `aria-*`.
 */
function RemoveButton({ nom, onConfirm }: { nom: string; onConfirm: () => void }) {
  const { t } = useI18n();

  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger className={styles.danger}>{t('staff.remove')}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={styles.overlay} />
        <AlertDialog.Content className={styles.dialog}>
          <AlertDialog.Title className={styles.cardTitle}>
            {t('staff.remove_title', { name: nom })}
          </AlertDialog.Title>
          <AlertDialog.Description className={styles.help}>
            {t('staff.remove_body')}
          </AlertDialog.Description>
          <div className={styles.dialogActions}>
            <AlertDialog.Cancel className={styles.ghost}>{t('common.cancel')}</AlertDialog.Cancel>
            <AlertDialog.Action className={styles.danger} onClick={onConfirm}>
              {t('staff.remove_confirm')}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

function Feedback({ state }: { state: ActionState }) {
  const { t } = useI18n();

  if (state.status === 'ok') {
    return (
      <span className={styles.feedback} role="status">
        {t('settings.saved')}
      </span>
    );
  }
  if (state.status === 'error') {
    return (
      <span className={styles.error} role="alert">
        {t(state.key)}
      </span>
    );
  }
  return null;
}
