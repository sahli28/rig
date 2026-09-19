import { can, fetchMe, findMembershipBySlug, tenantScope } from '@rack/core/supabase';
import { serverClient } from '../../../../lib/supabase/server';
import { Notice } from '../notice';
import { Wizard } from './wizard';
import { IdentityForm } from '../reglages/identity-form';
import { OpeningHoursForm } from '../reglages/opening-hours-form';
import { PlacesForm } from '../reglages/places-form';
import { ClassTypesForm } from '../reglages/class-types-form';
import { BookingRulesForm } from '../reglages/booking-rules-form';

/**
 * Assistant de mise en route (P2-004) — cinq étapes qui **enchaînent** les
 * sections de Réglages (P1-001b), sans les réécrire : on réutilise les mêmes
 * composants de formulaire, chacun avec sa propre Server Action. Ce fichier ne
 * fait que lire l'état (comme `reglages/page.tsx`) et le distribuer au stepper.
 *
 * Config, pas création : la box existe déjà (P1-020). Réservé au staff qui
 * configure (`settings`) ; un coach n'a rien à régler ici.
 */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const client = await serverClient();
  const me = await fetchMe(client);
  const membership = findMembershipBySlug(me, slug);

  if (membership === null) return <Notice kind="unknown_box" />;
  if (!can(membership.role, 'settings')) return <Notice kind="role_forbidden" />;

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

  const regles = settings.data ?? {
    open_days_before: 7,
    close_minutes_before: 15,
    cancel_window_minutes: 240,
    max_upcoming_bookings: 3,
    default_visitor_capacity: 0,
    checkin_window_before_minutes: 30,
    checkin_window_after_minutes: 15,
  };

  const salles = rooms.data ?? [];
  const creneaux = openingHours.data ?? [];
  const types = classTypes.data ?? [];

  return (
    <Wizard
      slug={slug}
      steps={[
        {
          id: 'identite',
          labelKey: 'settings.tab_identity',
          // L'identité existe dès la création de la box : l'étape est « faite ».
          done: true,
          content: (
            <IdentityForm
              slug={slug}
              identite={identite}
              editable={can(membership.role, 'identity')}
            />
          ),
        },
        {
          id: 'horaires',
          labelKey: 'settings.tab_hours',
          done: creneaux.length > 0,
          content: <OpeningHoursForm slug={slug} creneaux={creneaux} />,
        },
        {
          id: 'lieux',
          labelKey: 'settings.tab_places',
          done: salles.length > 0,
          content: <PlacesForm slug={slug} adresses={locations.data ?? []} salles={salles} />,
        },
        {
          id: 'cours',
          labelKey: 'settings.tab_types',
          done: types.length > 0,
          content: <ClassTypesForm slug={slug} types={types} />,
        },
        {
          id: 'regles',
          labelKey: 'settings.tab_rules',
          // Les règles ont toujours une valeur (défaut à la création).
          done: true,
          content: <BookingRulesForm slug={slug} regles={regles} />,
        },
      ]}
    />
  );
}
