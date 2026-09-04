'use client';

import Link from 'next/link';
import { useI18n } from '@rack/ui/i18n';
import { LanguageSwitcher } from './language-switcher';
import { PendingBanner } from './pending-banner';

/**
 * Page client parce qu'elle consomme le contexte i18n. Acceptable sur un écran
 * de remplissage ; les pages publiques indexées (P1) devront résoudre la langue
 * côté serveur pour rester en SSR.
 */
export default function HomePage() {
  const { t } = useI18n();

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 'var(--rack-text-display)' }}>Rack</h1>
      <p style={{ color: 'var(--rack-color-text-muted)' }}>{t('home.placeholder_web')}</p>
      <PendingBanner />
      <LanguageSwitcher />
      <p>
        <Link href="/design-system">{t('home.design_system_cta')}</Link>
      </p>
    </main>
  );
}
