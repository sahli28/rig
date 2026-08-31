'use client';

import type { ReactNode } from 'react';
import { I18nProvider, type LocaleStorage } from '@rig/ui/i18n';
import { localeFromTag, type Locale } from '@rig/core';
import { WebSessionProvider } from '../lib/session';

/**
 * Fuseau de la box. Provisoirement figé : il viendra du tenant résolu par
 * sous-domaine (ticket P0-005).
 */
const BOX_TIME_ZONE = 'Europe/Paris';
const STORAGE_KEY = 'rig.locale';

/** Le web persiste le choix de langue localement en attendant le profil serveur. */
const localeStorage: LocaleStorage = {
  get: () => {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Navigation privée ou stockage bloqué : on retombe sur la langue
      // de l'appareil plutôt que de casser le rendu.
      return null;
    }
  },
  set: (locale: Locale) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* sans effet : la préférence vaudra pour la session en cours */
    }
  },
};

export function Providers({ children }: { children: ReactNode }) {
  // `navigator.language` n'existe pas au rendu serveur : on part du français
  // et le stockage, lu côté client, corrige immédiatement si besoin.
  const initialLocale = typeof navigator === 'undefined' ? 'fr' : localeFromTag(navigator.language);

  return (
    <WebSessionProvider>
      <I18nProvider initialLocale={initialLocale} timeZone={BOX_TIME_ZONE} storage={localeStorage}>
        {children}
      </I18nProvider>
    </WebSessionProvider>
  );
}
