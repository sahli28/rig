#!/usr/bin/env node
/**
 * L'hébergé porte-t-il les migrations du dépôt ? (`P1-023`)
 *
 * ## Pourquoi ce contrôle existe
 *
 * Le 12 septembre 2026, en répétant la mise en service, la base hébergée avait
 * **sept migrations de retard** — deux tickets entiers — et rien ne l'avait dit :
 * `db push` est un geste manuel, une fusion sur `main` ne pousse rien, et une CI
 * verte parle du dépôt, jamais de la production. L'écart s'est découvert en
 * butant dessus. Ce script est le plus petit filet qui rende ce silence visible :
 * comme `migrations:immuables` (D-014), il regarde le **résultat** — ce que la
 * base hébergée porte réellement — au lieu de l'intention.
 *
 * ## Ce qu'il couvre, et ce qu'il ne couvre pas
 *
 * Il compare `supabase/migrations/` à `supabase_migrations.schema_migrations`
 * du projet **lié** (`supabase link`), en lecture seule, dans les deux sens :
 * une migration du dépôt absente de l'hébergé (**en retard**), et une migration
 * de l'hébergé inconnue du dépôt (**pire** : quelque chose est parti en prod
 * hors du dépôt). Les deux autres écarts du 12 septembre — le build web périmé,
 * la Site URL de Supabase Auth — restent sur la **checklist manuelle** de
 * `docs/procedures/deploiement-heberge.md` : un vert ici ne dit rien d'eux.
 *
 * ## Les issues (règle 10 : nommées, jamais une impression)
 *
 * - **exit 0** — À JOUR : N migrations, l'hébergé porte exactement celles du
 *   dépôt. (N est imprimé : un « à jour » sur zéro migration serait un aveugle
 *   qui se croit voyant.)
 * - **exit 1** — DÉRIVE : la ou les migrations en cause, listées, par sens.
 * - **exit 2** — ILLISIBLE : le CLI a échoué, le JSON manque, ou ce que le CLI
 *   dit du local ne recoupe pas `supabase/migrations/` (le contrôle ne voit pas
 *   ce que le dépôt voit). **Ne rien conclure d'un exit 2** — surtout pas un
 *   vert : un contrôle qui ne peut pas regarder ne rend pas de verdict.
 *
 * Prérequis : `supabase link` fait sur cette machine (le mot de passe vit dans
 * le trousseau — voir `deploiement-heberge.md`). En CI, il faudrait un secret
 * `SUPABASE_DB_PASSWORD` : non câblé, le contrôle est un geste (le même statut
 * que `db push`, dont il vérifie l'oubli).
 */

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const VERSION_RE = /^(\d{14})_.+\.sql$/;

/** Les versions du dépôt — la moitié que le CLI doit recouper exactement. */
function versionsDuDepot() {
  return readdirSync('supabase/migrations')
    .map((f) => VERSION_RE.exec(f)?.[1])
    .filter((v) => v !== undefined)
    .sort();
}

function illisible(raison) {
  console.error('HÉBERGÉ : ILLISIBLE — ne rien conclure (surtout pas un vert).');
  console.error(`  ${raison}`);
  console.error('  À la main : pnpm exec supabase migration list --linked');
  process.exit(2);
}

const depot = versionsDuDepot();

const cli = spawnSync('supabase', ['migration', 'list', '--linked', '--output-format', 'json'], {
  shell: true,
  encoding: 'utf8',
  timeout: 120_000,
});

if (cli.error || cli.status !== 0) {
  illisible(
    cli.error?.message ??
      `le CLI a rendu ${cli.status} : ${(cli.stderr ?? '').trim().split('\n').at(-1) ?? ''}`,
  );
}

// Le JSON est une ligne au milieu d'un stdout bavard (« Connecting… », rappel de
// version) : on prend du premier `{` au dernier `}`, et on échoue **bruyamment**
// si ça ne se lit pas — jamais de repli silencieux.
const brut = cli.stdout ?? '';
const json = brut.slice(brut.indexOf('{'), brut.lastIndexOf('}') + 1);
let migrations;
try {
  migrations = JSON.parse(json).migrations;
  if (!Array.isArray(migrations)) throw new Error('pas de tableau `migrations`');
} catch (e) {
  illisible(`sortie du CLI non lisible en JSON (${e.message}).`);
}

const localesVuesParLeCli = migrations
  .map((m) => m.local)
  .filter(Boolean)
  .sort();

// Auto-recoupement : si le CLI ne voit pas exactement les fichiers du dépôt, le
// parseur ou le CLI a changé — et un contrôle qui ne voit plus ne doit jamais
// rendre « à jour » (la leçon de D-014 : un vert calculé sur rien rassure à tort).
if (JSON.stringify(localesVuesParLeCli) !== JSON.stringify(depot)) {
  illisible(
    `le CLI voit ${localesVuesParLeCli.length} migrations locales, le dépôt en a ${depot.length} — le contrôle ne recoupe plus ce qu'il contrôle.`,
  );
}

const enRetard = migrations.filter((m) => m.local && !m.remote).map((m) => m.local);
const inconnues = migrations.filter((m) => !m.local && m.remote).map((m) => m.remote);

if (enRetard.length === 0 && inconnues.length === 0) {
  console.log(
    `HÉBERGÉ : À JOUR — ${depot.length} migrations, la base hébergée porte exactement celles du dépôt.`,
  );
  console.log(
    '  (Ne couvre que les migrations : le build web et la Site URL restent sur la checklist de deploiement-heberge.md.)',
  );
  process.exit(0);
}

console.error('HÉBERGÉ : DÉRIVE');
if (enRetard.length > 0) {
  console.error(
    `  EN RETARD de ${enRetard.length} migration(s) — le dépôt les porte, pas la base hébergée :`,
  );
  for (const v of enRetard) console.error(`    - ${v}`);
  console.error(
    '    Correctif : pnpm exec supabase db push --linked (voir deploiement-heberge.md).',
  );
}
if (inconnues.length > 0) {
  console.error(
    `  INCONNUE(S) DU DÉPÔT : ${inconnues.length} migration(s) sur la base hébergée sans fichier ici :`,
  );
  for (const v of inconnues) console.error(`    - ${v}`);
  console.error(
    '    Quelque chose est parti en production hors du dépôt — à élucider avant tout db push.',
  );
}
process.exit(1);
