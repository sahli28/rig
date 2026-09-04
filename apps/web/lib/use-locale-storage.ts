'use client';

/**
 * D-004 — la langue, côté web.
 *
 * Le **rang 1** : la préférence de ce navigateur, et sa remontée dans
 * `users.locale`. La règle des quatre rangs, elle, est dans `@rack/core`
 * (`resolve-locale.ts`), pure et testée.
 */

import { useMemo, useRef } from 'react';
import type { LocaleStorage } from '@rack/ui/i18n';
import type { Locale } from '@rack/core';
import { updateLocale } from '@rack/core/supabase';
import { browserClient } from './supabase/client';
import { supabaseConfigured } from './supabase/config';

const STORAGE_KEY = 'rack.locale';

/**
 * L'adaptateur de stockage à passer à `I18nProvider`.
 *
 * Partagé par le fournisseur racine (pages publiques) et par celui du
 * back-office. Les deux existaient, et **un seul lisait ce stockage** : un choix
 * fait sur une page publique était oublié en entrant dans `/box/[slug]/…`,
 * c'est-à-dire le rang 2 qui écrasait le rang 1 — l'inverse de l'ordre décidé.
 *
 * @param userId identifiant du compte connecté, `null` si personne ne l'est.
 */
export function useLocaleStorage(userId: string | null): LocaleStorage {
  /**
   * L'identité de l'adaptateur doit rester **stable** : le provider relit le
   * stockage chaque fois qu'elle change. Le compte courant passe donc par une
   * référence, pas par une dépendance de `useMemo`.
   */
  const account = useRef<string | null>(userId);
  account.current = userId;

  return useMemo<LocaleStorage>(
    () => ({
      get: () => {
        try {
          return window.localStorage.getItem(STORAGE_KEY);
        } catch {
          // Navigation privée ou stockage bloqué : on retombe sur le rang
          // suivant plutôt que de casser le rendu.
          return null;
        }
      },
      set: async (locale: Locale) => {
        try {
          window.localStorage.setItem(STORAGE_KEY, locale);
        } catch {
          /* sans effet : la préférence vaudra pour la session en cours */
        }
        await writeProfileLocale(account.current, locale);
      },
    }),
    [],
  );
}

/**
 * Remonte le choix dans `users.locale` — la contrepartie du rang 1, sans
 * laquelle un choix fait ici resterait invisible du téléphone, et les deux
 * sources divergeraient en silence.
 *
 * **À l'écriture seulement, pas au démarrage.** Le mobile, lui, réconcilie au
 * lancement : il connaît `users.locale` par `me()`, qu'il a déjà chargé. Le web
 * ne l'a pas sur les pages publiques, et le supposer absent y déclencherait une
 * écriture à chaque page vue. Une écriture sur geste explicite suffit ; le
 * rattrapage d'un échec réseau reste le travail du mobile.
 */
async function writeProfileLocale(userId: string | null, locale: Locale): Promise<void> {
  if (userId === null || !supabaseConfigured) return;
  try {
    await updateLocale(browserClient(), userId, locale);
  } catch {
    /* hors ligne ou session expirée : la préférence locale reste la vérité ici */
  }
}
