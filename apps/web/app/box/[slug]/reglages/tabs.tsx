'use client';

import type { ReactNode } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useI18n } from '@rack/ui/i18n';
import type { TranslationKey } from '@rack/core';
import styles from './reglages.module.css';

/**
 * Les cinq sections des réglages.
 *
 * Radix ne porte aucun style : il porte le comportement — flèches, `Home`/`End`,
 * `aria-selected`, association onglet ↔ panneau. C'est exactement ce que la
 * spec §12.2 dit de ne pas recoder à la main (ADR 0005).
 *
 * Les contenus arrivent en `children` **déjà rendus côté serveur** : un
 * composant client peut recevoir des Server Components en props, et c'est ce
 * qui évite de faire descendre toute la lecture des données dans le navigateur.
 */
export function SettingsTabs({
  sections,
}: {
  sections: ReadonlyArray<{ id: string; labelKey: TranslationKey; content: ReactNode }>;
}) {
  const { t } = useI18n();
  const premier = sections[0]?.id ?? '';

  return (
    <Tabs.Root defaultValue={premier}>
      <h1 className={styles.title}>{t('settings.title')}</h1>
      <p className={styles.intro}>{t('settings.intro')}</p>

      <Tabs.List className={styles.tabs} aria-label={t('settings.tabs_label')}>
        {sections.map((section) => (
          <Tabs.Trigger key={section.id} value={section.id} className={styles.tab}>
            {t(section.labelKey)}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {sections.map((section) => (
        <Tabs.Content key={section.id} value={section.id} className={styles.section}>
          {section.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
