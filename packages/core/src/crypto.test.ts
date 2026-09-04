import { afterEach, describe, expect, it } from 'vitest';
import {
  installRandomBytesSource,
  installedRandomBytesSource,
  randomBytes,
  uuidV7,
  type RandomBytesSource,
} from './crypto';

/**
 * **La seconde moitié du test d'amputation**, l'autre étant `i18n/intl.test.ts`.
 *
 * Même technique et même raison : on ne peut pas exécuter Hermes ici — `hermesc`
 * est un compilateur et refuse d'exécuter — mais on peut **retirer ce qu'Hermes
 * n'a pas et vérifier que le code s'en passe**. C'est une simulation de
 * capacité, pas de moteur ; la propriété qui compte n'est pas « Hermes a-t-il
 * `crypto` » mais « notre code en dépend-il ».
 *
 * Une différence avec `Intl`, et elle change le verdict attendu : `Intl` est
 * **incomplet** sous Hermes, `crypto` y est **absent**. Amputer `Intl` doit
 * laisser le code fonctionner ; retirer `crypto` doit le faire **lever**, fort
 * et tout de suite, tant que personne n'a installé de source. Un test qui
 * verrait un UUID sortir d'un moteur sans `crypto` prouverait qu'on s'est
 * rabattu sur `Math.random()` — le défaut, pas la réussite.
 */

const RÉEL = globalThis.crypto;

afterEach(() => {
  Object.defineProperty(globalThis, 'crypto', {
    value: RÉEL,
    configurable: true,
    writable: true,
  });
  installRandomBytesSource(null);
});

/** Ce que Hermes offre : pas de `crypto` du tout. */
function commeHermes(): void {
  Object.defineProperty(globalThis, 'crypto', {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

/** Une source d'aléa qui n'a rien d'aléatoire : 00, 01, 02… */
const sourceDéterministe: RandomBytesSource = (n) =>
  Uint8Array.from({ length: n }, (_, i) => i & 0xff);

describe('sous un moteur sans `crypto` — Hermes, donc le produit', () => {
  it('la simulation reproduit bien le manque', () => {
    // Sans ce contrôle, un test qui passe ne prouverait rien : il pourrait
    // passer parce que la simulation ne simule pas.
    commeHermes();
    expect(globalThis.crypto).toBeUndefined();
  });

  it('lève au lieu de se rabattre sur `Math.random()`', () => {
    commeHermes();
    expect(() => uuidV7()).toThrow(/installRandomBytesSource/);
    expect(() => randomBytes(16)).toThrow(/Math\.random/);
  });

  it("l'app fonctionne dès qu'elle a installé sa source — le rôle d'`expo-crypto`", () => {
    commeHermes();
    installRandomBytesSource(sourceDéterministe);
    expect(uuidV7()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('la source installée prime sur le global, même quand le global existe', () => {
    // C'est l'ordre qui compte sur mobile : le jour où une version d'Expo
    // installera un `crypto` partiel, on ne veut pas qu'il double la source
    // explicite dans notre dos.
    installRandomBytesSource(sourceDéterministe);
    expect(installedRandomBytesSource()).toBe(sourceDéterministe);
    expect(uuidV7(0)).toBe('00000000-0000-7607-8809-0a0b0c0d0e0f');
  });
});

describe('uuidV7 — la même forme que `public.uuid_generate_v7()`', () => {
  it('respecte la RFC 9562 : version 7, variante RFC 4122', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(uuidV7()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });

  it("porte l'horodatage en tête, relisible au millimètre", () => {
    // 48 bits gros-boutistes : c'est ce qui rend l'identifiant triable, et la
    // moitié qu'une implémentation rate quand elle traite l'horodatage avec les
    // opérateurs binaires de JavaScript, qui tronquent à 32 bits.
    const t = Date.parse('2026-09-04T15:44:00.123Z');
    const relu = Number.parseInt(uuidV7(t).replaceAll('-', '').slice(0, 12), 16);
    expect(relu).toBe(t);
  });

  it('se trie chronologiquement, ce qui est toute sa raison d’être', () => {
    const tôt = uuidV7(Date.parse('2026-09-04T10:00:00Z'));
    const tard = uuidV7(Date.parse('2026-09-04T10:00:01Z'));
    expect([tard, tôt].sort()).toEqual([tôt, tard]);
  });

  it('refuse un horodatage hors des 48 bits plutôt que de rendre un UUID faux', () => {
    expect(() => uuidV7(-1)).toThrow(RangeError);
    expect(() => uuidV7(2 ** 48)).toThrow(RangeError);
    expect(() => uuidV7(Number.NaN)).toThrow(RangeError);
  });

  it('deux appels ne rendent pas le même identifiant', () => {
    // La propriété qui protège la règle 4 : deux taps, deux clés — et deux
    // réservations distinctes plutôt qu'une écrasée.
    const vus = new Set(Array.from({ length: 1000 }, () => uuidV7()));
    expect(vus.size).toBe(1000);
  });
});

describe('randomBytes', () => {
  it('rend le nombre d’octets demandé', () => {
    expect(randomBytes(1)).toHaveLength(1);
    expect(randomBytes(32)).toHaveLength(32);
  });

  it('refuse une longueur qui n’a pas de sens', () => {
    expect(() => randomBytes(0)).toThrow(RangeError);
    expect(() => randomBytes(-1)).toThrow(RangeError);
    expect(() => randomBytes(1.5)).toThrow(RangeError);
  });
});
