'use client';

import type { ReactNode } from 'react';
import { I18nProvider } from '@rig/ui/i18n';
import { resolveLocale } from '@rig/core';
import { useLocaleStorage } from '../lib/use-locale-storage';
import { WebSessionProvider, useWebSession } from '../lib/session';

/**
 * Fuseau de la box. Provisoirement figé : il viendra du tenant résolu par
 * sous-domaine (ticket P0-005).
 */
const BOX_TIME_ZONE = 'Europe/Paris';

export function Providers({ children }: { children: ReactNode }) {
  // La langue a besoin de savoir qui est connecté pour remonter le choix dans
  // `users.locale` : le fournisseur i18n passe donc **sous** celui de session.
  return (
    <WebSessionProvider>
      <RootI18n>{children}</RootI18n>
    </WebSessionProvider>
  );
}

function RootI18n({ children }: { children: ReactNode }) {
  const { session } = useWebSession();
  const localeStorage = useLocaleStorage(session?.user.id ?? null);

  /**
   * Rangs 3 et 4 de D-004. `navigator.language` n'existe pas au rendu serveur :
   * on y sert le repli — désormais le français, ce qui est aussi la langue du
   * marché — et le stockage, lu côté client, corrige immédiatement si besoin.
   *
   * Pas de rang 2 ici, et c'est un choix : ce fournisseur couvre les **pages
   * publiques**, qui n'ont pas de session chargée. Aller chercher `users.locale`
   * y ajouterait un aller-retour à chaque page vue par un visiteur anonyme,
   * pour une information qu'il n'a pas. Le back-office, lui, l'a déjà lue.
   */
  const initialLocale = resolveLocale(
    typeof navigator === 'undefined' ? {} : { device: navigator.language },
  );

  return (
    <I18nProvider initialLocale={initialLocale} timeZone={BOX_TIME_ZONE} storage={localeStorage}>
      {children}
    </I18nProvider>
  );
}
