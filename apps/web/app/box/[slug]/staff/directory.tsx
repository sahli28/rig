'use client';

import { useActionState, useMemo, useState, useTransition } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { CalendarX, Check, MoreHorizontal, UserX } from 'lucide-react';
import { useI18n } from '@rack/ui/i18n';
import {
  MEMBERSHIP_ROLES,
  MEMBERSHIP_STATUSES,
  SUBSCRIPTION_DURATIONS,
  canModifyMembership,
  displayName,
  filterDirectory,
  grantableRoles,
  type DirectoryRow,
} from '@rack/core/supabase';
import type { TranslationKey } from '@rack/core';
import ui from '../../../ui.module.css';
import styles from './staff.module.css';
import { IDLE, type ActionState } from './action-state';
import { changeRole, excludeMember, grantSubscription, revokeAccess } from './actions';

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
  accessByMembership,
}: {
  slug: string;
  rows: DirectoryRow[];
  actorRole: string;
  /** Échéance d'accès (P2-018) par appartenance — absente = pas d'accès actif. */
  accessByMembership: Record<string, string>;
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
            <MemberRow
              key={row.membership_id}
              slug={slug}
              row={row}
              actorRole={actorRole}
              accessUntil={accessByMembership[row.membership_id] ?? null}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Une ligne de l'annuaire — reprise en P2-022 sur un retour de test du
 * 18 septembre 2026 : « brouillon, trop de boutons ».
 *
 * La ligne empilait **deux concepts** et deux boutons rouges aux libellés
 * voisins (« Retirer » / « Retirer l'accès »). Elle les sépare désormais :
 *
 * - **l'accès**, geste fréquent → visible : une durée et **un seul** bouton, qui
 *   dit « Donner l'accès » ou « Prolonger » selon qu'un accès court déjà ;
 * - **le rôle**, geste rare → discret : un mot dans la ligne, et le changement
 *   dans le menu « … », appliqué à la sélection, sans bouton « Appliquer » ;
 * - **les gestes destructeurs** → derrière le même menu, chacun avec sa
 *   confirmation et un libellé qui ne peut pas être pris pour l'autre :
 *   « Retirer l'accès » ≠ « Exclure de la box ».
 *
 * Pourquoi le rôle passe par un menu et pas par un `<select>` auto-soumis : au
 * clavier, un `<select>` fermé change de valeur à chaque flèche. Traverser la
 * liste aurait nommé quelqu'un gestionnaire en passant. Dans un menu Radix, la
 * flèche déplace le focus et **Entrée** choisit (§12.4, clavier d'abord).
 */
function MemberRow({
  slug,
  row,
  actorRole,
  accessUntil,
}: {
  slug: string;
  row: DirectoryRow;
  actorRole: string;
  accessUntil: string | null;
}) {
  const { t, formatDate } = useI18n();
  const [, startTransition] = useTransition();
  const [dialogue, setDialogue] = useState<'aucun' | 'acces' | 'exclusion'>('aucun');

  const [etatRole, changer, roleEnCours] = useActionState<ActionState, FormData>(
    changeRole.bind(null, slug, row.membership_id),
    IDLE,
  );
  const [etatRetrait, retirer] = useActionState<ActionState, void>(
    excludeMember.bind(null, slug, row.membership_id),
    IDLE,
  );
  const [etatAcces, donner, accesEnCours] = useActionState<ActionState, FormData>(
    grantSubscription.bind(null, slug, row.membership_id),
    IDLE,
  );
  const [etatRetraitAcces, retirerAcces] = useActionState<ActionState, void>(
    revokeAccess.bind(null, slug, row.membership_id),
    IDLE,
  );

  // L'écran masque ce que la fonction refuse : un gestionnaire ne touche ni un
  // propriétaire ni un autre gestionnaire (`MANAGER_CANNOT_MODIFY_ADMIN`).
  const modifiable = canModifyMembership(actorRole, row.role);
  const roles = grantableRoles(actorRole);
  const actif = row.status === 'ACTIVE';
  const nom = displayName(row);

  // Le retrait d'accès (P2-026) n'existe que là où il y a un accès à retirer :
  // une porte qui ne mène nulle part est pire que pas de porte.
  const peutRetirerAcces = actif && accessUntil !== null;
  const peutExclure = modifiable && actif;
  const aUnMenu = modifiable || peutRetirerAcces;

  function choisirRole(valeur: string) {
    // Pas une porte : « a-t-on choisi autre chose que ce qui est déjà là ? ». La
    // règle traque les décisions d'autorisation écrites à la main — celle-ci
    // n'ouvre ni ne ferme rien, elle évite une écriture et une ligne d'audit
    // pour un changement nul. Qui a le droit de changer quoi reste décidé par
    // `canModifyMembership` et `grantableRoles`, plus haut.
    // eslint-disable-next-line no-restricted-syntax
    if (valeur === row.role) return;
    const donnees = new FormData();
    donnees.set('role', valeur);
    startTransition(() => changer(donnees));
  }

  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <span className={styles.rowName}>{nom}</span>
        {/* L'annuaire administratif porte l'e-mail : la box est responsable de
            traitement de ses membres (privacy.md). Ce n'est pas la vue des
            pairs, qui reste à construire en P1-003. */}
        <span className={styles.rowMeta}>{row.email}</span>
        <span className={styles.rowTags}>
          <span className={styles.badge} aria-busy={roleEnCours}>
            {t(ROLE_KEYS[row.role] ?? 'staff.role_member')}
          </span>
          {/* Le statut n'est dit que lorsqu'il sort de l'ordinaire : « Actif »
              sur chaque ligne était du bruit. Le filtre, lui, le propose toujours. */}
          {actif ? null : (
            <span className={styles.badge}>
              {t(STATUS_KEYS[row.status] ?? 'staff.status_active')}
            </span>
          )}
        </span>
      </div>

      {/* L'accès (P2-018) : ce que la garde de réservation verra. L'absence
          d'accès n'est pas une anomalie — un nouvel importé n'en a pas encore.

          Pas de garde `canModifyMembership` ici : donner un accès n'est pas
          gouverner un rôle, et la fonction SQL refuse déjà quiconque
          n'administre pas la box. Une durée, pas un tarif — le règlement se fait
          hors app. */}
      <div className={styles.access}>
        <span className={accessUntil === null ? styles.badge : styles.badgeSuccess}>
          {accessUntil === null
            ? t('staff.access_none')
            : t('staff.access_until', { date: formatDate(accessUntil) })}
        </span>

        {actif ? (
          <form action={donner} className={styles.inline}>
            <label className={styles.srOnly} htmlFor={`duration-${row.membership_id}`}>
              {t('staff.grant_duration_label')}
            </label>
            <select
              id={`duration-${row.membership_id}`}
              name="duration"
              className={styles.selectCompact}
              defaultValue="1"
            >
              {SUBSCRIPTION_DURATIONS.map((mois) => (
                <option key={mois} value={mois}>
                  {mois === 1
                    ? t('staff.duration_one_month')
                    : t('staff.duration_months', { count: mois })}
                </option>
              ))}
            </select>
            {/* Un seul bouton, et son libellé dit ce qu'il va faire **ici**. Le
                nom de la personne n'est que dans le libellé accessible : à
                l'oreille, vingt « Donner l'accès » identiques ne disent pas à qui. */}
            <button
              type="submit"
              className={styles.primary}
              disabled={accesEnCours}
              aria-busy={accesEnCours}
              aria-label={t(
                accessUntil === null ? 'staff.grant_access_a11y' : 'staff.extend_access_a11y',
                { name: nom },
              )}
            >
              {t(accessUntil === null ? 'staff.grant_access' : 'staff.extend_access')}
            </button>
          </form>
        ) : null}
      </div>

      {aUnMenu ? (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            className={styles.iconButton}
            aria-label={t('staff.more_actions', { name: nom })}
          >
            <MoreHorizontal size={20} aria-hidden="true" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={ui.menu} sideOffset={4} align="end">
              {modifiable ? (
                <>
                  <DropdownMenu.Label className={styles.menuLabel}>
                    {t('staff.change_role')}
                  </DropdownMenu.Label>
                  <DropdownMenu.RadioGroup value={row.role} onValueChange={choisirRole}>
                    {roles.map((valeur) => (
                      <DropdownMenu.RadioItem key={valeur} value={valeur} className={ui.menuItem}>
                        <span className={styles.menuCheck}>
                          <DropdownMenu.ItemIndicator>
                            <Check size={16} aria-hidden="true" />
                          </DropdownMenu.ItemIndicator>
                        </span>
                        {t(ROLE_KEYS[valeur] ?? 'staff.role_member')}
                      </DropdownMenu.RadioItem>
                    ))}
                  </DropdownMenu.RadioGroup>
                </>
              ) : null}

              {modifiable && (peutRetirerAcces || peutExclure) ? (
                <DropdownMenu.Separator className={ui.menuSeparator} />
              ) : null}

              {peutRetirerAcces ? (
                <DropdownMenu.Item
                  className={ui.menuItemDanger}
                  onSelect={() => setDialogue('acces')}
                >
                  <CalendarX size={16} aria-hidden="true" />
                  {t('staff.revoke_access')}
                </DropdownMenu.Item>
              ) : null}
              {peutExclure ? (
                <DropdownMenu.Item
                  className={ui.menuItemDanger}
                  onSelect={() => setDialogue('exclusion')}
                >
                  <UserX size={16} aria-hidden="true" />
                  {t('staff.remove')}
                </DropdownMenu.Item>
              ) : null}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ) : null}

      {/* Retirer l'**accès** (P2-026), à distinguer d'exclure la **personne** : la
          réservation se bloque immédiatement, l'appartenance reste. Réversible —
          une nouvelle attribution rouvre. */}
      <Confirmation
        ouvert={dialogue === 'acces'}
        onFermer={() => setDialogue('aucun')}
        titre={t('staff.revoke_access_title', { name: nom })}
        corps={t('staff.revoke_access_body')}
        confirmer={t('staff.revoke_access_confirm')}
        onConfirm={() => startTransition(() => retirerAcces())}
      />
      {/* L'exclusion n'est **pas** un départ volontaire : `remove_member()` pose
          `REMOVED`, et la personne ne revient plus que sur invitation nominative. */}
      <Confirmation
        ouvert={dialogue === 'exclusion'}
        onFermer={() => setDialogue('aucun')}
        titre={t('staff.remove_title', { name: nom })}
        corps={t('staff.remove_body')}
        confirmer={t('staff.remove_confirm')}
        onConfirm={() => startTransition(() => retirer())}
      />

      <div className={styles.rowFeedback}>
        <Feedback state={etatRole} />
        <Feedback state={etatRetrait} />
        <Feedback state={etatAcces} />
        <Feedback state={etatRetraitAcces} />
      </div>
    </li>
  );
}

/**
 * La confirmation d'un geste destructeur. **Pilotée** (`open`) plutôt que
 * déclenchée par un `Trigger` : elle s'ouvre depuis une entrée de menu, et un
 * `Trigger` rendu dans un menu qui se ferme disparaîtrait avec lui.
 *
 * Radix porte le comportement : focus piégé, échappement, `aria-*`. Le focus
 * arrive sur « Annuler » — le geste sûr — comme Radix le fait par défaut.
 */
function Confirmation({
  ouvert,
  onFermer,
  titre,
  corps,
  confirmer,
  onConfirm,
}: {
  ouvert: boolean;
  onFermer: () => void;
  titre: string;
  corps: string;
  confirmer: string;
  onConfirm: () => void;
}) {
  const { t } = useI18n();

  return (
    <AlertDialog.Root open={ouvert} onOpenChange={(etat) => (etat ? undefined : onFermer())}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={ui.overlay} />
        <AlertDialog.Content className={ui.dialog}>
          <AlertDialog.Title className={styles.cardTitle}>{titre}</AlertDialog.Title>
          <AlertDialog.Description className={styles.help}>{corps}</AlertDialog.Description>
          <div className={ui.dialogActions}>
            <AlertDialog.Cancel className={styles.ghost}>{t('common.cancel')}</AlertDialog.Cancel>
            <AlertDialog.Action className={styles.dangerSolid} onClick={onConfirm}>
              {confirmer}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

function Feedback({ state }: { state: ActionState }) {
  const { t, formatDate } = useI18n();

  if (state.status === 'granted') {
    return (
      <span className={styles.feedback} role="status">
        {t('staff.access_granted_until', { date: formatDate(state.endsOn) })}
      </span>
    );
  }
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
