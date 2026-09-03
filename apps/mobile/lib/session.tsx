/**
 * Session et état de démarrage.
 *
 * Un seul endroit sait qui est connecté, dans quelle box, et ce qu'il reste à
 * faire avant que l'app soit utilisable. Les écrans lisent `useSession()` et ne
 * parlent jamais directement à `supabase.auth`.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { Session } from '@supabase/supabase-js';
import { chooseActiveTenant, fetchMe, type Me } from '@rig/core/supabase';
import { errorMessageKeyOf, type TranslationKey } from '@rig/core';
import { forgetLocale } from './locale';
import { startSessionAutoRefresh, supabase } from './supabase';

/**
 * La box active n'est pas un secret, mais elle est stockée dans le trousseau
 * comme le reste : une dépendance de stockage de moins, et l'effacement au
 * moment de la déconnexion est au même endroit.
 */
const ACTIVE_TENANT_KEY = 'rig.active_tenant';

export type SessionStatus = 'loading' | 'signed_out' | 'ready';

export interface SessionValue {
  status: SessionStatus;
  session: Session | null;
  me: Me | null;
  /** Clé i18n du dernier échec de chargement, `null` si tout va bien. */
  errorKey: TranslationKey | null;
  activeTenantId: string | null;
  setActiveTenant: (tenantId: string) => Promise<void>;
  /** Relit `me()` — après un profil complété, un consentement, une invitation acceptée. */
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

async function readPersistedTenant(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACTIVE_TENANT_KEY);
  } catch {
    // Trousseau indisponible (web, appareil verrouillé) : on repart sans
    // préférence plutôt que d'empêcher le démarrage.
    return null;
  }
}

async function persistTenant(tenantId: string | null): Promise<void> {
  try {
    if (tenantId === null) await SecureStore.deleteItemAsync(ACTIVE_TENANT_KEY);
    else await SecureStore.setItemAsync(ACTIVE_TENANT_KEY, tenantId);
  } catch {
    // Perdre la préférence coûte un choix de box au prochain lancement,
    // pas la session : rien à faire remonter à l'écran.
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);

  const load = useCallback(async (current: Session | null) => {
    if (current === null) {
      setMe(null);
      setActiveTenantId(null);
      setErrorKey(null);
      setStatus('signed_out');
      return;
    }

    try {
      const remembered = await readPersistedTenant();
      const first = await fetchMe(supabase, remembered);

      // `me()` ne devine pas la box active : si celle qu'on a mémorisée n'est
      // plus une des siennes, elle rend `current_tenant` nul. Le choix se fait
      // ici, et un second aller-retour n'a lieu que s'il change quelque chose.
      const chosen = chooseActiveTenant(first.memberships, remembered);
      const resolved = chosen === remembered ? first : await fetchMe(supabase, chosen);

      if (chosen !== remembered) await persistTenant(chosen);

      setMe(resolved);
      setActiveTenantId(chosen);
      setErrorKey(null);
    } catch (error) {
      setMe(null);
      setErrorKey(errorMessageKeyOf(error));
    } finally {
      setStatus('ready');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      void load(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (cancelled) return;
      setSession(next);
      void load(next);
    });

    const stopAutoRefresh = startSessionAutoRefresh();

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
      stopAutoRefresh();
    };
  }, [load]);

  const setActiveTenant = useCallback(async (tenantId: string) => {
    await persistTenant(tenantId);
    setActiveTenantId(tenantId);
    try {
      setMe(await fetchMe(supabase, tenantId));
      setErrorKey(null);
    } catch (error) {
      setErrorKey(errorMessageKeyOf(error));
    }
  }, []);

  /**
   * Relit `me()` — après un profil complété, un consentement, une invitation
   * acceptée.
   *
   * **La session est relue, pas capturée.** Avec `load(session)`, cette
   * fonction fermait sur l'état du rendu où l'appelant l'avait obtenue : sur
   * l'écran de connexion, c'était `null`. Le `reload()` qui suit `verifyOtp()`
   * appelait donc `load(null)` et **déconnectait** l'app une fraction de
   * seconde après l'avoir connectée, au lieu de recharger le profil. Rattrapé
   * ensuite par `onAuthStateChange`, donc invisible — mais il aurait avalé
   * l'appartenance que l'acceptation d'invitation venait de créer.
   */
  const reload = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await load(data.session);
  }, [load]);

  const signOut = useCallback(async () => {
    await persistTenant(null);
    // La préférence de langue part avec la session, et ce n'est pas une perte :
    // elle a été écrite dans `users.locale` (D-004), donc la reconnexion la
    // restitue par le rang 2. La garder ferait pire — sur un téléphone partagé,
    // la personne suivante hériterait de la langue de la précédente, et la
    // réconciliation irait écraser **son** profil avec.
    await forgetLocale();
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      session,
      me,
      errorKey,
      activeTenantId,
      setActiveTenant,
      reload,
      signOut,
    }),
    [status, session, me, errorKey, activeTenantId, setActiveTenant, reload, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Lève hors fournisseur : un écran sans session n'a rien à afficher de sensé. */
export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error('useSession() exige un <SessionProvider> parent.');
  }
  return value;
}
