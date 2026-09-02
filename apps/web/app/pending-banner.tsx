'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@rig/ui/i18n';
import { fetchPendingInvitations } from '@rig/core/supabase';
import { browserClient } from '../lib/supabase/client';
import { supabaseConfigured } from '../lib/supabase/config';
import { useWebSession } from '../lib/session';

/**
 * « Ta box t'attend » sur la page d'accueil.
 *
 * Sans ça, quelqu'un que sa box vient d'importer se connecte et atterrit sur une
 * page qui ne lui parle pas — le même cul-de-sac que le COACH sans déconnexion,
 * un écran plus loin. La bannière n'existe que s'il y a quelque chose à dire.
 */
export function PendingBanner() {
  const { t } = useI18n();
  const { session } = useWebSession();
  const [combien, setCombien] = useState(0);

  useEffect(() => {
    if (!supabaseConfigured || session === null) {
      setCombien(0);
      return;
    }

    let vivant = true;
    void fetchPendingInvitations(browserClient())
      .then((invitations) => {
        if (vivant) setCombien(invitations.length);
      })
      .catch(() => {
        // Aucune invitation à montrer n'est pas une erreur d'écran : une session
        // expirée ou une base injoignable ne doit pas colorer la page d'accueil.
        if (vivant) setCombien(0);
      });

    return () => {
      vivant = false;
    };
  }, [session]);

  if (combien === 0) return null;

  return (
    <p>
      <Link href="/invitations">{t('pending.banner', { count: combien })}</Link>
    </p>
  );
}
