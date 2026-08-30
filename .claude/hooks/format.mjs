#!/usr/bin/env node
// PostToolUse (Edit|Write) : formate le fichier touche. Silencieux, non bloquant.
import { execSync } from 'node:child_process';

let raw = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) raw += chunk;

try {
  const input = JSON.parse(raw || '{}');
  const file = input?.tool_input?.file_path;
  if (!file || !/\.(ts|tsx|js|jsx|mjs|json|md|css)$/.test(file)) process.exit(0);
  execSync(`npx --no-install prettier --write "${file}"`, { stdio: 'ignore', timeout: 20000 });
} catch {
  // prettier absent ou en echec : on ne bloque jamais l'edition
}
process.exit(0);
