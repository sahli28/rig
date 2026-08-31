import { describe, expect, it } from 'vitest';
import type { RigClient } from './client';
import {
  CONSENT_PURPOSES,
  PLATFORM_CONSENT_PURPOSES,
  ProfilePatchSchema,
  isPlatformConsent,
  recordConsents,
  updateProfile,
} from './profile';

interface Call {
  table: string;
  op: 'insert' | 'update';
  payload: unknown;
  filters: [string, unknown][];
}

/** Client simulé : les constructeurs de requête se résolvent en succès. */
function fakeClient() {
  const calls: Call[] = [];
  const ok = Promise.resolve({ data: null, error: null });

  const client = {
    from(table: string) {
      return {
        insert(payload: unknown) {
          calls.push({ table, op: 'insert', payload, filters: [] });
          return ok;
        },
        update(payload: unknown) {
          const call: Call = { table, op: 'update', payload, filters: [] };
          calls.push(call);
          return {
            eq(column: string, value: unknown) {
              call.filters.push([column, value]);
              return ok;
            },
          };
        },
      };
    },
  };

  return { client: client as unknown as RigClient, calls };
}

const USER = '33333333-0000-4000-8000-000000000001';
const TENANT = 'aaaaaaaa-0000-4000-8000-000000000001';

describe('ProfilePatchSchema', () => {
  it('exige un prénom non vide', () => {
    expect(() => ProfilePatchSchema.parse({ first_name: '   ' })).toThrow();
  });

  it('élague les espaces autour du prénom', () => {
    expect(ProfilePatchSchema.parse({ first_name: '  Léa  ' }).first_name).toBe('Léa');
  });

  it('n’accepte que les langues du produit', () => {
    expect(() => ProfilePatchSchema.parse({ first_name: 'Léa', locale: 'de' })).toThrow();
  });
});

describe('updateProfile', () => {
  it('n’écrit que les colonnes fournies', async () => {
    const { client, calls } = fakeClient();

    await updateProfile(client, USER, { first_name: 'Léa' });

    // Une clé à `undefined` deviendrait un `null` côté PostgREST : le nom de
    // famille saisi hier disparaîtrait en corrigeant son prénom aujourd'hui.
    expect(calls[0]?.payload).toEqual({ first_name: 'Léa' });
    expect(Object.keys(calls[0]?.payload as object)).toEqual(['first_name']);
  });

  it('écrit les colonnes explicitement nulles', async () => {
    const { client, calls } = fakeClient();

    await updateProfile(client, USER, { first_name: 'Léa', last_name: null });

    expect(calls[0]?.payload).toEqual({ first_name: 'Léa', last_name: null });
  });

  it('filtre sur la personne connectée', async () => {
    const { client, calls } = fakeClient();

    await updateProfile(client, USER, { first_name: 'Léa' });

    expect(calls[0]?.table).toBe('users');
    expect(calls[0]?.filters).toEqual([['id', USER]]);
  });
});

describe('isPlatformConsent', () => {
  it('range les CGU et la confidentialité côté plateforme', () => {
    expect(isPlatformConsent('TERMS')).toBe(true);
    expect(isPlatformConsent('PRIVACY')).toBe(true);
  });

  it('range tout le reste côté box', () => {
    for (const purpose of CONSENT_PURPOSES) {
      if (PLATFORM_CONSENT_PURPOSES.includes(purpose)) continue;
      expect(isPlatformConsent(purpose), purpose).toBe(false);
    }
  });
});

describe('recordConsents', () => {
  it('écrit les consentements de plateforme sans box', async () => {
    const { client, calls } = fakeClient();

    await recordConsents(client, {
      userId: USER,
      tenantId: TENANT,
      policyVersion: '2026-08-01',
      choices: [
        { purpose: 'TERMS', granted: true },
        { purpose: 'PRIVACY', granted: true },
      ],
    });

    // `tenant_id` nul : la box n'est pas responsable de traitement des CGU RIG
    // et n'a donc pas à les voir (`.claude/rules/privacy.md`).
    expect(calls[0]?.payload).toEqual([
      {
        user_id: USER,
        tenant_id: null,
        purpose: 'TERMS',
        granted: true,
        policy_version: '2026-08-01',
      },
      {
        user_id: USER,
        tenant_id: null,
        purpose: 'PRIVACY',
        granted: true,
        policy_version: '2026-08-01',
      },
    ]);
  });

  it('rattache les consentements de box à la box active', async () => {
    const { client, calls } = fakeClient();

    await recordConsents(client, {
      userId: USER,
      tenantId: TENANT,
      policyVersion: '2026-08-01',
      choices: [
        { purpose: 'PUSH', granted: false },
        { purpose: 'LEADERBOARD', granted: true },
      ],
    });

    const rows = calls[0]?.payload as { tenant_id: string | null; granted: boolean }[];
    expect(rows.map((row) => row.tenant_id)).toEqual([TENANT, TENANT]);
    // Un refus s'écrit, il ne s'omet pas : sans la ligne, rien ne distingue
    // « a refusé » de « n'a pas encore vu l'écran ».
    expect(rows.map((row) => row.granted)).toEqual([false, true]);
  });

  it('refuse d’écrire un consentement de box sans box', async () => {
    const { client, calls } = fakeClient();

    await expect(
      recordConsents(client, {
        userId: USER,
        tenantId: null,
        policyVersion: '2026-08-01',
        choices: [{ purpose: 'PUSH', granted: true }],
      }),
    ).rejects.toThrow(/box active/);

    expect(calls).toHaveLength(0);
  });

  it('n’appelle pas la base pour une liste vide', async () => {
    const { client, calls } = fakeClient();

    await recordConsents(client, {
      userId: USER,
      tenantId: TENANT,
      policyVersion: '2026-08-01',
      choices: [],
    });

    expect(calls).toHaveLength(0);
  });
});
