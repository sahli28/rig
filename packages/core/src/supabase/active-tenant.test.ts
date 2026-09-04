import { describe, expect, it } from 'vitest';
import type { RackClient } from './client';
import { tenantScope } from './active-tenant';

interface Call {
  table: string;
  op: 'select' | 'insert' | 'update';
  payload?: unknown;
  filters: [string, unknown][];
}

/**
 * Client simulé, réduit à ce que le helper enchaîne. Le vrai constructeur de
 * requête ne part sur le réseau qu'à l'`await` : on n'attend jamais, donc on
 * n'a besoin ici que de retenir les appels.
 */
function fakeClient() {
  const calls: Call[] = [];

  function chain(call: Call) {
    const builder = {
      eq(column: string, value: unknown) {
        call.filters.push([column, value]);
        return builder;
      },
      // `currentTenant()` termine par là ; le test n'inspecte que les appels.
      maybeSingle() {
        return builder;
      },
    };
    return builder;
  }

  const client = {
    from(table: string) {
      return {
        select(columns: string) {
          return chain(record({ table, op: 'select', payload: columns, filters: [] }));
        },
        insert(payload: unknown) {
          return chain(record({ table, op: 'insert', payload, filters: [] }));
        },
        update(payload: unknown) {
          return chain(record({ table, op: 'update', payload, filters: [] }));
        },
      };
    },
  };

  function record(call: Call): Call {
    calls.push(call);
    return call;
  }

  return { client: client as unknown as RackClient, calls };
}

const TENANT = '11111111-0000-4000-8000-000000000001';

describe('tenantScope', () => {
  it('filtre toute lecture sur la box active', () => {
    const { client, calls } = fakeClient();

    tenantScope(client, TENANT).select('invitations');

    expect(calls[0]?.op).toBe('select');
    expect(calls[0]?.filters).toEqual([['tenant_id', TENANT]]);
  });

  it('impose le tenant_id à l’insertion, même contredit par l’appelant', () => {
    const { client, calls } = fakeClient();
    const autreBox = '22222222-0000-4000-8000-000000000002';

    tenantScope(client, TENANT).insert('invitations', {
      tenant_id: autreBox,
      token_hash: 'tok',
      expires_at: '2026-09-30T10:00:00Z',
    });

    // Le cas réel n'est pas la malveillance mais la recopie : un objet lu dans
    // une box, modifié, réinséré dans l'écran d'une autre.
    expect(calls[0]?.payload).toEqual([
      { tenant_id: TENANT, token_hash: 'tok', expires_at: '2026-09-30T10:00:00Z' },
    ]);
  });

  it('accepte un objet seul comme un tableau', () => {
    const { client, calls } = fakeClient();

    tenantScope(client, TENANT).insert('invitations', [
      { tenant_id: TENANT, token_hash: 'a', expires_at: '2026-09-30T10:00:00Z' },
      { tenant_id: TENANT, token_hash: 'b', expires_at: '2026-09-30T10:00:00Z' },
    ]);

    expect(calls[0]?.payload).toHaveLength(2);
  });

  it('borne toute écriture à la box active', () => {
    const { client, calls } = fakeClient();

    tenantScope(client, TENANT).update('invitations', { status: 'REVOKED' });

    expect(calls[0]?.payload).toEqual({ status: 'REVOKED' });
    expect(calls[0]?.filters).toEqual([['tenant_id', TENANT]]);
  });

  it('ne laisse pas un patch déplacer la ligne dans une autre box', () => {
    const { client, calls } = fakeClient();
    const autreBox = '22222222-0000-4000-8000-000000000002';

    tenantScope(client, TENANT).update('invitations', {
      status: 'REVOKED',
      tenant_id: autreBox,
    });

    // Filtrer ne suffit pas : le filtre dit quelles lignes sont modifiables,
    // pas ce qu'on a le droit d'y écrire. Et la RLS laisse passer — son
    // `with check` accepte toute box de `current_tenant_ids()`, donc les deux
    // boxes d'un membre inscrit dans deux boxes.
    expect(calls[0]?.payload).toEqual({ status: 'REVOKED' });
    expect(calls[0]?.payload).not.toHaveProperty('tenant_id');
    expect(calls[0]?.filters).toEqual([['tenant_id', TENANT]]);
  });

  it('n’écrase pas le patch quand il ne porte pas de tenant_id', () => {
    const { client, calls } = fakeClient();

    tenantScope(client, TENANT).update('invitations', { status: 'REVOKED', token_hash: 'tok' });

    expect(calls[0]?.payload).toEqual({ status: 'REVOKED', token_hash: 'tok' });
  });

  it('écrit la box active, et retire `id` du patch', () => {
    const { client, calls } = fakeClient();

    tenantScope(client, TENANT).updateCurrentTenant({ name: 'CF Rueil', id: 'autre-box' });

    expect(calls[0]?.table).toBe('tenants');
    expect(calls[0]?.payload).toEqual({ name: 'CF Rueil' });
    expect(calls[0]?.filters).toEqual([['id', TENANT]]);
  });

  it('expose la box active pour les appels qui ne passent pas par lui', () => {
    const { client } = fakeClient();
    expect(tenantScope(client, TENANT).tenantId).toBe(TENANT);
  });

  it('refuse au typecheck une table sans tenant_id', () => {
    const { client } = fakeClient();

    // @ts-expect-error `users` n'a pas de tenant_id : la filtrer n'aurait aucun
    // sens, et le helper ne doit pas laisser croire qu'il protège quoi que ce soit.
    tenantScope(client, TENANT).select('users');
  });

  it('accepte une vue de box en lecture', () => {
    const { client, calls } = fakeClient();

    tenantScope(client, TENANT).selectView('member_admin_directory');

    expect(calls[0]?.filters).toEqual([['tenant_id', TENANT]]);
  });

  it('refuse au typecheck d’écrire dans une vue', () => {
    const { client } = fakeClient();

    // @ts-expect-error une vue ne s'écrit pas : `insert` et `update` restent
    // bornés aux tables, si bien que l'erreur arrive au typecheck et non en base.
    tenantScope(client, TENANT).insert('member_admin_directory', { tenant_id: TENANT });
  });

  it('filtre la box elle-même sur id, faute de colonne tenant_id', () => {
    const { client, calls } = fakeClient();

    tenantScope(client, TENANT).currentTenant();

    // `tenants` n'a pas de `tenant_id` — sa clé primaire *est* l'identifiant —
    // mais elle relève du même piège : `select()` sans filtre rend toutes les
    // boxes de la personne.
    expect(calls[0]?.table).toBe('tenants');
    expect(calls[0]?.filters).toEqual([['id', TENANT]]);
  });
});
