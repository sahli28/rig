/**
 * **Le seul module du dépôt autorisé à toucher `crypto`.**
 *
 * Même forme que `i18n/intl.ts`, et écrit **avant** le premier appel plutôt
 * qu'après le premier plantage. C'est la seule différence, et c'est toute la
 * différence : les trois défauts de la famille `Intl` ont été trouvés sur un
 * appareil, celui-ci est arrêté sur le papier.
 *
 * | Ce que le moteur offre | Node / navigateur | **Hermes** |
 * | --- | --- | --- |
 * | `crypto.getRandomValues()` | ✅ | ❌ |
 * | `crypto.randomUUID()` | ✅ | ❌ |
 *
 * **`crypto` est absent sous Hermes, pas incomplet.** Le runtime « winter »
 * d'`expo@57.0.18` installe `fetch`, `URL`, `TextEncoder`, `structuredClone` et
 * les streams — pas `crypto` (lu dans `node_modules/expo/src/winter`, et absent
 * de la doc du SDK 57). Sur mobile, la source d'aléa vient donc d'une
 * dépendance, `expo-crypto`, et elle s'**installe** ici au démarrage.
 *
 * **Ce que ce module refuse de faire, et pourquoi c'est le point important.**
 * Il ne se rabat jamais sur `Math.random()`. Un repli silencieux rendrait le
 * manque invisible — exactement la classe de défaut que cette famille de
 * modules existe pour rendre visible — et il le rendrait invisible **là où ça
 * compte le plus** : une clé d'idempotence prévisible ou qui collisionne, c'est
 * la règle 4 de `CLAUDE.md` qui ne protège plus rien. Sans source d'aléa, on
 * lève, tout de suite, avec le nom de la fonction à appeler.
 *
 * L'erreur levée est une erreur de **développement**, pas un code applicatif de
 * `errors.ts` : elle ne doit jamais atteindre un membre. Elle se produit au
 * câblage, une fois, sur le premier appel — pas au hasard d'un tap.
 */

/**
 * Une source d'octets aléatoires. `expo-crypto` sur mobile, `crypto` du moteur
 * partout ailleurs.
 */
export type RandomBytesSource = (byteLength: number) => Uint8Array;

let sourceInstallée: RandomBytesSource | null = null;

/**
 * Installe la source d'aléa du moteur courant.
 *
 * **Appelée par** : `apps/mobile/app/_layout.tsx`, au démarrage, avec
 * `expo-crypto` — **ticket P1-003b**, qui ajoute la dépendance et la justifie
 * au commit (règle 7 : cette fonction n'a pas encore d'appelant, et ça se voit).
 *
 * Le web et Node n'ont rien à installer : `globalThis.crypto` y est présent, et
 * `randomBytes()` le trouve tout seul.
 *
 * `null` revient à la détection du moteur. Ce n'est pas une commodité de test
 * déguisée en API : un module qui garde un état global doit savoir le rendre,
 * sinon deux tests d'affilée ne parlent plus du même monde.
 */
export function installRandomBytesSource(source: RandomBytesSource | null): void {
  sourceInstallée = source;
}

/** Rend la source installée, ou `null`. Existe pour les tests et le diagnostic. */
export function installedRandomBytesSource(): RandomBytesSource | null {
  return sourceInstallée;
}

/**
 * **Supposition sur le moteur : aucune.** C'est la seule fonction du dépôt qui
 * lit `globalThis.crypto`, et elle ne suppose pas qu'il existe — elle regarde.
 *
 * Ordre : la source installée d'abord (le mobile la pose au démarrage), le
 * global ensuite (web, Node, harnais). Si aucune des deux, on lève : voir
 * l'en-tête de ce fichier pour ce qu'un repli sur `Math.random()` coûterait.
 */
export function randomBytes(byteLength: number): Uint8Array {
  if (!Number.isInteger(byteLength) || byteLength <= 0) {
    throw new RangeError(`randomBytes attend un entier positif, reçu ${String(byteLength)}`);
  }

  if (sourceInstallée) return sourceInstallée(byteLength);

  const duMoteur = globalThis.crypto;
  if (duMoteur && typeof duMoteur.getRandomValues === 'function') {
    return duMoteur.getRandomValues(new Uint8Array(byteLength));
  }

  throw new Error(
    "Aucune source d'aléa : ce moteur n'a pas `crypto.getRandomValues` — c'est le cas d'Hermes, " +
      "donc de l'app mobile en production. Appelez `installRandomBytesSource()` au démarrage " +
      "(sur mobile : `expo-crypto`). Aucun repli sur `Math.random()` : une clé d'idempotence " +
      'prévisible ne protège plus rien (règle 4).',
  );
}

const HEX: readonly string[] = Array.from({ length: 256 }, (_, n) =>
  n.toString(16).padStart(2, '0'),
);

/** 2⁴⁸ − 1 ms après epoch, soit le 10 août 10889. La borne de la RFC. */
const MS_MAX = 0xffffffffffff;

/**
 * Un UUID v7 (RFC 9562) — **règle 12** : tous nos identifiants le sont.
 *
 * Le pendant TypeScript de `public.uuid_generate_v7()`
 * (`supabase/migrations/20260830143104_extensions_and_helpers.sql:29`), et la
 * même disposition d'octets : 48 bits d'horodatage Unix en millisecondes en
 * tête, version 7 et variante forcées, aléatoire pour les 74 bits restants.
 * Deux implémentations, une seule forme — les identifiants restent triables
 * chronologiquement quel que soit le côté qui les crée.
 *
 * **Appelée par** : l'écran de réservation, pour la clé d'idempotence générée
 * **au tap** et conservée jusqu'à la réponse — **ticket P1-003b**. Aucun
 * appelant aujourd'hui, et le ticket le dit.
 *
 * `now` est un paramètre pour que le test puisse fixer le temps, pas pour que
 * l'appelant choisisse : personne ne le passe en production.
 */
export function uuidV7(now: number = Date.now()): string {
  const ms = Math.trunc(now);
  if (!Number.isFinite(ms) || ms < 0 || ms > MS_MAX) {
    throw new RangeError(`uuidV7 : horodatage hors des 48 bits de la RFC 9562 (${String(now)})`);
  }

  const o = randomBytes(16);
  if (o.length !== 16) {
    throw new Error(`La source d'aléa a rendu ${String(o.length)} octets au lieu de 16`);
  }

  // 48 bits d'horodatage, gros-boutiste. Les deux premiers octets passent par
  // une division : au-delà de 2³², les opérateurs binaires de JavaScript
  // tronquent, et l'horodatage vaut aujourd'hui environ 2⁴⁰·⁷.
  o[0] = Math.floor(ms / 2 ** 40) & 0xff;
  o[1] = Math.floor(ms / 2 ** 32) & 0xff;
  o[2] = (ms >>> 24) & 0xff;
  o[3] = (ms >>> 16) & 0xff;
  o[4] = (ms >>> 8) & 0xff;
  o[5] = ms & 0xff;

  o[6] = (o[6]! & 0x0f) | 0x70; // version 7
  o[8] = (o[8]! & 0x3f) | 0x80; // variante RFC 4122

  const h = (i: number): string => HEX[o[i]!]!;
  return (
    h(0) +
    h(1) +
    h(2) +
    h(3) +
    '-' +
    h(4) +
    h(5) +
    '-' +
    h(6) +
    h(7) +
    '-' +
    h(8) +
    h(9) +
    '-' +
    h(10) +
    h(11) +
    h(12) +
    h(13) +
    h(14) +
    h(15)
  );
}
