'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useI18n } from '@rack/ui/i18n';
import type { TranslationKey } from '@rack/core';
import { can, type BackOfficeRight, type MembershipRole } from '@rack/core/supabase';
import { browserClient } from '../../../lib/supabase/client';
import styles from './shell.module.css';

/**
 * Chaque entrée porte le **droit** qui l'ouvre, et la coquille demande à
 * `can()` — elle ne compare aucun rôle. Ce n'est pas une garde : les policies
 * refusent déjà. C'est de l'ergonomie — ne pas proposer une porte qui se ferme,
 * ni en cacher une que la base ouvre (`D-021` : le coach avait le droit d'écrire
 * sa séance, et aucune porte pour y aller).
 */
const NAV: ReadonlyArray<{ segment: string; labelKey: TranslationKey; right: BackOfficeRight }> = [
  { segment: '', labelKey: 'shell.nav_dashboard', right: 'dashboard' },
  { segment: '/planning', labelKey: 'shell.nav_planning', right: 'planning' },
  { segment: '/reglages', labelKey: 'shell.nav_settings', right: 'settings' },
  { segment: '/apparence', labelKey: 'shell.nav_appearance', right: 'appearance' },
  { segment: '/staff', labelKey: 'shell.nav_staff', right: 'staff' },
  { segment: '/membres', labelKey: 'shell.nav_members', right: 'members' },
];

/** Le rôle, annoncé dans le menu de compte. Un MEMBER n'arrive jamais ici. */
const ROLE_LABELS: Record<MembershipRole, TranslationKey> = {
  OWNER: 'shell.role_owner',
  MANAGER: 'shell.role_manager',
  COACH: 'shell.role_coach',
  MEMBER: 'shell.role_member',
};

/**
 * Coquille du back-office : navigation, identité de la box, sortie.
 *
 * Radix ne porte aucun style — il porte le **comportement** accessible (focus
 * piégé, échappement, navigation au clavier, `aria-*`). La mise en forme vient
 * des CSS Modules, et toute couleur des variables de `themeToCssRule()`
 * (ADR 0005).
 */
export function Shell({
  slug,
  boxName,
  role,
  children,
}: {
  slug: string;
  boxName: string;
  role: MembershipRole;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  const base = `/box/${slug}`;

  async function seDeconnecter() {
    await browserClient().auth.signOut();
    // `refresh()` avant de naviguer : les Server Components ont été rendus avec
    // la session, et sans lui la coquille resterait affichée le temps d'un
    // battement.
    router.refresh();
    router.push('/login');
  }

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <span className={styles.box}>{boxName}</span>

        <nav className={styles.nav} aria-label={t('shell.nav_label')}>
          {NAV.filter((entry) => can(role, entry.right)).map(({ segment, labelKey }) => {
            const href = `${base}${segment}`;
            const actif = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={actif ? `${styles.link} ${styles.linkActive}` : styles.link}
                // L'état actif n'est pas porté par la seule couleur : il est
                // annoncé aux lecteurs d'écran (`.claude/rules/ui.md`).
                aria-current={actif ? 'page' : undefined}
              >
                {t(labelKey)}
              </Link>
            );
          })}
        </nav>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger className={styles.account}>
            {t(ROLE_LABELS[role])}
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={styles.menu} sideOffset={4} align="end">
              <DropdownMenu.Item className={styles.menuItem} onSelect={() => void seDeconnecter()}>
                {t('shell.sign_out')}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </header>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
