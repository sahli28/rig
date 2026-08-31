/**
 * Découpage d'une valeur trop grande pour le trousseau.
 *
 * `expo-secure-store` plafonne une valeur à **2048 octets** ; au-delà, Android
 * avertit aujourd'hui et échouera demain. Une session Supabase pèse 2 à 4 Ko :
 * jeton d'accès, jeton de rafraîchissement et objet utilisateur. Elle ne rentre
 * donc pas, et une session qui ne s'écrit pas se traduit par une déconnexion à
 * chaque redémarrage — sur un appareil seulement, ce qui se diagnostique mal.
 *
 * La parade est un découpage en morceaux, avec un manifeste à la clé d'origine.
 * La logique est pure et vit ici, pas dans l'app : elle est ainsi testable sans
 * appareil, et le mobile n'a plus qu'à brancher le trousseau.
 */

/** Le contrat minimal d'un stockage clé-valeur asynchrone. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Marqueur de manifeste. Un préfixe improbable plutôt qu'un JSON : une valeur
 * écrite avant ce découpage, ou par un autre code, ne peut pas lui ressembler
 * par accident, et se relit telle quelle.
 */
const MANIFEST_PREFIX = '__rig_chunks__:';

/** Marge sous la limite d'`expo-secure-store` : le manifeste et la clé comptent aussi. */
const DEFAULT_MAX_BYTES = 1800;

export interface ChunkedStoreOptions {
  /** Taille maximale d'un morceau, en **octets UTF-8**. */
  maxBytes?: number;
}

/** Nombre d'octets UTF-8 d'un caractère, sans allouer d'encodeur. */
function byteLength(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  if (code < 0x10000) return 3;
  return 4;
}

/**
 * Découpe sans jamais couper un caractère en deux — l'itération porte sur les
 * points de code, donc un emoji (paire de substitution) reste entier. Un
 * morceau coupé au milieu d'un caractère se relirait en `�`, et la session
 * deviendrait illisible sans que rien ne signale pourquoi.
 */
export function splitIntoChunks(value: string, maxBytes: number): string[] {
  if (maxBytes <= 0) throw new Error('maxBytes doit être positif.');

  const chunks: string[] = [];
  let current = '';
  let size = 0;

  for (const char of value) {
    const charBytes = byteLength(char);
    if (size + charBytes > maxBytes && current.length > 0) {
      chunks.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += charBytes;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Enveloppe un stockage pour qu'il accepte des valeurs de taille quelconque.
 *
 * La clé d'origine porte le manifeste `__rig_chunks__:<n>`, les morceaux vont
 * en `<clé>.0`, `<clé>.1`… Une valeur assez petite est écrite telle quelle, ce
 * qui garde lisibles les clés courtes et permet de relire ce qui existait avant.
 */
export function chunkedStore(
  store: KeyValueStore,
  options: ChunkedStoreOptions = {},
): KeyValueStore {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const chunkKey = (key: string, index: number) => `${key}.${index}`;

  /** Nombre de morceaux annoncés par le manifeste, ou `null` si la valeur est directe. */
  function manifestCount(stored: string | null): number | null {
    if (stored === null || !stored.startsWith(MANIFEST_PREFIX)) return null;
    const count = Number.parseInt(stored.slice(MANIFEST_PREFIX.length), 10);
    return Number.isInteger(count) && count >= 0 ? count : null;
  }

  async function removeChunks(key: string, from: number, to: number): Promise<void> {
    for (let index = from; index < to; index += 1) {
      await store.removeItem(chunkKey(key, index));
    }
  }

  return {
    async getItem(key) {
      const head = await store.getItem(key);
      const count = manifestCount(head);
      if (count === null) return head;

      const parts: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const part = await store.getItem(chunkKey(key, index));
        // Un morceau manquant rend la valeur entière inexploitable : mieux vaut
        // une absence franche — qui redemande une connexion — qu'une session
        // tronquée que le SDK tenterait de rafraîchir indéfiniment.
        if (part === null) return null;
        parts.push(part);
      }
      return parts.join('');
    },

    async setItem(key, value) {
      const previous = manifestCount(await store.getItem(key));
      const chunks = splitIntoChunks(value, maxBytes);

      if (chunks.length <= 1) {
        await store.setItem(key, value);
        if (previous !== null) await removeChunks(key, 0, previous);
        return;
      }

      for (const [index, chunk] of chunks.entries()) {
        await store.setItem(chunkKey(key, index), chunk);
      }
      // Le manifeste s'écrit **en dernier** : interrompue avant, la relecture
      // rend l'ancienne valeur plutôt qu'un assemblage à moitié réécrit.
      await store.setItem(key, `${MANIFEST_PREFIX}${chunks.length}`);
      if (previous !== null && previous > chunks.length) {
        await removeChunks(key, chunks.length, previous);
      }
    },

    async removeItem(key) {
      const count = manifestCount(await store.getItem(key));
      await store.removeItem(key);
      if (count !== null) await removeChunks(key, 0, count);
    },
  };
}
