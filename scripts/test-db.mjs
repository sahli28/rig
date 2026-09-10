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
import { readdirSync } from 'node:fs';

/**
 * **Ce que `pg_prove` compte, et ce que personne ne comptait** (`D-020`, second
 * volet).
 *
 * Un fichier tronqué en cours de route **est** attrapé : le `plan(N)` de pgTAP
 * annonce combien d'assertions vont suivre, et il en manque. C'est ce qui a fait
 * rougir `class_roster_test.sql` quand sa sous-requête a levé.
 *
 * Un fichier **absent** ne l'était pas. Mesuré le 8 septembre 2026 : en retirer
 * un donne `Files=23, Tests=406` et **`Result: PASS`** — vert, silencieux, et
 * trente et une assertions de moins. Renommage malheureux, glob modifié, fichier
 * oublié dans un rebase : le filet rétrécit sans rien dire.
 *
 * C'est la règle 10 de `CLAUDE.md` appliquée à l'instrument plutôt qu'à une
 * assertion — un contrôle ne mord que là où on a regardé, et personne ne
 * regardait le **nombre de fichiers exercés**.
 *
 * **Deux contrôles, parce qu'un seul ne mordait pas.** Le premier écrit ici
 * comparait le disque à ce qui s'exécute — et le contrôle négatif l'a réfuté :
 * retirer un fichier baisse **les deux** compteurs, donc ils restent d'accord et
 * le garde se tait. Il fallait un chiffre qui ne bouge pas tout seul.
 *
 * D'où :
 *
 * 1. `FICHIERS_ATTENDUS`, figé ici. Il attrape la **disparition** — renommage,
 *    glob, fichier perdu dans un rebase ;
 * 2. la comparaison disque / exécutés, qui attrape un fichier **présent mais
 *    non exercé**. Les deux modes sont différents et aucun ne couvre l'autre.
 *
 * **Pas de total d'assertions figé**, en revanche : il faudrait le corriger à
 * chaque test ajouté, et un chiffre qu'on corrige dix fois par semaine est un
 * chiffre qu'on corrige sans le lire. Le nombre de fichiers bouge rarement, et
 * le bouger est alors un geste délibéré — c'est exactement ce qu'on veut d'un
 * garde.
 */
const FICHIERS_ATTENDUS = 29;

const fichiersSurDisque = readdirSync('supabase/tests').filter((f) => f.endsWith('.sql')).length;

if (fichiersSurDisque < FICHIERS_ATTENDUS) {
  process.stderr.write(
    [
      '',
      '─'.repeat(72),
      '  IL MANQUE DES FICHIERS DE TEST.',
      '',
      `  ${FICHIERS_ATTENDUS} attendus, ${fichiersSurDisque} sur le disque.`,
      '',
      '  Un fichier absent ne peut rien attraper, et sans ce contrôle la suite',
      '  rendait PASS avec moins d’assertions qu’hier — mesuré le 8 sept. 2026 :',
      '  `Files=23, Tests=406`, vert.',
      '',
      '  Si un test a été retiré volontairement, baisser `FICHIERS_ATTENDUS`',
      '  dans ce fichier, **dans le même commit**, en disant pourquoi.',
      '─'.repeat(72),
      '',
    ].join('\n'),
  );
  process.exit(1);
}

const result = spawnSync('supabase', ['test', 'db'], {
  encoding: 'utf8',
  shell: true,
});

// La sortie est relayée telle quelle : c'est elle qu'on lit quand ça casse.
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

/**
 * `Files=24, Tests=437, …` — la ligne de résumé de `pg_prove`. Absente si la
 * suite s'est effondrée avant d'y arriver ; dans ce cas l'échec parle déjà.
 */
const resume = /Files=(\d+)/.exec(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
const fichiersExerces = resume === null ? null : Number(resume[1]);

if (result.status === 0 && fichiersExerces !== null && fichiersExerces < fichiersSurDisque) {
  process.stderr.write(
    [
      '',
      '─'.repeat(72),
      '  VERT, MAIS INCOMPLET — et c’est pire qu’un rouge.',
      '',
      `  ${fichiersSurDisque} fichiers de test sur le disque, ${fichiersExerces} exercés.`,
      '',
      '  Un fichier qui n’est pas exécuté ne peut rien attraper, et rien ne',
      '  le signale : la suite rend PASS avec moins d’assertions qu’hier.',
      '  Renommage, glob, fichier perdu dans un rebase — la cause importe',
      '  moins que le fait de le voir.',
      '',
      '  Comparer `supabase/tests/*.sql` à ce que la sortie ci-dessus liste.',
      '─'.repeat(72),
      '',
    ].join('\n'),
  );
  process.exit(1);
}

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
