import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// ---------------------------------------------------------------------------
// Les interdits du code partagé, nommés une fois et composés ensuite
// ---------------------------------------------------------------------------
//
// **Pourquoi des constantes plutôt que trois blocs écrits à la main.** En
// configuration plate, deux blocs qui déclarent `no-restricted-syntax` sur les
// mêmes fichiers ne s'additionnent pas : **le dernier écrase le premier**. Un
// bloc d'exception doit donc *redéclarer* tout ce qui continue de s'appliquer,
// et c'est cet oubli qui a silencieusement désactivé l'interdit de
// `tenantScope` le 3 septembre 2026 — constaté avec un fichier sonde appelant
// `.from('classes')` : plus aucune erreur.
//
// Ici, chaque bloc **énumère** ce qui s'applique chez lui. L'oubli reste
// possible, mais il devient visible : une liste courte à côté de listes
// longues. Et `pnpm lint:sondes` le rattrape — c'est son seul travail.

/**
 * 1. `.from('<table de box>')` — la RLS garantit qu'une requête ne sort pas des
 *    boxes **de l'utilisateur** ; elle ne garantit pas qu'elle reste dans **la
 *    box active**. Un membre inscrit dans deux boxes est un cas nominal
 *    (ADR 0002) : sans filtre, les données de la box A s'affichent dans
 *    l'interface de la box B. Aucun test pgTAP ne peut l'attraper — ce n'est pas
 *    une fuite inter-utilisateur, tous les voyants restent verts.
 *
 *    La liste blanche n'énumère que les tables **sans `tenant_id`** : `users` et
 *    `devices` sont scopées à la personne, `processed_webhook_events` est
 *    globale. `tenants` n'y figure pas — pas de `tenant_id`, mais le même mal,
 *    et elle se filtre par `id` via `tenantScope().currentTenant()`.
 */
const PAS_DE_FROM_DIRECT = {
  selector:
    "CallExpression[callee.object.name!='Array'][callee.property.name='from'][arguments.0.type='Literal']:not([arguments.0.value=/^(users|devices|processed_webhook_events)$/])",
  message:
    'Accès direct à une table de box : la RLS ne vous garde pas dans la box active. Passez par `tenantScope()` de @rack/core/supabase, ou ajoutez la fonction manquante dans packages/core/src/supabase/. Voir .claude/rules/api.md.',
};

/**
 * 2. `Intl` — incomplet sous Hermes. Trois défauts en une semaine, dont deux
 *    allés jusqu'à l'appareil, et le dernier a fait planter le planning :
 *    `Intl.PluralRules` n'existe pas. La cause n'est pas `Intl`, c'est que **nos
 *    filets s'exécutent sur un moteur qui n'est pas celui du produit** — Vitest
 *    sous Node, le harnais dans un navigateur, tous deux avec un `Intl` complet.
 *    Aucun test ne peut voir ce que Hermes n'a pas. Une règle statique, si.
 *
 *    Le sélecteur vise les `MemberExpression` et laisse passer les positions de
 *    **type** (`Intl.DateTimeFormatOptions`), qui sont des `TSQualifiedName` et
 *    ne s'exécutent jamais. Il vise **aussi** `globalThis.Intl`, la porte de
 *    derrière : sans cette moitié, l'interdit se contourne en trois caractères,
 *    et personne ne l'écrit pour tricher — on l'écrit parce que c'est la forme
 *    qu'on avait sous les yeux.
 */
const PAS_D_INTL = {
  selector:
    "MemberExpression[object.name='Intl'], MemberExpression[object.name='globalThis'][property.name='Intl']",
  message:
    "`Intl` n'est pas complet sous Hermes : `PluralRules` et `RelativeTimeFormat` y sont absents, et un test sous Node ne peut pas le voir. Passez par packages/core/src/i18n/intl.ts, le seul module qui y touche — chacune de ses fonctions dit ce qu'elle suppose du moteur, et si c'est prouvé sur appareil.",
};

/**
 * 3. `crypto` — **absent sous Hermes**, et pas seulement incomplet. Le runtime
 *    « winter » d'`expo@57` installe `fetch`, `URL`, `TextEncoder`,
 *    `structuredClone` et les streams ; **pas `crypto`** (lu dans
 *    `node_modules/expo/src/winter`, et absent de la doc du SDK 57).
 *
 *    Interdit **avant** le premier appel, et c'est tout l'intérêt : aucun
 *    `crypto.` n'existait dans le code partagé le 4 septembre 2026. Le premier
 *    serait arrivé avec P1-003b, qui génère une clé d'idempotence au tap — donc
 *    un `crypto.randomUUID()` qui plante sur appareil, quatrième défaut de la
 *    même famille. Interdire un global que personne n'utilise coûte une ligne ;
 *    l'interdire après coup coûte un plantage et une passe manuelle.
 *
 *    Le sélecteur vise `crypto.<x>` **et** `globalThis.crypto` — la seconde
 *    forme est celle qu'on écrit naturellement quand le linter refuse la
 *    première, et c'est aussi celle que la façade emploie. Un identifiant local
 *    nommé `crypto` (import de `node:crypto` dans un script) n'est pas
 *    concerné, et `scripts/` n'est de toute façon pas dans `files`.
 */
const PAS_DE_CRYPTO = {
  selector:
    "MemberExpression[object.name='crypto'], MemberExpression[object.name='globalThis'][property.name='crypto']",
  message:
    "`crypto` n'existe pas sous Hermes : ni `randomUUID()`, ni `getRandomValues()`, et le runtime winter d'Expo ne l'installe pas. Un test sous Node ne peut pas le voir. Passez par packages/core/src/crypto.ts — `uuidV7()` pour un identifiant (règle 12), et la source d'aléa s'installe au démarrage de l'app.",
};

/**
 * 4. **`expo-crypto` importé ailleurs que là où on installe la source d'aléa.**
 *
 *    Le jumeau de l'interdit précédent, et il ne se voit pas de la même
 *    fenêtre : `Crypto.randomUUID()` est un appel de **module**, pas un accès au
 *    global. Le sélecteur `MemberExpression[object.name='crypto']` ne l'attrape
 *    pas. On pouvait donc court-circuiter la façade en important le module —
 *    sans intention de contourner quoi que ce soit, juste en suivant une
 *    documentation d'Expo.
 *
 *    L'import reste permis dans le fichier qui **installe** la source, et là
 *    seulement (voir le bloc d'exception plus bas). Si ce câblage déménage, son
 *    exception déménage avec lui — une ligne, visible dans le diff.
 */
const PAS_D_IMPORT_EXPO_CRYPTO = {
  name: 'expo-crypto',
  message:
    "`expo-crypto` ne s'importe que là où l'app installe sa source d'aléa (`installRandomBytesSource()`, au démarrage). Partout ailleurs, passez par `uuidV7()` de @rack/core : `Crypto.randomUUID()` rend un v4 et court-circuite la façade sans qu'aucun interdit de global ne le voie.",
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.expo/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.turbo/**',
      'supabase/.temp/**',
      'supabase/.branches/**',
      // Généré par Next à chaque build, jamais édité à la main.
      '**/next-env.d.ts',
      // Outillage d'un assistant tiers, transposé de `.claude/` par une session
      // parallèle. On reste sur Claude Code : ces fichiers sont ignorés par git
      // (voir `.gitignore`) et ne doivent pas non plus passer le linter, dont la
      // configuration ne connaît ni `process` ni `console` hors contexte Node.
      '.codex/**',
      '.agents/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // CLAUDE.md : pas de `any`, pas de `@ts-ignore` sans justification.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': 'allow-with-description', 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // ---------------------------------------------------------------------
    // Le code partagé : les trois interdits s'appliquent
    // ---------------------------------------------------------------------
    //
    // Un commentaire disant « passez par le helper » ne survit pas à P1. Cette
    // règle, si. Ce que chacun des trois interdits protège, et pourquoi il
    // existe, est écrit une fois en tête de fichier, sur sa constante.
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', PAS_DE_FROM_DIRECT, PAS_D_INTL, PAS_DE_CRYPTO],
      'no-restricted-imports': ['error', { paths: [PAS_D_IMPORT_EXPO_CRYPTO] }],
    },
  },
  {
    // … sauf ici. **Le seul fichier autorisé à importer `expo-crypto`** : celui
    // qui pose la source d'aléa au démarrage de l'app mobile (P1-003b). Il
    // n'existe pas encore ; l'exception est écrite d'avance pour que le jour où
    // il arrive, le choix de l'endroit soit un choix et non un contournement.
    //
    // Les trois interdits de syntaxe continuent de s'y appliquer — un bloc qui
    // redéclare une règle écrase la précédente, celui-ci ne redéclare que
    // `no-restricted-imports`.
    files: ['apps/mobile/app/_layout.tsx'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // La porte de `tenantScope` : ce dossier **est** l'implémentation de la
    // règle 1, il ne peut pas s'y soumettre. Les deux autres interdits restent,
    // et c'est pour ça qu'ils sont réécrits ici — omettre une ligne dans un bloc
    // d'exception, c'est désactiver l'interdit, pas l'alléger.
    files: ['packages/core/src/supabase/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', PAS_D_INTL, PAS_DE_CRYPTO],
    },
  },
  {
    // Le module qui **est** la façade d'`Intl`, et son test, qui doit pouvoir
    // amputer le global pour vérifier qu'on s'en passe.
    files: ['packages/core/src/i18n/intl.ts', 'packages/core/src/i18n/intl.test.ts'],
    rules: {
      'no-restricted-syntax': ['error', PAS_DE_FROM_DIRECT, PAS_DE_CRYPTO],
    },
  },
  {
    // Le module qui **est** la façade de `crypto`, et son test, qui retire le
    // global pour vérifier que le code le réclame au lieu de se dégrader en
    // silence. Même forme que la façade d'`Intl`, un cran plus strict : `Intl`
    // est incomplet sous Hermes, `crypto` y est absent.
    files: ['packages/core/src/crypto.ts', 'packages/core/src/crypto.test.ts'],
    rules: {
      'no-restricted-syntax': ['error', PAS_DE_FROM_DIRECT, PAS_D_INTL],
    },
  },
  {
    // Scripts Node autonomes, hors monorepo : hooks Claude Code et outillage.
    files: ['.claude/hooks/*.mjs', 'scripts/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', URL: 'readonly' },
    },
  },
  {
    // Metro impose du CommonJS pour sa configuration : on ne peut pas l'écrire en ESM.
    files: ['**/*.config.js', '**/*.cjs'],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'writable',
        exports: 'writable',
        __dirname: 'readonly',
        process: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
