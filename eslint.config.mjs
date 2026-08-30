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
    // Les hooks Claude Code sont des scripts Node autonomes, hors monorepo.
    files: ['.claude/hooks/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly' },
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
