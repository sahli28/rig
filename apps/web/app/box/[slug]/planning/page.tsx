import {
  DirectoryRowSchema,
  fetchMe,
  findMembershipBySlug,
  isCalendarDate,
  localizedText,
  mondayOf,
  shiftWeeks,
  tenantScope,
  weekDates,
  instantLocal,
  localDay,
  localDayIn,
  type Choice,
  type Occurrence,
  type Serie,
  can,
  fetchWorkoutsByClass,
} from '@rack/core/supabase';
import { serverClient } from '../../../../lib/supabase/server';
import { Notice } from '../notice';
import { PlanningScreen } from './planning-screen';

/**
 * Le planning de la box.
 *
 * Tout se lit **ici**, en un rendu serveur, et descend en props. Les composants
 * clients portent des formulaires et des dialogues, pas des requêtes.
 *
 * La semaine affichée vit dans l'URL (`?semaine=YYYY-MM-DD`), comme la box vit
 * dans le chemin : elle survit au rafraîchissement, se partage en lien, et le
 * rendu serveur la lit dans `searchParams`. Un état de navigation dans un
 * `useState` obligerait à rendre la grille côté client pour rien.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ semaine?: string }>;
}) {
  const { slug } = await params;
  const { semaine } = await searchParams;

  const client = await serverClient();
  const me = await fetchMe(client);
  const membership = findMembershipBySlug(me, slug);

  if (membership === null) return <Notice kind="unknown_box" />;

  const scope = tenantScope(client, membership.tenant_id);

  const [tenant, classTypesRows, roomsRows, staffRows, schedulesRows] = await Promise.all([
    scope.currentTenant(),
    scope.select('class_types').is('deleted_at', null).order('created_at'),
    scope.select('rooms').is('deleted_at', null).order('name'),
    scope.selectView('member_admin_directory').in('role', ['OWNER', 'MANAGER', 'COACH']),
    scope.select('class_schedules').is('deleted_at', null).order('starts_at_local'),
  ]);

  if (tenant.error !== null || tenant.data === null) return <Notice kind="unknown_box" />;

  const locale = me.user.locale ?? 'fr';
  const timeZone = tenant.data.timezone;

  // Le lundi de la semaine demandée. Une valeur absente ou illisible ramène à
  // la semaine courante plutôt qu'à une page d'erreur : `?semaine=n'importe
  // quoi` est une URL bricolée, pas une panne.
  const today = localDay(new Date().toISOString(), timeZone);
  const monday = mondayOf(isCalendarDate(semaine) ? semaine : today);
  const dates = weekDates(monday);

  // Les bornes de la requête sont les **instants** qui encadrent la semaine
  // locale de la box. Filtrer sur `starts_at::date` en UTC ferait manquer les
  // cours de fin de soirée du dimanche, ou déborder sur le lundi suivant, selon
  // le fuseau — exactement le genre d'erreur qu'on ne voit qu'en production.
  const debut = `${dates[0]}T00:00:00`;
  const fin = `${shiftWeeks(monday, 1)}T00:00:00`;

  // **Deux semaines, une fois** (P1-015). Le pré-remplissage propose « le même
  // cours la semaine dernière » : sans la semaine précédente en mémoire, il
  // faudrait deux requêtes par cellule, sur une grille qui en affiche une
  // quarantaine.
  const [classesRows, semainePrecedenteRows] = await Promise.all([
    scope
      .select('classes')
      .is('deleted_at', null)
      .gte('starts_at', instantLocal(debut, timeZone))
      .lt('starts_at', instantLocal(fin, timeZone))
      .order('starts_at'),
    scope
      .select('classes')
      .is('deleted_at', null)
      .gte('starts_at', instantLocal(`${shiftWeeks(monday, -1)}T00:00:00`, timeZone))
      .lt('starts_at', instantLocal(debut, timeZone))
      .order('starts_at'),
  ]);

  const typesById = new Map(
    (classTypesRows.data ?? []).map((row) => [row.id, localizedText(row.name_i18n, locale)]),
  );
  const roomsById = new Map((roomsRows.data ?? []).map((row) => [row.id, row.name]));
  // Zod comme frontière de type, comme l'écran Staff : `selectView()` rend des
  // lignes `GenericStringError` faute de liste de colonnes — c'est le compromis
  // assumé d'`active-tenant.ts`, où typer les colonnes fait exploser `tsc` en
  // « heap out of memory ». Le schéma redonne un type **et** valide, là où un
  // transtypage n'aurait fait que taire l'avertissement.
  const staff = DirectoryRowSchema.array().parse(staffRows.data ?? []);
  const staffById = new Map(
    staff.map((row) => [
      row.membership_id,
      [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.email,
    ]),
  );

  const occurrences: Occurrence[] = (classesRows.data ?? []).map((row) => ({
    id: row.id,
    schedule_id: row.schedule_id,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    capacity: row.capacity,
    booked_count: row.booked_count,
    status: row.status,
    cancellation_reason: row.cancellation_reason,
    class_type_id: row.class_type_id,
    className: typesById.get(row.class_type_id) ?? '—',
    roomName: roomsById.get(row.room_id) ?? '—',
    coachName: staffById.get(row.coach_membership_id) ?? '—',
  }));

  const series: Serie[] = (schedulesRows.data ?? []).map((row) => ({
    id: row.id,
    class_type_id: row.class_type_id,
    room_id: row.room_id,
    coach_membership_id: row.coach_membership_id,
    starts_on: row.starts_on,
    starts_at_local: row.starts_at_local,
    rrule: row.rrule,
    capacity: row.capacity,
    className: typesById.get(row.class_type_id) ?? '—',
  }));

  // Les séances de la semaine, en une requête plutôt qu'une par cellule : la
  // grille en affiche une quarantaine (P1-015).
  const precedentes = semainePrecedenteRows.data ?? [];
  const workouts = await fetchWorkoutsByClass(client, {
    tenantId: membership.tenant_id,
    classIds: [...occurrences.map((o) => o.id), ...precedentes.map((row) => row.id)],
  });

  // Ce dans quoi le pré-remplissage puise : les deux semaines, réduites à ce que
  // la sélection compare — un identifiant, un type, un jour **local de la box**,
  // et de quoi se reconnaître dans une liste.
  const jourDe = localDayIn(timeZone);
  const candidates = [...(classesRows.data ?? []), ...precedentes].map((row) => ({
    id: row.id,
    classTypeId: row.class_type_id,
    day: jourDe(row.starts_at),
    label: `${jourDe(row.starts_at)} · ${typesById.get(row.class_type_id) ?? '—'}`,
  }));

  const choix = (entries: Map<string, string>): Choice[] =>
    [...entries.entries()].map(([id, label]) => ({ id, label }));

  return (
    <PlanningScreen
      slug={slug}
      monday={monday}
      today={today}
      previousWeek={shiftWeeks(monday, -1)}
      nextWeek={shiftWeeks(monday, 1)}
      thisWeek={mondayOf(today)}
      occurrences={occurrences}
      series={series}
      classTypes={choix(typesById)}
      rooms={choix(roomsById)}
      coaches={choix(staffById)}
      // Garde d'ergonomie, pas de sécurité : les policies et
      // `refresh_class_schedule()` refusent déjà un COACH. Ne pas proposer une
      // porte qui se ferme.
      editable={can(membership.role, 'planning_admin')}
      // **Un second droit, et il ne recouvre pas le premier** (P1-015).
      // `editable` garde l'administration — créer une série, annuler un cours.
      // Écrire la séance est le travail du coach, qui n'administre rien : sans
      // ce drapeau, celui à qui le ticket est destiné ne pourrait pas s'en
      // servir. Sœur de `current_staff_tenant_ids()` en base — et depuis
      // `D-021`, la même table que la porte, qui ne l'avait pas suivi.
      staff={can(membership.role, 'workout')}
      workouts={workouts}
      candidates={candidates}
    />
  );
}
