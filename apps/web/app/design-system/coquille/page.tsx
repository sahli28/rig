import { notFound } from 'next/navigation';
import type { DirectoryRow } from '@rack/core/supabase';
import { Shell } from '../../box/[slug]/shell';
import { Directory } from '../../box/[slug]/staff/directory';
import staff from '../../box/[slug]/staff/staff.module.css';

/**
 * La coquille et l'écran Équipe **sans session ni base** (P2-022).
 *
 * Une sonde, donc gardée dès sa première ligne (règle 9) : hors développement,
 * cette page n'existe pas. Elle sert à regarder le back-office — volet replié,
 * menu « … », FR/EN, clair/sombre — sans dépendre d'une connexion, et c'est ce
 * qui a permis de vérifier la passe design avant toute session réelle.
 *
 * Les personnes sont inventées. Les actions sont les vraies : un clic
 * répondrait « refusé », faute de session — ce qui est le bon comportement.
 */
const LIGNES: DirectoryRow[] = [
  {
    membership_id: '00000000-0000-7000-8000-000000000001',
    user_id: '00000000-0000-7000-8000-0000000000a1',
    role: 'OWNER',
    status: 'ACTIVE',
    email: 'camille@exemple.fr',
    first_name: 'Camille',
    last_name: 'Durand',
    joined_at: '2026-01-05T09:00:00Z',
  },
  {
    membership_id: '00000000-0000-7000-8000-000000000002',
    user_id: '00000000-0000-7000-8000-0000000000a2',
    role: 'COACH',
    status: 'ACTIVE',
    email: 'hugo.perrin@exemple.fr',
    first_name: 'Hugo',
    last_name: 'Perrin',
    joined_at: '2026-02-11T09:00:00Z',
  },
  {
    membership_id: '00000000-0000-7000-8000-000000000003',
    user_id: '00000000-0000-7000-8000-0000000000a3',
    role: 'MEMBER',
    status: 'ACTIVE',
    email: 'lea.martin-de-la-villardiere@exemple.fr',
    first_name: 'Léa',
    last_name: 'Martin de la Villardière',
    joined_at: '2026-03-02T09:00:00Z',
  },
  {
    membership_id: '00000000-0000-7000-8000-000000000004',
    user_id: '00000000-0000-7000-8000-0000000000a4',
    role: 'MEMBER',
    status: 'SUSPENDED',
    email: 'noe@exemple.fr',
    first_name: 'Noé',
    last_name: 'Blanc',
    joined_at: '2026-03-20T09:00:00Z',
  },
];

export default function CoquillePreview() {
  if (process.env.NODE_ENV !== 'development') notFound();

  return (
    <Shell slug="demo" boxName="CrossFit Rueil" role="OWNER">
      <div className={staff.page}>
        <Directory
          slug="demo"
          rows={LIGNES}
          actorRole="OWNER"
          accessByMembership={{
            '00000000-0000-7000-8000-000000000002': '2026-12-31',
            '00000000-0000-7000-8000-000000000003': '2026-10-15',
          }}
        />
      </div>
    </Shell>
  );
}
