'use client';

/**
 * Session côté navigateur.
 *
 * Le web n'a pas d'écran de connexion en P0-005a — ils sont sur le mobile. Ce
 * qui est branché ici, c'est le strict nécessaire pour que le back-office de
 * P1 démarre sur une session déjà valide : lecture du cookie, réaction aux
 * changements d'état, et rien de plus.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { browserClient } from './supabase/client';
import { supabaseConfigured } from './supabase/config';

export interface WebSessionValue {
  session: Session | null;
  /** `false` tant que le cookie n'a pas été lu, pour ne pas afficher « déconnecté » à tort. */
  ready: boolean;
}

const SessionContext = createContext<WebSessionValue>({ session: null, ready: false });

export function WebSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabaseConfigured);

  useEffect(() => {
    if (!supabaseConfigured) return;

    const supabase = browserClient();
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!cancelled) setSession(next);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<WebSessionValue>(() => ({ session, ready }), [session, ready]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useWebSession(): WebSessionValue {
  return useContext(SessionContext);
}
