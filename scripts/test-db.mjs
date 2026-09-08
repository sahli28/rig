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
 * **Et pourquoi il énonce une règle au lieu de donner un conseil** (`D-020`).
 * Ce message disait « relancer `test:db:fresh` avant de croire un rouge ». Un
 * conseil laisse une décision de jugement à quelqu'un en fin de session, et
 * cette décision-là s'est mal prise : le 6 septembre 2026, `me_test` test 9 est
 * sorti rouge sous une fixture de bruit, a été classé « effet d'interaction, à
 * ne pas chasser », et est revenu deux jours plus tard — c'était un vrai défaut.
 *
 * Le texte qui apprend à ignorer un rouge a fonctionné exactement comme conçu :
 * **il a avalé un défaut réel.** Il ne peut pas disparaître, le bruit existe.
 * Il devient donc une règle à deux issues, sans troisième.
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
      '  Des tests pgTAP ont échoué.',
      '',
      '  UN ROUGE ATTRIBUÉ AU DÉCOR SE PROUVE SUR UN SEED NEUF,',
      '  OU IL N’EST PAS ATTRIBUÉ.',
      '',
      '  La suite part d’une base fraîchement semée. Ce qu’on a créé en',
      '  cliquant dans l’app s’y ajoute et peut faire rougir des assertions',
      '  justes — c’est réel, et c’est pour ça que la tentation de classer',
      '  l’échec sans regarder est forte.',
      '',
      '  Elle a déjà coûté : le 6 septembre 2026, un vrai défaut a été rangé',
      '  dans « effets d’interaction » et est revenu deux jours plus tard',
      '  (`D-020`). La règle ci-dessus existe pour que ce classement soit un',
      '  **résultat**, pas une impression de fin de session.',
      '',
      '      pnpm test:db:fresh',
      '',
      '  VERT   → c’était le décor. Le noter, avec la date.',
      '  ROUGE  → c’est un défaut. Il a un ticket, pas une explication.',
      '',
      '  Aucune troisième issue. « Sans doute le décor » n’en est pas une.',
      '─'.repeat(72),
      '',
    ].join('\n'),
  );
}

process.exit(result.status ?? 1);
