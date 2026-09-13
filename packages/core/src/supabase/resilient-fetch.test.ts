import { describe, expect, it, vi } from 'vitest';

import { resilientFetch, type JournalRequete } from './resilient-fetch';

const URL_LECTURE = 'https://projet.supabase.co/rest/v1/classes?email=eq.lea@example.com';

function fauxFetch(reponses: Array<Response | Error>) {
  let appel = 0;
  const impl = vi.fn(async () => {
    const suivante = reponses[Math.min(appel, reponses.length - 1)];
    appel += 1;
    if (suivante instanceof Error) throw suivante;
    return suivante;
  });
  return impl as unknown as typeof fetch & { mock: { calls: unknown[][] } };
}

function collecteur(): { entrees: JournalRequete[]; log: (e: JournalRequete) => void } {
  const entrees: JournalRequete[] = [];
  return { entrees, log: (e) => entrees.push(e) };
}

describe('resilientFetch', () => {
  it('rejoue une lecture GET sur un 504 de passerelle, et rend le 200 suivant', async () => {
    const impl = fauxFetch([new Response('', { status: 504 }), new Response('ok')]);
    const { entrees, log } = collecteur();

    const reponse = await resilientFetch(impl, { log })(URL_LECTURE);

    expect(reponse.status).toBe(200);
    expect(impl).toHaveBeenCalledTimes(2);
    expect(entrees[0]).toMatchObject({ status: 504, attempt: 1 });
  });

  it('ne rejoue JAMAIS un POST — un 504 après écriture peut la doubler', async () => {
    const impl = fauxFetch([new Response('', { status: 504 })]);

    const reponse = await resilientFetch(impl, { log: () => undefined })(URL_LECTURE, {
      method: 'POST',
    });

    expect(reponse.status).toBe(504);
    expect(impl).toHaveBeenCalledTimes(1);
  });

  it('rejoue une lecture dont le fetch a échoué, puis relaie la dernière erreur', async () => {
    const impl = fauxFetch([new Error('réseau')]);
    const { entrees, log } = collecteur();

    await expect(resilientFetch(impl, { retries: 1, log })(URL_LECTURE)).rejects.toThrow('réseau');
    expect(impl).toHaveBeenCalledTimes(2);
    expect(entrees.map((e) => e.status)).toEqual(['ECHEC', 'ECHEC']);
  });

  it('coupe une requête qui dépasse le délai', async () => {
    const impl = ((_: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      })) as unknown as typeof fetch;

    await expect(
      resilientFetch(impl, { timeoutMs: 20, retries: 0, log: () => undefined })(URL_LECTURE),
    ).rejects.toThrow();
  });

  it('journalise une réussite lente, chemin sans query string (privacy.md)', async () => {
    const impl = fauxFetch([new Response('ok')]);
    const { entrees, log } = collecteur();

    await resilientFetch(impl, { slowMs: 0, log })(URL_LECTURE);

    expect(entrees).toHaveLength(1);
    expect(entrees[0]?.path).toBe('/rest/v1/classes');
    expect(JSON.stringify(entrees[0])).not.toContain('lea@example.com');
  });

  it('ne journalise pas une réussite rapide au premier essai', async () => {
    const impl = fauxFetch([new Response('ok')]);
    const { entrees, log } = collecteur();

    await resilientFetch(impl, { log })(URL_LECTURE);

    expect(entrees).toHaveLength(0);
  });
});
