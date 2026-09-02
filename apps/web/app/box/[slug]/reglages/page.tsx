import { fetchMe, findMembershipBySlug, tenantScope } from '@rig/core/supabase';
import { serverClient } from '../../../../lib/supabase/server';
import { Notice } from '../notice';
import { SettingsTabs } from './tabs';
import { IdentityForm } from './identity-form';
import { BookingRulesForm } from './booking-rules-form';
import { OpeningHoursForm } from './opening-hours-form';
import { PlacesForm } from './places-form';
import { ClassTypesForm } from './class-types-form';

/**
 * Réglages de la box.
 *
 * Tout se lit **ici**, en un rendu serveur, et descend en props : les sections
 * sont des composants clients parce qu'elles portent des formulaires, pas parce
 * qu'elles ont besoin d'aller chercher quoi que ce soit.
 *
 * Chaque lecture passe par `tenantScope()` : la RLS garantit qu'on ne sort pas
 * des boxes de la personne, pas qu'on reste dans **la box active** — et un
 * membre inscrit dans deux boxes est un cas nominal (`.claude/rules/api.md`).
 */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const client = await serverClient();
  const me = await fetchMe(client);
  const membership = findMembershipBySlug(me, slug);

  // Le layout a déjà rendu ce cas ; ici, il ne reste que la course entre son
  // contrôle et le rendu de la page.
  if (membership === null) return <Notice kind="unknown_box" />;

  const scope = tenantScope(client, membership.tenant_id);

  const [tenant, settings, locations, rooms, classTypes, openingHours] = await Promise.all([
    scope.currentTenant(),
    scope.select('tenant_settings').maybeSingle(),
    scope.select('locations').is('deleted_at', null).order('name'),
    scope.select('rooms').is('deleted_at', null).order('name'),
    scope.select('class_types').is('deleted_at', null).order('created_at'),
    scope.select('opening_hours').is('deleted_at', null).order('weekday').order('opens_at'),
  ]);

  if (tenant.error !== null || tenant.data === null) return <Notice kind="unknown_box" />;

  const identite = tenant.data;

  // Une box a toujours ses réglages — `create_tenant()` les insère dans la même
  // transaction. Le repli ne sert qu'à ne pas rendre l'écran inutilisable si
  // cette invariante venait à céder.
  const regles = settings.data ?? {
    open_days_before: 7,
    close_minutes_before: 15,
    cancel_window_minutes: 240,
    max_upcoming_bookings: 3,
    default_visitor_capacity: 0,
  };

  return (
    <SettingsTabs
      sections={[
        {
          id: 'identite',
          labelKey: 'settings.tab_identity',
          content: (
            <IdentityForm slug={slug} identite={identite} editable={membership.role === 'OWNER'} />
          ),
        },
        {
          id: 'horaires',
          labelKey: 'settings.tab_hours',
          content: <OpeningHoursForm slug={slug} creneaux={openingHours.data ?? []} />,
        },
        {
          id: 'lieux',
          labelKey: 'settings.tab_places',
          content: (
            <PlacesForm slug={slug} adresses={locations.data ?? []} salles={rooms.data ?? []} />
          ),
        },
        {
          id: 'regles',
          labelKey: 'settings.tab_rules',
          content: <BookingRulesForm slug={slug} regles={regles} />,
        },
        {
          id: 'cours',
          labelKey: 'settings.tab_types',
          content: <ClassTypesForm slug={slug} types={classTypes.data ?? []} />,
        },
      ]}
    />
  );
}
