import js from '@eslint/js';
import tseslint from 'typescript-eslint';

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
    // Le filtre de box active ne peut pas rester une convention
    // ---------------------------------------------------------------------
    //
    // La RLS garantit qu'une requête ne sort pas des boxes **de
    // l'utilisateur** ; elle ne garantit pas qu'elle reste dans **la box
    // active**. Un membre inscrit dans deux boxes est un cas nominal
    // (ADR 0002) : sans filtre, les données de la box A s'affichent dans
    // l'interface de la box B. Aucun test pgTAP ne peut l'attraper — ce n'est
    // pas une fuite inter-utilisateur, tous les voyants restent verts.
    //
    // Un commentaire disant « passez par le helper » ne survit pas à P1. Cette
    // règle, si. Tout accès à une table de box passe donc par
    // `packages/core/src/supabase/`, seul endroit relu comme tel.
    //
    // La liste blanche n'énumère que les tables **sans `tenant_id`** :
    // `users` et `devices` sont scopées à la personne,
    // `processed_webhook_events` est globale. `tenants` n'y figure pas — elle
    // n'a pas de `tenant_id` mais souffre du même mal, et se filtre par `id`
    // via `tenantScope().currentTenant()`.
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    ignores: ['packages/core/src/supabase/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name!='Array'][callee.property.name='from'][arguments.0.type='Literal']:not([arguments.0.value=/^(users|devices|processed_webhook_events)$/])",
          message:
            'Accès direct à une table de box : la RLS ne vous garde pas dans la box active. Passez par `tenantScope()` de @rig/core/supabase, ou ajoutez la fonction manquante dans packages/core/src/supabase/. Voir .claude/rules/api.md.',
        },
      ],
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
