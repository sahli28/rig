'use client';

import Link from 'next/link';
import { useI18n } from '@rig/ui/i18n';
import { LanguageSwitcher } from './language-switcher';

/**
 * Page client parce qu'elle consomme le contexte i18n. Acceptable sur un écran
 * de remplissage ; les pages publiques indexées (P1) devront résoudre la langue
 * côté serveur pour rester en SSR.
 */
export default function HomePage() {
  const { t } = useI18n();

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 'var(--rig-text-display)' }}>RIG</h1>
      <p style={{ color: 'var(--rig-color-text-muted)' }}>{t('home.placeholder_web')}</p>
      <LanguageSwitcher />
      <p>
        <Link href="/design-system">{t('home.design_system_cta')}</Link>
      </p>
    </main>
  );
}
