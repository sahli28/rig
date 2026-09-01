'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useI18n } from '@rig/ui/i18n';
import type { TranslationKey } from '@rig/core';
import { browserClient } from '../../../lib/supabase/client';
import styles from './shell.module.css';

const NAV: ReadonlyArray<{ segment: string; labelKey: TranslationKey }> = [
  { segment: '', labelKey: 'shell.nav_dashboard' },
  { segment: '/reglages', labelKey: 'shell.nav_settings' },
  { segment: '/staff', labelKey: 'shell.nav_staff' },
  { segment: '/membres', labelKey: 'shell.nav_members' },
];

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
  role: string;
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
          {NAV.map(({ segment, labelKey }) => {
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
            {t(role === 'OWNER' ? 'shell.role_owner' : 'shell.role_manager')}
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
