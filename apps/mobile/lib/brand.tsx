/**
 * Marque de la box, résolue **avant authentification**, et le jeton
 * d'invitation qui l'accompagne.
 *
 * C'est ce qui rend l'écran de bienvenue brandé : le lien d'invitation porte un
 * jeton (ou un slug), la base rend la marque à la clé `anon`, et l'app s'habille
 * aux couleurs de la box avant même de savoir qui arrive.
 *
 * **Le jeton vit ici, pas dans l'URL.** C'est la leçon du 3 septembre 2026 :
 * ouvrir `/invitation/<jeton>` sur l'iPhone tombait sur une route inexistante,
 * `useAuthRedirect` renvoyait sur `/welcome` — et une redirection n'emporte pas
 * les paramètres. Le jeton disparaissait avant d'avoir servi, et personne
 * n'était rattaché à sa box, sans le moindre message. Même famille que le
 * `?semaine=` de P1-002. Ce contexte est monté **au-dessus** du `Stack` : aucune
 * navigation ne peut le vider.
 *
 * Une fois la session ouverte, la marque vient de `me().current_tenant.theme` —
 * c'est le layout qui arbitre, pas ce module.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { fetchInvitationPreview, fetchTenantPublicProfile } from '@rig/core/supabase';
import { brandFromPublicProfile, type TenantBrand } from '@rig/ui/theme';
import { supabase } from './supabase';

export type BrandStatus = 'idle' | 'loading' | 'resolved' | 'unknown';

export interface BrandValue {
  /** Marque de la box invitante, `null` tant qu'aucune n'est résolue. */
  brand: TenantBrand | null;
  status: BrandStatus;
  /**
   * Le jeton d'invitation en cours, hors de toute URL. Lu par l'écran de
   * connexion, qui l'échange contre une appartenance après le code à six
   * chiffres.
   */
  invitationToken: string | null;
  resolveSlug: (slug: string) => Promise<void>;
  /** Résout la marque **par le jeton** — la forme que prend un vrai lien. */
  resolveToken: (token: string) => Promise<void>;
  /** Après acceptation, ou après un refus définitif : le jeton ne se rejoue pas. */
  clearInvitation: () => void;
}

const BrandContext = createContext<BrandValue | null>(null);

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<TenantBrand | null>(null);
  const [status, setStatus] = useState<BrandStatus>('idle');
  const [invitationToken, setInvitationToken] = useState<string | null>(null);

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

  /**
   * La **sœur oubliée** de `resolveSlug`. `invitation_preview()` existe en base
   * depuis D-005 et le web l'appelait déjà dans `/invitation/[token]` ; le
   * mobile ne résolvait que depuis un slug, qu'aucun lien ne porte. Un membre
   * invité voyait donc toujours la marque de la plateforme — et comme celle-ci
   * partageait sa couleur avec la box pilote, ça ne se voyait pas.
   *
   * Le jeton est mémorisé même si l'aperçu échoue : c'est l'acceptation qui
   * tranche sa validité, pas l'affichage. Un réseau capricieux ne doit pas
   * coûter le rattachement.
   */
  const resolveToken = useCallback(async (token: string) => {
    setInvitationToken(token);
    setStatus('loading');
    try {
      const preview = await fetchInvitationPreview(supabase, token);
      setBrand(preview === null ? null : brandFromPublicProfile(preview));
      setStatus(preview === null ? 'unknown' : 'resolved');
    } catch {
      setBrand(null);
      setStatus('unknown');
    }
  }, []);

  const clearInvitation = useCallback(() => {
    setInvitationToken(null);
  }, []);

  const value = useMemo<BrandValue>(
    () => ({ brand, status, invitationToken, resolveSlug, resolveToken, clearInvitation }),
    [brand, status, invitationToken, resolveSlug, resolveToken, clearInvitation],
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
