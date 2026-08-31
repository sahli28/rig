/**
 * Marque de la box, résolue **avant authentification**.
 *
 * C'est ce qui rend l'écran de bienvenue brandé : le lien d'invitation porte le
 * `slug`, `tenant_public_profile()` rend la marque à la clé `anon`, et l'app
 * s'habille aux couleurs de la box avant même de savoir qui arrive.
 *
 * Une fois la session ouverte, la marque vient de `me().current_tenant.theme` —
 * c'est le layout qui arbitre, pas ce module.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { fetchTenantPublicProfile } from '@rig/core/supabase';
import { brandFromPublicProfile, type TenantBrand } from '@rig/ui/theme';
import { supabase } from './supabase';

export type BrandStatus = 'idle' | 'loading' | 'resolved' | 'unknown';

export interface BrandValue {
  /** Marque de la box invitante, `null` tant qu'aucune n'est résolue. */
  brand: TenantBrand | null;
  status: BrandStatus;
  resolveSlug: (slug: string) => Promise<void>;
}

const BrandContext = createContext<BrandValue | null>(null);

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<TenantBrand | null>(null);
  const [status, setStatus] = useState<BrandStatus>('idle');

  const resolveSlug = useCallback(async (slug: string) => {
    setStatus('loading');
    try {
      const profile = await fetchTenantPublicProfile(supabase, slug);
      // Slug inconnu, box fermée, box supprimée : la fonction SQL ne les
      // distingue pas, et l'écran non plus. Confirmer l'existence d'une box à
      // qui tape des slugs au hasard serait déjà une divulgation.
      setBrand(profile === null ? null : brandFromPublicProfile(profile));
      setStatus(profile === null ? 'unknown' : 'resolved');
    } catch {
      // Réseau indisponible : on garde le thème neutre plutôt que de bloquer
      // l'inscription sur un détail cosmétique.
      setBrand(null);
      setStatus('unknown');
    }
  }, []);

  const value = useMemo<BrandValue>(
    () => ({ brand, status, resolveSlug }),
    [brand, status, resolveSlug],
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandValue {
  const value = useContext(BrandContext);
  if (value === null) {
    throw new Error('useBrand() exige un <BrandProvider> parent.');
  }
  return value;
}
