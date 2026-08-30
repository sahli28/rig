#!/usr/bin/env node
/**
 * Vérifie la santé des fichiers de traduction :
 *  1. parité — toute clé existe dans les deux langues ;
 *  2. orphelines — toute clé déclarée est réellement appelée dans le code ;
 *  3. placeholders — les deux langues attendent les mêmes valeurs.
 *
 * Le point 1 est déjà couvert au typecheck (`satisfies Messages`), mais pas
 * dans l'autre sens : une clé en trop côté anglais y passerait inaperçue.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const LOCALES_DIR = join(ROOT, 'packages/core/src/i18n/locales');
const SOURCE_DIRS = ['apps', 'packages'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const IGNORED_DIRS = new Set(['node_modules', '.next', '.expo', 'dist', 'build', '.turbo']);

/** Suffixes ajoutés par Intl.PluralRules. Le code appelle la clé sans suffixe. */
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

const problems = [];

function loadLocale(name) {
  return JSON.parse(readFileSync(join(LOCALES_DIR, `${name}.json`), 'utf8'));
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (SOURCE_EXTENSIONS.has(extname(entry))) yield full;
  }
}

function baseKey(key) {
  for (const suffix of PLURAL_SUFFIXES) {
    if (key.endsWith(suffix)) return key.slice(0, -suffix.length);
  }
  return key;
}

function placeholdersOf(message) {
  return [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

const fr = loadLocale('fr');
const en = loadLocale('en');

// 1. Parité des clés, dans les deux sens.
for (const key of Object.keys(fr)) {
  if (!(key in en)) problems.push(`clé absente en EN : ${key}`);
}
for (const key of Object.keys(en)) {
  if (!(key in fr)) problems.push(`clé absente en FR : ${key}`);
}

// 2. Placeholders identiques : « {position} » d'un côté et « {rank} » de
//    l'autre produit une phrase trouée dans une seule langue.
for (const key of Object.keys(fr)) {
  if (!(key in en)) continue;
  const inFr = placeholdersOf(fr[key]).join(',');
  const inEn = placeholdersOf(en[key]).join(',');
  if (inFr !== inEn) {
    problems.push(`placeholders divergents sur ${key} — FR {${inFr}} vs EN {${inEn}}`);
  }
}

// 3. Clés orphelines : déclarées mais jamais appelées.
const used = new Set();
for (const dir of SOURCE_DIRS) {
  const full = join(ROOT, dir);
  try {
    statSync(full);
  } catch {
    continue;
  }
  for (const file of walk(full)) {
    const source = readFileSync(file, 'utf8');
    // Capture t('x'), translate(locale, 'x') et toute chaîne ressemblant à une clé.
    for (const match of source.matchAll(/['"`]([a-z0-9_]+(?:\.[a-z0-9_]+)+)['"`]/gi)) {
      used.add(match[1]);
    }
  }
}

for (const key of Object.keys(fr)) {
  if (!used.has(key) && !used.has(baseKey(key))) {
    problems.push(`clé orpheline, déclarée mais jamais appelée : ${key}`);
  }
}

if (problems.length > 0) {
  console.error(`i18n:check — ${problems.length} problème(s)\n`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error('\nCorrige les fichiers de packages/core/src/i18n/locales/.');
  process.exit(1);
}

const count = Object.keys(fr).length;
console.log(`i18n:check — ${count} clés, FR et EN alignées, aucune orpheline.`);
