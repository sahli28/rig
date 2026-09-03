'use client';

import type { ReactNode } from 'react';
import { I18nProvider } from '@rig/ui/i18n';
import { resolveLocale } from '@rig/core';
import { useWebSession } from '../../../lib/session';
import { useLocaleStorage } from '../../../lib/use-locale-storage';

/**
 * Le fournisseur i18n du back-office, côté client.
 *
 * Il existe parce qu'un composant serveur ne peut pas passer d'adaptateur de
 * stockage à `I18nProvider` : `localeStorage` porte des fonctions et touche
 * `window`, deux choses qui ne traversent pas la frontière serveur → client.
 * Ce composant est donc le point où le rang 1 rejoint le rang 2.
 *
 * Avant lui, le back-office montait `I18nProvider` avec `users.locale` et **sans
 * stockage** : la préférence du navigateur était ignorée dès qu'on entrait dans
 * une box, alors qu'elle est censée l'emporter. Le bug ne se voyait qu'en
 * changeant de langue sur une page publique puis en revenant.
 */
export function BoxI18n({
  profileLocale,
  timeZone,
  children,
}: {
  /** `users.locale` — rang 2, connu du serveur puisque `me()` est déjà lu. */
  profileLocale: string;
  timeZone: string;
  children: ReactNode;
}) {
  const { session } = useWebSession();
  const localeStorage = useLocaleStorage(session?.user.id ?? null);

  return (
    <I18nProvider
      initialLocale={resolveLocale({ profile: profileLocale })}
      timeZone={timeZone}
      storage={localeStorage}
      profileLocale={profileLocale}
    >
      {children}
    </I18nProvider>
  );
}
