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
      'Une migration appliquee est immuable (regle 1 de CLAUDE.md).',
      'Cree une NOUVELLE migration avec un timestamp posterieur qui applique le correctif,',
      'via : npx supabase migration new <nom_explicite>',
    ].join('\n'),
  );
  process.exit(2); // 2 = bloque l'appel et renvoie stderr a Claude
} catch {
  process.exit(0);
}
