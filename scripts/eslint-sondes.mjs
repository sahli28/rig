/**
 * **Les sondes : est-ce que les interdits d'ESLint mordent encore ?**
 *
 * Une règle de lint qui ne s'applique plus ne casse rien. Elle ne dit rien non
 * plus — le lint reste vert, et c'est précisément ce qui est arrivé le
 * 3 septembre 2026 : ajouter l'interdit d'`Intl` dans un second bloc
 * `no-restricted-syntax` a **désactivé** celui de `tenantScope`, parce qu'en
 * configuration plate le dernier bloc écrase le précédent au lieu de s'y
 * ajouter. Personne ne l'aurait su sans un fichier sonde écrit à la main, puis
 * jeté.
 *
 * Ce script rend ce geste permanent. Chaque cas dit : « ce texte, à cet
 * emplacement, doit produire cette erreur — ou n'en produire aucune ». Le
 * fichier n'existe pas sur le disque : ESLint lint le texte *comme s'il* était
 * à ce chemin, donc rien à nettoyer et aucun risque qu'une sonde parte en
 * production.
 *
 * `node scripts/eslint-sondes.mjs`, ou `pnpm lint:sondes`. Fait partie de
 * `/check`.
 */

import { ESLint } from 'eslint';

const RÈGLE = 'no-restricted-syntax';

/** Les trois interdits, reconnus au début de leur message. */
const FROM = 'Accès direct à une table de box';
const INTL = '`Intl` n’est pas complet';
const CRYPTO = '`crypto` n’existe pas';

/**
 * Les sondes. `attendu` liste les interdits qui **doivent** mordre sur ce
 * texte ; tout le reste doit se taire.
 *
 * Les trois derniers cas sont les plus importants du lot : ce sont les
 * **exceptions**, et une exception trop large est un interdit supprimé.
 */
const SONDES = [
  {
    nom: 'le code partagé — un accès direct à une table de box',
    chemin: 'packages/core/src/sonde.ts',
    source: "export const x = client.from('classes');\n",
    attendu: [FROM],
  },
  {
    nom: 'le code partagé — `Intl` à l’exécution',
    chemin: 'packages/core/src/sonde.ts',
    source: "export const x = new Intl.PluralRules('fr');\n",
    attendu: [INTL],
  },
  {
    nom: 'le code partagé — `Intl` par la porte de derrière',
    chemin: 'packages/core/src/sonde.ts',
    source: 'export const x = globalThis.Intl;\n',
    attendu: [INTL],
  },
  {
    nom: 'le code partagé — `crypto`',
    chemin: 'packages/core/src/sonde.ts',
    source: 'export const x = crypto.randomUUID();\n',
    attendu: [CRYPTO],
  },
  {
    nom: 'le code partagé — `crypto` par la porte de derrière',
    chemin: 'packages/core/src/sonde.ts',
    source: 'export const x = globalThis.crypto.getRandomValues(new Uint8Array(16));\n',
    attendu: [CRYPTO],
  },
  {
    nom: 'une app mobile — les trois interdits y valent aussi',
    chemin: 'apps/mobile/lib/sonde.ts',
    source:
      "export const a = client.from('classes');\nexport const b = new Intl.PluralRules('fr');\nexport const c = crypto.randomUUID();\n",
    attendu: [FROM, INTL, CRYPTO],
  },
  {
    nom: 'une position de **type** `Intl` ne s’exécute jamais : elle passe',
    chemin: 'packages/core/src/sonde.ts',
    source: 'export function f(o: Intl.DateTimeFormatOptions): void {\n  void o;\n}\n',
    attendu: [],
  },
  {
    nom: 'une table sans `tenant_id` reste accessible : elle passe',
    chemin: 'packages/core/src/sonde.ts',
    source: "export const x = client.from('users');\n",
    attendu: [],
  },
  // ------------------------------------------------------------------
  // Les exceptions. C'est ici que se joue la panne du 3 septembre.
  // ------------------------------------------------------------------
  {
    nom: 'la porte de `tenantScope` : `from` passe, `Intl` et `crypto` mordent',
    chemin: 'packages/core/src/supabase/sonde.ts',
    source:
      "export const a = client.from('classes');\nexport const b = new Intl.PluralRules('fr');\nexport const c = crypto.randomUUID();\n",
    attendu: [INTL, CRYPTO],
  },
  {
    nom: 'la façade d’`Intl` : `Intl` passe, `from` et `crypto` mordent',
    chemin: 'packages/core/src/i18n/intl.ts',
    source:
      "export const a = client.from('classes');\nexport const b = new Intl.PluralRules('fr');\nexport const c = crypto.randomUUID();\n",
    attendu: [FROM, CRYPTO],
  },
  {
    nom: 'la façade de `crypto` : `crypto` passe, `from` et `Intl` mordent',
    chemin: 'packages/core/src/crypto.ts',
    source:
      "export const a = client.from('classes');\nexport const b = new Intl.PluralRules('fr');\nexport const c = crypto.randomUUID();\n",
    attendu: [FROM, INTL],
  },
];

/**
 * Le nom de l'interdit qu'un message annonce.
 *
 * On reconnaît le **début** du message plutôt que le message entier : celui-ci
 * dit *pourquoi*, il est long, et il changera. Ce qui ne doit pas changer, c'est
 * lequel des trois a parlé. Les apostrophes sont normalisées — le fichier de
 * configuration les écrit typographiques, la comparaison ne doit pas s'y jouer.
 */
function interditDe(message) {
  const texte = message.replaceAll('’', "'");
  const trouvé = [FROM, INTL, CRYPTO].find((m) => texte.startsWith(m.replaceAll('’', "'")));
  return trouvé ?? `(message inconnu) ${texte.slice(0, 40)}`;
}

const eslint = new ESLint();
let échecs = 0;

for (const sonde of SONDES) {
  const [résultat] = await eslint.lintText(sonde.source, { filePath: sonde.chemin });
  const obtenus = (résultat?.messages ?? [])
    .filter((m) => m.ruleId === RÈGLE)
    .map((m) => interditDe(m.message))
    .sort();
  const voulus = [...sonde.attendu].sort();

  if (JSON.stringify(obtenus) === JSON.stringify(voulus)) {
    console.log(`  ok   ${sonde.nom}`);
    continue;
  }

  échecs += 1;
  console.error(`  ÉCHEC ${sonde.nom}`);
  console.error(`         attendu : ${voulus.length ? voulus.join(' | ') : '(rien)'}`);
  console.error(`         obtenu  : ${obtenus.length ? obtenus.join(' | ') : '(rien)'}`);
}

if (échecs > 0) {
  console.error(
    `\n${échecs} sonde(s) en échec. Un interdit qui ne mord plus laisse le lint vert :\n` +
      "relire les blocs `no-restricted-syntax` d'eslint.config.mjs — en configuration plate,\n" +
      'un bloc qui redéclare la règle **écrase** le précédent au lieu de s’y ajouter.',
  );
  process.exit(1);
}

console.log(`\n${SONDES.length} sondes, toutes mordantes.`);
