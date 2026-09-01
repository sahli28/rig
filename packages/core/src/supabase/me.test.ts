import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  MeSchema,
  REQUIRED_ACTIONS,
  chooseActiveTenant,
  findMembershipBySlug,
  hasRequiredAction,
  type Me,
  type Membership,
} from './me';

const MIGRATIONS = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));

function readMigrations(): string {
  return readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => readFileSync(`${MIGRATIONS}${file}`, 'utf8'))
    .join('\n');
}

/** Réponse représentative de `me()`, telle que la fonction SQL la construit. */
function payload(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: '33333333-0000-4000-8000-000000000001',
      email: 'lea@example.com',
      first_name: 'Léa',
      last_name: 'Martin',
      locale: 'fr',
      avatar_url: null,
    },
    memberships: [
      {
        id: '44444444-0000-4000-8000-000000000001',
        tenant_id: 'aaaaaaaa-0000-4000-8000-000000000001',
        tenant_name: 'CrossFit Bastille',
        tenant_slug: 'crossfit-bastille',
        role: 'MEMBER',
        status: 'ACTIVE',
        joined_at: '2026-08-31T09:12:44.512345+00:00',
      },
    ],
    current_tenant: null,
    required_actions: [],
    ...overrides,
  };
}

const CURRENT_TENANT = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  slug: 'crossfit-bastille',
  name: 'CrossFit Bastille',
  timezone: 'Europe/Paris',
  currency: 'EUR',
  role: 'MEMBER',
  theme: {
    app_name: 'CrossFit Bastille',
    logo_url: null,
    primary: '#E4572E',
    radius: 12,
    font: 'Inter',
  },
  booking_rules: {
    open_days_before: 7,
    close_minutes_before: 15,
    cancel_window_minutes: 120,
    max_upcoming_bookings: 10,
  },
};

describe('MeSchema', () => {
  it('accepte une session sans box active', () => {
    const me = MeSchema.parse(payload());
    expect(me.current_tenant).toBeNull();
    expect(me.memberships[0]?.tenant_slug).toBe('crossfit-bastille');
  });

  it('accepte une session avec box active, thème et règles', () => {
    const me = MeSchema.parse(payload({ current_tenant: CURRENT_TENANT }));
    expect(me.current_tenant?.theme.primary).toBe('#E4572E');
    expect(me.current_tenant?.booking_rules.cancel_window_minutes).toBe(120);
    expect(me.current_tenant?.timezone).toBe('Europe/Paris');
  });

  it('échoue en nommant le champ quand la forme dérive', () => {
    const drifted = payload({ current_tenant: { ...CURRENT_TENANT, theme: undefined } });
    expect(() => MeSchema.parse(drifted)).toThrow(/theme/);
  });

  it('tolère une action inconnue plutôt que de faire échouer tout le démarrage', () => {
    // Une action ajoutée en base avant que le client la gère ne doit pas
    // laisser l'app sur un écran blanc.
    const me = MeSchema.parse(payload({ required_actions: ['ACCEPT_CONSENTS', 'VERIFY_PHONE'] }));
    expect(me.required_actions).toContain('VERIFY_PHONE');
    expect(hasRequiredAction(me, 'ACCEPT_CONSENTS')).toBe(true);
  });

  it('rejette une appartenance au rôle inconnu', () => {
    const bad = payload({
      memberships: [{ ...payload().memberships[0], role: 'ADMIN' }],
    });
    expect(() => MeSchema.parse(bad)).toThrow();
  });
});

describe('required_actions', () => {
  it('couvre toutes les actions que la migration peut ajouter', () => {
    const raised = new Set(
      [...readMigrations().matchAll(/array_append\(v_actions,\s*'([A-Z_]+)'\)/g)].map(
        (match) => match[1],
      ),
    );

    expect(raised.size).toBeGreaterThan(0);
    for (const action of raised) {
      expect(REQUIRED_ACTIONS as readonly string[], `action non gérée : ${action}`).toContain(
        action,
      );
    }
  });
});

describe('findMembershipBySlug', () => {
  const me = MeSchema.parse(payload());

  it('retrouve une box à soi par son slug', () => {
    expect(findMembershipBySlug(me, 'crossfit-bastille')?.tenant_id).toBe(
      'aaaaaaaa-0000-4000-8000-000000000001',
    );
  });

  it('ne trouve rien pour une box où l’on n’est pas', () => {
    // Le cas qui compte : la box existe et est active, mais elle n'est pas à
    // nous. « Inconnue » et « refusée » doivent être indiscernables — c'est
    // pourquoi la résolution passe par les appartenances et non par
    // `tenant_public_profile()`, qui aurait répondu.
    expect(findMembershipBySlug(me, 'crossfit-nanterre')).toBeNull();
  });

  it('ne trouve rien pour un slug inexistant', () => {
    expect(findMembershipBySlug(me, 'nexiste-pas')).toBeNull();
  });

  it('est sensible à la casse, comme les slugs', () => {
    // Les slugs sont contraints en minuscules par `create_tenant()` : accepter
    // une variante de casse ferait exister deux URL pour la même box.
    expect(findMembershipBySlug(me, 'CrossFit-Bastille')).toBeNull();
  });

  it('ne trouve rien quand on n’a aucune box', () => {
    expect(findMembershipBySlug(MeSchema.parse(payload({ memberships: [] })), 'x')).toBeNull();
  });
});

describe('chooseActiveTenant', () => {
  function membership(tenantId: string): Membership {
    return {
      id: `44444444-0000-4000-8000-${tenantId.slice(-12)}`,
      tenant_id: tenantId,
      tenant_name: 'Box',
      tenant_slug: 'box',
      role: 'MEMBER',
      status: 'ACTIVE',
      joined_at: '2026-08-31T09:12:44+00:00',
    };
  }

  const a = 'aaaaaaaa-0000-4000-8000-000000000001';
  const b = 'bbbbbbbb-0000-4000-8000-000000000002';

  it('n’active rien sans appartenance', () => {
    expect(chooseActiveTenant([], null)).toBeNull();
  });

  it('active la box unique', () => {
    expect(chooseActiveTenant([membership(a)], null)).toBe(a);
  });

  it('rend la box mémorisée quand elle est toujours une des siennes', () => {
    expect(chooseActiveTenant([membership(a), membership(b)], b)).toBe(b);
  });

  it('n’active rien entre deux boxes sans préférence', () => {
    // Le cas qui compte : choisir « la plus ancienne » afficherait les données
    // d'une box sous le nom d'une autre. L'écran doit demander.
    expect(chooseActiveTenant([membership(a), membership(b)], null)).toBeNull();
  });

  it('ignore une box mémorisée qu’on a quittée', () => {
    expect(chooseActiveTenant([membership(a)], b)).toBe(a);
    expect(
      chooseActiveTenant([membership(a), membership(b)], 'cccccccc-0000-4000-8000-0003'),
    ).toBeNull();
  });
});

describe('hasRequiredAction', () => {
  it('distingue une action présente d’une action absente', () => {
    const me: Me = MeSchema.parse(payload({ required_actions: ['COMPLETE_PROFILE'] }));
    expect(hasRequiredAction(me, 'COMPLETE_PROFILE')).toBe(true);
    expect(hasRequiredAction(me, 'ACCEPT_CONSENTS')).toBe(false);
  });
});
