#!/usr/bin/env node
/**
 * Lance la suite pgTAP, et **explique le seul échec qui n'est pas un bug**.
 *
 * La suite part d'une base fraîchement semée. Ses assertions comptent des
 * lignes — « quarante occurrences », « douze cours visibles », « la box conserve
 * un propriétaire » — et tout ce qu'on a créé en cliquant dans l'app depuis le
 * dernier `db:reset` s'ajoute à ces comptes. Six tests peuvent alors rougir,
 * dont quatre dans `account_deletion_test.sql`, sans qu'une ligne de code soit
 * en cause.
 *
 * C'est arrivé, et ça a coûté un quart d'heure. Le message de `pg_prove` ne dit
 * rien de tout ça : il montre un `have 19 / want 12` parfaitement crédible.
 *
 * **Pourquoi un rappel à l'échec plutôt qu'un bandeau au démarrage** : un
 * bandeau affiché à chaque exécution est un bandeau qu'on cesse de lire en trois
 * jours. Celui-ci n'apparaît qu'au moment où il sert.
 *
 * **Pourquoi pas un `db:reset` automatique** : la suite tourne à chaque `/check`,
 * et un reset systématique détruirait la base de travail — la box qu'on est en
 * train de cliquer — pour trente secondes de plus à chaque fois. Le reset reste
 * un geste, `pnpm test:db:fresh` le fait en un seul.
 */

import { spawnSync } from 'node:child_process';

const result = spawnSync('supabase', ['test', 'db'], {
  stdio: 'inherit',
  shell: true,
});

if (result.status !== 0) {
  process.stderr.write(
    [
      '',
      '─'.repeat(72),
      '  Des tests pgTAP ont échoué. Avant de chercher un bug, une question :',
      '',
      '    as-tu cliqué dans l’app depuis le dernier `pnpm db:reset` ?',
      '',
      '  La suite part d’une base **fraîchement semée** et compte des lignes.',
      '  Une série de cours, un membre invité ou une box créée à la main s’y',
      '  ajoutent et font rougir des assertions parfaitement justes.',
      '',
      '  Pour lever le doute en une commande :',
      '',
      '      pnpm test:db:fresh',
      '',
      '  Si c’est encore rouge après ça, l’échec est réel.',
      '─'.repeat(72),
      '',
    ].join('\n'),
  );
}

process.exit(result.status ?? 1);
