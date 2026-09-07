#!/usr/bin/env node
/**
 * Une migration déjà présente dans la branche de référence a-t-elle changé ?
 *
 * ## Pourquoi ici et pas dans le hook
 *
 * `.claude/hooks/guard-migrations.mjs` s'exécute sur `PreToolUse(Edit|Write)`.
 * **Un script Node lancé en Bash écrit le même fichier sans qu'il le voie** —
 * c'est arrivé au renommage `D-013`, et le hook n'a pas échoué : il n'était pas
 * sur le chemin. C'est la règle des sœurs appliquée à l'outillage, sous sa forme
 * la plus coûteuse, parce qu'un garde muet **inspire confiance**.
 *
 * Élargir le hook à `Bash` aurait demandé de deviner quels fichiers une ligne de
 * commande va écrire — indécidable en général, et un garde qui se trompe est
 * pire que pas de garde. Ce contrôle-ci regarde le **résultat** au lieu de
 * l'intention : il voit toutes les écritures, quel que soit l'outil, l'agent ou
 * la main qui les a faites.
 *
 * Il ne remplace pas le hook, qui attrape l'erreur **avant** qu'elle soit
 * écrite. Il attrape ce que le hook ne peut pas voir.
 *
 * ## La bascule de la règle 13
 *
 * `CLAUDE.md` règle 13 : « Une migration déjà appliquée s'édite tant qu'aucune
 * base de production n'existe — et plus jamais après. » Aujourd'hui la CI
 * reconstruit le schéma par `supabase db reset` et il n'y a pas de production :
 * corriger en place est propre, et une migration de rattrapage laisserait une
 * cicatrice permanente dans l'historique d'un projet qui n'a jamais eu de
 * données.
 *
 * Ce contrôle **avertit** donc, il ne bloque pas. Le jour où une base de
 * production existe, on passe la constante ci-dessous à `true` et il bloque,
 * sans discussion. C'est une ligne, et elle est ici pour que la bascule ne se
 * décide pas au cas par cas le jour où elle coûtera cher.
 */

import { execFileSync } from 'node:child_process';

/**
 * **La bascule de la règle 13.** À passer à `true` le jour où une base de
 * production existe. Ce jour-là, une migration déjà versionnée ne se modifie
 * plus : on ajoute.
 */
const UNE_BASE_DE_PRODUCTION_EXISTE = false;

const DOSSIER = 'supabase/migrations';

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

/**
 * La référence à laquelle se comparer.
 *
 * En CI, `GITHUB_BASE_REF` porte la branche cible d'une pull request. En local,
 * `origin/main` si elle existe, `main` sinon — pour que la commande se lance à
 * la main sans rien configurer.
 */
function reference() {
  const explicite = process.argv[2] ?? process.env.RACK_BASE_REF;
  if (explicite) return explicite;

  const base = process.env.GITHUB_BASE_REF;
  if (base) return `origin/${base}`;

  for (const candidat of ['origin/main', 'main']) {
    try {
      git('rev-parse', '--verify', candidat);
      return candidat;
    } catch {
      // candidat suivant
    }
  }
  return null;
}

const ref = reference();
if (ref === null) {
  console.log('migrations:immuables — aucune référence de comparaison, rien à vérifier.');
  process.exit(0);
}

let base;
try {
  // `merge-base` : on compare à l'ancêtre commun, pas à la pointe de `main`.
  // Sans ça, une migration ajoutée sur `main` **après** le départ de la branche
  // ressortirait comme « supprimée » ici.
  base = git('merge-base', ref, 'HEAD');
} catch {
  console.log(
    `migrations:immuables — \`${ref}\` introuvable (clone superficiel ?), rien à vérifier.`,
  );
  process.exit(0);
}

// `--diff-filter=M` : **uniquement les fichiers modifiés**. Un ajout est le
// chemin normal, une suppression est un autre sujet (et le hook la laisse
// passer aussi).
//
// **Comparé à l'arbre de travail, pas à `HEAD`**, et le contrôle négatif l'a
// exigé : la première version lisait `base..HEAD` et ne voyait donc rien tant
// que la modification n'était pas commitée — c'est-à-dire précisément au moment
// où elle est encore facile à annuler. En CI l'arbre est propre, les deux
// formes disent la même chose ; en local, celle-ci parle plus tôt.
const modifiees = git('diff', '--name-only', '--diff-filter=M', base, '--', DOSSIER)
  .split('\n')
  .filter((ligne) => ligne.endsWith('.sql'));

const mode = UNE_BASE_DE_PRODUCTION_EXISTE ? 'BLOQUANT' : 'avertissement';

if (modifiees.length === 0) {
  console.log(
    `migrations:immuables — aucune migration déjà versionnée n'a changé depuis \`${ref}\` (mode : ${mode}).`,
  );
  process.exit(0);
}

const lignes = [
  '',
  `${modifiees.length} migration(s) déjà présente(s) dans \`${ref}\` ont été modifiées :`,
  '',
  ...modifiees.map((fichier) => `  · ${fichier}`),
  '',
  'Le défaut est de ne PAS les modifier. Une migration appliquée est immuable :',
  '  npx supabase migration new <nom_explicite>',
  '',
];

if (UNE_BASE_DE_PRODUCTION_EXISTE) {
  console.error(
    [
      ...lignes,
      'BLOQUÉ — une base de production existe (règle 13 de CLAUDE.md). On ajoute,',
      'on ne modifie plus. Il n’y a pas d’exception à discuter.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

console.warn(
  [
    ...lignes,
    'AVERTISSEMENT et non blocage — aucune base de production n’existe encore, et',
    "la règle 13 de CLAUDE.md autorise la correction en place tant que c'est vrai :",
    'la CI reconstruit le schéma par `supabase db reset`, et une migration de',
    "rattrapage laisserait une cicatrice permanente dans l'historique d'un projet",
    "qui n'a jamais eu de données.",
    '',
    'Ce message existe pour que ce soit **un choix**, pas un accident : le hook',
    'ne voit que les outils Edit et Write, celui-ci voit toutes les écritures.',
    '',
    'Le jour où une base de production existe, passer',
    '`UNE_BASE_DE_PRODUCTION_EXISTE` à `true` dans ce fichier. Il bloquera.',
    '',
  ].join('\n'),
);
process.exit(0);
