import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { brandFromTheme } from '@rig/ui/theme';
import { fetchMe, findMembershipBySlug } from '@rig/core/supabase';
import { ThemeStyle } from '../../theme-style';
import { serverClient } from '../../../lib/supabase/server';
import { supabaseConfigured } from '../../../lib/supabase/config';
import { BoxI18n } from './box-i18n';
import { Notice } from './notice';
import { Shell } from './shell';

/**
 * La box active vit dans l'**URL**, pas dans un contexte ni dans un cookie.
 *
 * Elle survit au rafraîchissement et au lien partagé, le rendu serveur la lit
 * dans `params`, une lecture croisée devient visible dans la barre d'adresse, et
 * le futur Box Switcher n'est plus qu'une navigation.
 */
export default async function BoxLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!supabaseConfigured) {
    return <Notice kind="not_configured" />;
  }

  const supabase = await serverClient();

  let me;
  try {
    me = await fetchMe(supabase);
  } catch {
    // Le middleware couvre déjà l'absence de session ; ce chemin ne se produit
    // qu'en cas de course entre son contrôle et le rendu.
    redirect(`/login?next=/box/${slug}`);
  }

  // Résolution **parmi ses propres appartenances**. Passer par
  // `tenant_public_profile()` résoudrait n'importe quelle box active, y compris
  // une où l'on n'a rien : « inconnue » et « refusée » doivent rester
  // indiscernables, et ici elles le sont par construction.
  const membership = findMembershipBySlug(me, slug);
  if (membership === null) {
    return <Notice kind="unknown_box" />;
  }

  // Garde de rôle. **Ce n'est pas de la sécurité** : les policies et
  // `current_admin_tenant_ids()` refusent déjà tout à un MEMBER — l'annuaire
  // rendrait zéro ligne, les réglages seraient en lecture seule. Elle existe
  // pour qu'il lise une phrase au lieu de contempler des écrans vides.
  if (membership.role !== 'OWNER' && membership.role !== 'MANAGER') {
    return <Notice kind="staff_only" />;
  }

  // Second aller-retour, et seulement maintenant : le premier ne portait pas de
  // box active, donc ni thème ni fuseau. Même enchaînement que le mobile.
  const scoped = await fetchMe(supabase, membership.tenant_id);
  const tenant = scoped.current_tenant;

  if (tenant === null) {
    return <Notice kind="unknown_box" />;
  }

  return (
    <>
      {/* Rendu après celui de la racine, donc prioritaire : le back-office
          prend les couleurs de la box, en SSR et sans clignotement. */}
      <ThemeStyle brand={brandFromTheme(tenant.theme)} />
      {/* Règle 9 : les heures s'affichent dans le fuseau de la box, jamais dans
          celui du navigateur. Le fournisseur racine porte encore un fuseau figé
          — il ne vaut que pour les pages publiques, qui n'ont pas de box.

          La langue, elle, suit les rangs de D-004 : `BoxI18n` ajoute la
          préférence du navigateur, qui l'emporte sur `users.locale`. */}
      <BoxI18n profileLocale={scoped.user.locale} timeZone={tenant.timezone}>
        <Shell slug={slug} boxName={tenant.theme.app_name} role={membership.role}>
          {children}
        </Shell>
      </BoxI18n>
    </>
  );
}
