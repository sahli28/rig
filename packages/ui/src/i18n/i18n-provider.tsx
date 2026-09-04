'use client';

/**
 * Liant React de l'i18n. Le moteur est dans `@rack/core` — pur, testable,
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
} from '@rack/core';

/**
 * Persistance du choix de langue — le **rang 1** de D-004. Volontairement
 * abstraite : le web a `localStorage`, le mobile le trousseau. Aucune
 * dépendance de stockage n'est imposée par le kit.
 *
 * `set` est aussi la couture par laquelle une application propage le choix
 * ailleurs (le mobile y écrit `users.locale`) : le provider ne connaît ni
 * Supabase ni compte.
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
  /** Langue initiale — **rang 3** : celle de l'appareil ou du navigateur. */
  initialLocale: Locale;
  /** Fuseau de la box, ex. `Europe/Paris`. */
  timeZone: string;
  /** **Rang 1** : la préférence enregistrée sur cet appareil. */
  storage?: LocaleStorage;
  /**
   * **Rang 2** : `users.locale`, la langue du compte.
   *
   * Elle a un statut particulier, et c'est le seul endroit délicat du ticket :
   * elle n'existe qu'**après** l'authentification, alors que l'écran de
   * connexion s'affiche avant. Elle arrive donc en cours de vie du provider,
   * pas au montage — et le remonter pour en tenir compte remettrait à zéro la
   * navigation en plus de faire clignoter l'écran.
   */
  profileLocale?: string | null;
}

export function I18nProvider({
  children,
  initialLocale,
  timeZone,
  storage,
  profileLocale,
}: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  /**
   * Un choix explicite a-t-il déjà eu lieu — préférence relue au démarrage, ou
   * bascule dans cette session ? Tant que non, une source plus fiable que la
   * langue de l'appareil peut encore prendre la main. Après, plus rien : c'est
   * le rang 1, et il ne se fait pas déloger par un rang inférieur.
   */
  const [pinned, setPinned] = useState(false);

  /**
   * La lecture du stockage est asynchrone (trousseau, `localStorage` bloqué…),
   * et le profil peut arriver avant qu'elle réponde. Sans ce drapeau, les deux
   * sources se marcheraient dessus dans un ordre dicté par le réseau — le
   * clignotement qu'on cherche précisément à éviter. Le rang 2 attend donc que
   * le rang 1 ait dit s'il avait quelque chose.
   */
  const [storageChecked, setStorageChecked] = useState(storage === undefined);

  // Rang 1 — une préférence déjà enregistrée l'emporte sur tout le reste.
  useEffect(() => {
    if (storage === undefined) return;
    let cancelled = false;

    void Promise.resolve(storage.get()).then((stored) => {
      if (cancelled) return;
      if (stored !== null && isLocale(stored)) {
        setLocaleState(stored);
        setPinned(true);
      }
      setStorageChecked(true);
    });

    return () => {
      cancelled = true;
    };
  }, [storage]);

  // Rang 2 — la langue du compte, dès qu'elle est connue et si personne n'a
  // rien choisi sur cet appareil.
  useEffect(() => {
    if (!storageChecked || pinned) return;
    if (profileLocale === undefined || profileLocale === null) return;
    if (!isLocale(profileLocale)) return;
    setLocaleState(profileLocale);
  }, [storageChecked, pinned, profileLocale]);

  const setLocale = useCallback(
    (next: Locale) => {
      setPinned(true);
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
