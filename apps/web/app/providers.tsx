'use client';

import type { ReactNode } from 'react';
import { I18nProvider } from '@rack/ui/i18n';
import { resolveLocale } from '@rack/core';
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
   * Rangs 3 et 4 de D-004, **sans casser l'hydratation.** Le premier rendu doit
   * être identique côté serveur et côté client : le serveur n'a pas de
   * `navigator` (il rendrait le repli), le client en a un (il rendrait la langue
   * du navigateur), et lire `navigator.language` *au rendu* faisait diverger les
   * deux HTML — l'erreur React #418 relevée sur l'accueil déployé. On rend donc
   * le **repli** (rang 4) des deux côtés, et la langue du navigateur (rang 3) est
   * passée par `deviceLocale`, appliquée **après montage** — comme le stockage
   * (rang 1) l'est déjà. Le repli est le français, langue du marché.
   *
   * Pas de rang 2 ici, et c'est un choix : ce fournisseur couvre les **pages
   * publiques**, qui n'ont pas de session chargée. Aller chercher `users.locale`
   * y ajouterait un aller-retour à chaque page vue par un visiteur anonyme,
   * pour une information qu'il n'a pas. Le back-office, lui, l'a déjà lue.
   */
  const initialLocale = resolveLocale({});
  // `undefined` côté serveur (pas de `navigator`) ; on **omet** alors la prop
  // plutôt que de la poser à `undefined` (`exactOptionalPropertyTypes`).
  const deviceLocale = typeof navigator === 'undefined' ? undefined : navigator.language;

  return (
    <I18nProvider
      initialLocale={initialLocale}
      timeZone={BOX_TIME_ZONE}
      storage={localeStorage}
      {...(deviceLocale !== undefined ? { deviceLocale } : {})}
    >
      {children}
    </I18nProvider>
  );
}
