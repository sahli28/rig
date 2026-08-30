'use client';

/**
 * Liant React de l'i18n. Le moteur est dans `@rig/core` — pur, testable,
 * sans React ; ici on ne fait que le brancher à un contexte et lier les
 * formatteurs à la langue courante et au **fuseau de la box**.
 *
 * La directive `use client` est là pour Next : le contexte est un état client.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  formatDate as coreFormatDate,
  formatMoney as coreFormatMoney,
  formatRelativeDate as coreFormatRelativeDate,
  formatTime as coreFormatTime,
  isLocale,
  translate,
  type FormatDateOptions,
  type Locale,
  type MoneyOptions,
  type PluralKey,
  type RelativeDateOptions,
  type TranslateOptions,
  type TranslationKey,
} from '@rig/core';

/**
 * Persistance du choix de langue. Volontairement abstraite : le web a
 * `localStorage`, le mobile aura le profil serveur (ticket P0-005). Aucune
 * dépendance de stockage n'est imposée par le kit.
 */
export interface LocaleStorage {
  get: () => string | null | Promise<string | null>;
  set: (locale: Locale) => void | Promise<void>;
}

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Fuseau de la box. Toutes les heures affichées s'y réfèrent. */
  timeZone: string;
  t: (key: TranslationKey | PluralKey, options?: TranslateOptions) => string;
  formatMoney: (amountCents: number, options?: Omit<MoneyOptions, 'locale'>) => string;
  formatDate: (value: Date | string, options?: Pick<FormatDateOptions, 'style'>) => string;
  formatTime: (value: Date | string) => string;
  formatRelativeDate: (value: Date | string, options?: Pick<RelativeDateOptions, 'now'>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  children: ReactNode;
  /** Langue initiale, typiquement celle de l'appareil. */
  initialLocale: Locale;
  /** Fuseau de la box, ex. `Europe/Paris`. */
  timeZone: string;
  storage?: LocaleStorage;
}

export function I18nProvider({ children, initialLocale, timeZone, storage }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Une préférence déjà enregistrée l'emporte sur la langue de l'appareil.
  useEffect(() => {
    if (storage === undefined) return;
    let cancelled = false;

    void Promise.resolve(storage.get()).then((stored) => {
      if (!cancelled && stored !== null && isLocale(stored)) {
        setLocaleState(stored);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [storage]);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      void storage?.set(next);
    },
    [storage],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      timeZone,
      t: (key, options) => translate(locale, key, options),
      formatMoney: (amountCents, options) => coreFormatMoney(amountCents, { ...options, locale }),
      formatDate: (date, options) => coreFormatDate(date, { ...options, locale, timeZone }),
      formatTime: (date) => coreFormatTime(date, { locale, timeZone }),
      formatRelativeDate: (date, options) =>
        coreFormatRelativeDate(date, { ...options, locale, timeZone }),
    }),
    [locale, setLocale, timeZone],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Lève hors provider : une chaîne non traduite est un bug, pas un repli. */
export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (value === null) {
    throw new Error('useI18n() exige un <I18nProvider> parent.');
  }
  return value;
}
