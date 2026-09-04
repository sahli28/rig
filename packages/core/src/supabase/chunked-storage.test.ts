import { describe, expect, it } from 'vitest';
import { chunkedStore, splitIntoChunks, type KeyValueStore } from './chunked-storage';

/**
 * Trousseau simulé : il **refuse** au-delà de la limite, là où
 * `expo-secure-store` se contente aujourd'hui d'un avertissement. Un test qui
 * accepterait silencieusement une valeur trop grande ne prouverait rien.
 */
function fakeSecureStore(maxBytes = 2048) {
  const values = new Map<string, string>();
  const encoder = new TextEncoder();

  const store: KeyValueStore = {
    getItem: (key) => Promise.resolve(values.get(key) ?? null),
    setItem: (key, value) => {
      const size = encoder.encode(value).length;
      if (size > maxBytes) {
        return Promise.reject(new Error(`valeur de ${size} octets, limite ${maxBytes}`));
      }
      values.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key) => {
      values.delete(key);
      return Promise.resolve();
    },
  };

  return { store, values };
}

/** Une session Supabase réaliste : deux jetons et un objet utilisateur. */
function sessionOfSize(bytes: number): string {
  return JSON.stringify({ access_token: 'a'.repeat(bytes), token_type: 'bearer' });
}

describe('splitIntoChunks', () => {
  it('rend un seul morceau quand la valeur tient', () => {
    expect(splitIntoChunks('court', 100)).toEqual(['court']);
  });

  it('respecte la limite en octets, pas en caractères', () => {
    // « é » pèse deux octets : quatre caractères saturent une limite de huit.
    const chunks = splitIntoChunks('ééééé', 8);
    expect(chunks).toEqual(['éééé', 'é']);
  });

  it('ne coupe jamais un caractère en deux', () => {
    const emoji = '🏋️‍♀️🏋️‍♀️🏋️‍♀️';
    const chunks = splitIntoChunks(emoji, 7);
    expect(chunks.join('')).toBe(emoji);
    for (const chunk of chunks) {
      expect(chunk).not.toContain('�');
    }
  });

  it('rend un tableau vide pour une chaîne vide', () => {
    expect(splitIntoChunks('', 10)).toEqual([]);
  });

  it('refuse une limite absurde plutôt que de boucler', () => {
    expect(() => splitIntoChunks('x', 0)).toThrow();
  });
});

describe('chunkedStore', () => {
  it('écrit et relit une session que le trousseau refuserait en un bloc', async () => {
    const { store } = fakeSecureStore();
    const chunked = chunkedStore(store);
    const session = sessionOfSize(6000);

    await expect(store.setItem('brut', session)).rejects.toThrow();

    await chunked.setItem('rack.session', session);
    expect(await chunked.getItem('rack.session')).toBe(session);
  });

  it('laisse une petite valeur lisible telle quelle', async () => {
    const { store, values } = fakeSecureStore();
    const chunked = chunkedStore(store);

    await chunked.setItem('rack.locale', 'fr');

    expect(values.get('rack.locale')).toBe('fr');
    expect(await chunked.getItem('rack.locale')).toBe('fr');
  });

  it('relit une valeur écrite avant le découpage', async () => {
    const { store } = fakeSecureStore();
    await store.setItem('rack.session', 'écrite par une version antérieure');

    expect(await chunkedStore(store).getItem('rack.session')).toBe(
      'écrite par une version antérieure',
    );
  });

  it('ne laisse aucun morceau orphelin quand la valeur rétrécit', async () => {
    const { store, values } = fakeSecureStore();
    const chunked = chunkedStore(store, { maxBytes: 10 });

    await chunked.setItem('k', 'a'.repeat(100));
    await chunked.setItem('k', 'a'.repeat(20));

    expect(await chunked.getItem('k')).toBe('a'.repeat(20));
    expect([...values.keys()].filter((key) => key.startsWith('k.'))).toHaveLength(2);
  });

  it('nettoie les morceaux quand la valeur redevient petite', async () => {
    const { store, values } = fakeSecureStore();
    const chunked = chunkedStore(store, { maxBytes: 10 });

    await chunked.setItem('k', 'a'.repeat(100));
    await chunked.setItem('k', 'court');

    expect(await chunked.getItem('k')).toBe('court');
    expect([...values.keys()]).toEqual(['k']);
  });

  it('efface manifeste et morceaux', async () => {
    const { store, values } = fakeSecureStore();
    const chunked = chunkedStore(store, { maxBytes: 10 });

    await chunked.setItem('k', 'a'.repeat(100));
    await chunked.removeItem('k');

    expect(values.size).toBe(0);
    expect(await chunked.getItem('k')).toBeNull();
  });

  it('rend `null` plutôt qu’une session tronquée si un morceau manque', async () => {
    const { store } = fakeSecureStore();
    const chunked = chunkedStore(store, { maxBytes: 10 });

    await chunked.setItem('k', 'a'.repeat(100));
    await store.removeItem('k.3');

    // Le SDK redemandera une connexion, au lieu de rafraîchir sans fin un
    // jeton qui ne se décodera jamais.
    expect(await chunked.getItem('k')).toBeNull();
  });

  it('rend `null` pour une clé absente', async () => {
    const { store } = fakeSecureStore();
    expect(await chunkedStore(store).getItem('jamais-écrite')).toBeNull();
  });
});
