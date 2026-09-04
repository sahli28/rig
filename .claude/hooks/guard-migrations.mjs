#!/usr/bin/env node
// PreToolUse (Edit|Write) : interdit de modifier une migration SQL deja versionnee.
// Une migration appliquee est immuable : il faut en creer une nouvelle.
// Echoue toujours "ouvert" (exit 0) si quoi que ce soit tourne mal.
import { execSync } from 'node:child_process';

let raw = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) raw += chunk;

try {
  const input = JSON.parse(raw || '{}');
  const file = input?.tool_input?.file_path;
  if (!file) process.exit(0);

  const normalized = file.replace(/\\/g, '/');
  if (!/supabase\/migrations\/.+\.sql$/.test(normalized)) process.exit(0);

  // Le fichier est-il deja suivi par git (donc potentiellement deja applique) ?
  try {
    execSync(`git ls-files --error-unmatch "${file}"`, { stdio: 'ignore' });
  } catch {
    process.exit(0); // nouveau fichier, non versionne : autorise
  }

  console.error(
    [
      'BLOQUE : cette migration est deja versionnee dans git.',
      '',
      'Le defaut est de ne PAS la modifier. Cree une nouvelle migration :',
      '  npx supabase migration new <nom_explicite>',
      '',
      "L'exception, sa raison et sa date de peremption sont la regle 13 de CLAUDE.md :",
      "tant qu'aucune base de production n'existe, une correction en place est plus",
      'propre. Le jour ou une base de production existe, cette exception disparait.',
      '',
      "PORTEE DE CE GARDE : il ne s'execute que sur les outils Edit et Write. Un script",
      "Node lance en Bash ecrit le meme fichier sans qu'il le voie (arrive au renommage",
      'D-013). Il reduit les accidents, il ne rend pas le fichier immuable.',
    ].join('\n'),
  );
  process.exit(2); // 2 = bloque l'appel et renvoie stderr a Claude
} catch {
  process.exit(0);
}
