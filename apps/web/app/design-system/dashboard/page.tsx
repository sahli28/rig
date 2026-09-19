import { notFound } from 'next/navigation';
import type { BoxDashboard } from '@rack/core/supabase';
import { DashboardScreen } from '../../box/[slug]/dashboard-screen';

/**
 * Le dashboard **sans session ni base** (P2-004), pour regarder le rendu réel
 * des composants — clair/sombre, héros, anneau, graphe (survol + clavier),
 * checklist — sans dépendre d'une connexion.
 *
 * Une sonde, donc gardée dès la première ligne (règle 9) : hors développement,
 * cette page n'existe pas. Données inventées ; `?empty` montre l'état d'amorçage,
 * `?coach` masque la tuile des expirations (comme pour un coach).
 */
function sampleActivity(empty: boolean): BoxDashboard['activity'] {
  const shape = [
    14, 18, 12, 22, 26, 31, 9, 16, 24, 28, 33, 30, 19, 12, 27, 35, 38, 29, 21, 15, 33, 41, 44, 36,
    25, 18, 39, 45, 43, 30,
  ];
  const today = new Date();
  return shape.map((count, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (shape.length - 1 - i));
    return { day: d.toISOString().slice(0, 10), count: empty ? 0 : count };
  });
}

export default async function DashboardPreview({
  searchParams,
}: {
  searchParams: Promise<{ empty?: string; coach?: string }>;
}) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const { empty: emptyParam, coach } = await searchParams;
  const empty = emptyParam !== undefined;

  const data: BoxDashboard = empty
    ? {
        members_active: 0,
        fill: { booked: 0, capacity: 0 },
        fill_prev: { booked: 0, capacity: 0 },
        attendance: { present: 0, total: 0 },
        attendance_prev: { present: 0, total: 0 },
        subs_expiring: coach !== undefined ? null : 0,
        activity: sampleActivity(true),
        checklist: {
          rooms: false,
          class_types: false,
          opening_hours: false,
          schedules: false,
          members: false,
          payment_link: false,
        },
      }
    : {
        members_active: 142,
        fill: { booked: 412, capacity: 528 },
        fill_prev: { booked: 360, capacity: 500 },
        attendance: { present: 318, total: 371 },
        attendance_prev: { present: 300, total: 360 },
        subs_expiring: coach !== undefined ? null : 7,
        activity: sampleActivity(false),
        checklist: {
          rooms: true,
          class_types: true,
          opening_hours: true,
          schedules: true,
          members: false,
          payment_link: false,
        },
      };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <DashboardScreen data={data} slug="demo" firstName="Camille" />
    </div>
  );
}
