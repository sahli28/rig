/**
 * D-004 — la langue, côté mobile.
 *
 * Trois choses vivent ici, et une seule est une décision : la règle des quatre
 * rangs est dans `@rack/core` (`resolve-locale.ts`), pure et testée. Ce fichier
 * n'apporte que les branchements de plateforme — lire l'appareil, écrire dans
 * le trousseau, remonter le choix dans `users.locale`.
 */

import { useEffect, useMemo, useRef } from 'react';
import { getCalendars, getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { localeFromTagOrNull, profileLocaleToSync, type Locale } from '@rack/core';
import { updateLocale } from '@rack/core/supabase';
import type { LocaleStorage } from '@rack/ui/i18n';
import { supabase } from './supabase';

/**
 * La préférence vit dans le trousseau plutôt que dans un stockage à part : ce
 * n'est pas un secret, mais c'est une dépendance de moins, et son effacement se
 * fait au même endroit que celui de la session.
 */
const LOCALE_KEY = 'rack.locale';

/**
 * Langue de l'appareil — **rang 3**.
 *
 * Par `expo-localization`, et non par `Intl`. Sous Hermes,
 * `Intl.DateTimeFormat().resolvedOptions().locale` vaut `en-US` quels que
 * soient les réglages du téléphone : c'est ce qui ouvrait l'app en anglais sur
 * un iPhone français. Aucun test unitaire ne pouvait le voir — `localeFromTag`
 * faisait correctement ce qu'on lui demandait, c'est son **entrée** qui était
 * fausse. Il a fallu un téléphone.
 */
export function deviceLocale(): string | null {
  return getLocales()[0].languageTag;
}

/**
 * Fuseau de l'appareil, tant qu'aucune box n'est active. Dès que `me()` en rend
 * une, c'est le sien qui s'applique (règle 9).
 *
 * Lu par `expo-localization` pour la **même raison** que la langue : les deux
 * sortaient du même `Intl.DateTimeFormat().resolvedOptions()`, et l'un des deux
 * champs s'est révélé faux sous Hermes. Laisser le jumeau sur la source qui a
 * menti serait exactement le motif que `.claude/rules/database.md` appelle la
 * règle des sœurs — un chemin corrigé, et son voisin oublié.
 */
export function deviceTimeZone(): string {
  return getCalendars()[0].timeZone ?? 'Europe/Paris';
}

/**
 * Écriture de `users.locale`, au mieux.
 *
 * Un échec ne remonte pas : hors ligne ou session expirée, la préférence locale
 * reste la vérité sur cet appareil (rang 1), et la réconciliation du prochain
 * démarrage réessaiera. Faire échouer un changement de langue parce que le
 * réseau est absent serait pire que la divergence qu'on cherche à éviter.
 */
async function writeProfileLocale(userId: string | null, locale: Locale): Promise<void> {
  if (userId === null) return;
  try {
    await updateLocale(supabase, userId, locale);
  } catch {
    /* réessayé au prochain lancement par la réconciliation ci-dessous */
  }
}

/**
 * L'adaptateur de stockage à passer à `I18nProvider`, et la réconciliation qui
 * va avec.
 *
 * @param userId identifiant du compte connecté, `null` avant la connexion.
 * @param profileLocale `users.locale`, rendu par `me()`.
 */
export function useLocaleStorage(userId: string | null, profileLocale: string | null) {
  /**
   * L'identité de l'adaptateur doit rester **stable** : le provider relit le
   * stockage à chaque fois qu'elle change, et un objet neuf à chaque rendu le
   * ferait relire en boucle. Le compte courant passe donc par une référence,
   * pas par une dépendance de `useMemo`.
   */
  const account = useRef<string | null>(userId);
  account.current = userId;

  const storage = useMemo<LocaleStorage>(
    () => ({
      get: () => SecureStore.getItemAsync(LOCALE_KEY).catch(() => null),
      set: async (locale) => {
        try {
          await SecureStore.setItemAsync(LOCALE_KEY, locale);
        } catch {
          // Trousseau indisponible : la préférence vaut pour la session en
          // cours. L'écriture du profil ci-dessous la rattrape au lancement
          // suivant, par le rang 2.
        }
        await writeProfileLocale(account.current, locale);
      },
    }),
    [],
  );

  /**
   * La contrepartie du rang 1. Une préférence posée sur cet appareil l'emporte
   * sur le profil — mais si elle s'arrête là, le web et le téléphone suivant
   * gardent l'ancienne langue du compte, et les deux sources divergent en
   * silence. Au démarrage, dès que le compte est connu, on réaligne.
   *
   * Le sens unique est délibéré : un appareil **sans** préférence n'impose rien
   * au compte. `profileLocaleToSync()` porte cette règle, et elle est testée.
   */
  useEffect(() => {
    if (userId === null) return;
    let cancelled = false;

    void Promise.resolve(storage.get()).then((stored) => {
      if (cancelled) return;
      const toSync = profileLocaleToSync(localeFromTagOrNull(stored), profileLocale);
      if (toSync !== null) void writeProfileLocale(userId, toSync);
    });

    return () => {
      cancelled = true;
    };
  }, [storage, userId, profileLocale]);

  return storage;
}

/** Efface la préférence locale. Appelé à la déconnexion, avec la session. */
export async function forgetLocale(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(LOCALE_KEY);
  } catch {
    /* rien à faire : la préférence suivante l'écrasera */
  }
}
