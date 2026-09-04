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
    // **Les deux interdits du code partagé, dans un seul `no-restricted-syntax`.**
    //
    // Un seul, et c'est une leçon payée sur-le-champ : deux blocs déclarant la
    // même règle sur les mêmes fichiers ne s'additionnent pas — en configuration
    // plate, **le dernier écrase le premier**. Ajouter l'interdit d'`Intl` dans
    // un second bloc a silencieusement désactivé celui de `tenantScope`.
    // Constaté avec un fichier sonde appelant `.from('classes')` : plus aucune
    // erreur. Les exceptions se font donc par bloc d'`ignores` ci-dessous, pas
    // par bloc de règle.
    //
    // 1. `.from('<table de box>')` — la RLS ne garde pas dans la box active,
    //    et aucun test pgTAP ne peut attraper cette confusion. La liste blanche
    //    n'énumère que les tables **sans `tenant_id`** : `users` et `devices`
    //    sont scopées à la personne, `processed_webhook_events` est globale.
    //    `tenants` n'y figure pas — pas de `tenant_id`, mais le même mal, et
    //    elle se filtre par `id` via `tenantScope().currentTenant()`.
    //
    // 2. `Intl` — incomplet sous Hermes. Trois défauts en une semaine, dont
    //    deux allés jusqu'à l'appareil, et le dernier a fait planter le
    //    planning : `Intl.PluralRules` n'existe pas. La cause n'est pas `Intl`,
    //    c'est que **nos filets s'exécutent sur un moteur qui n'est pas celui du
    //    produit** — Vitest sous Node, le harnais dans un navigateur, tous deux
    //    avec un `Intl` complet. Aucun test ne peut voir ce que Hermes n'a pas.
    //    Une règle statique, si. Le sélecteur vise les `MemberExpression` et
    //    laisse passer les positions de **type** (`Intl.DateTimeFormatOptions`),
    //    qui sont des `TSQualifiedName` et ne s'exécutent jamais.
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name!='Array'][callee.property.name='from'][arguments.0.type='Literal']:not([arguments.0.value=/^(users|devices|processed_webhook_events)$/])",
          message:
            'Accès direct à une table de box : la RLS ne vous garde pas dans la box active. Passez par `tenantScope()` de @rig/core/supabase, ou ajoutez la fonction manquante dans packages/core/src/supabase/. Voir .claude/rules/api.md.',
        },
        {
          selector: "MemberExpression[object.name='Intl']",
          message:
            "`Intl` n'est pas complet sous Hermes : `PluralRules` et `RelativeTimeFormat` y sont absents, et un test sous Node ne peut pas le voir. Passez par packages/core/src/i18n/intl.ts, le seul module qui y touche — chacune de ses fonctions dit ce qu'elle suppose du moteur, et si c'est prouvé sur appareil.",
        },
      ],
    },
  },
  {
    // La porte de `tenantScope` : ce dossier **est** l'implémentation de la
    // règle 1, il ne peut pas s'y soumettre. L'interdit d'`Intl` reste.
    files: ['packages/core/src/supabase/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='Intl']",
          message:
            "`Intl` n'est pas complet sous Hermes : `PluralRules` et `RelativeTimeFormat` y sont absents, et un test sous Node ne peut pas le voir. Passez par packages/core/src/i18n/intl.ts, le seul module qui y touche — chacune de ses fonctions dit ce qu'elle suppose du moteur, et si c'est prouvé sur appareil.",
        },
      ],
    },
  },
  {
    // Le module qui **est** la façade d'`Intl`, et son test, qui doit pouvoir
    // amputer le global pour vérifier qu'on s'en passe. L'interdit de
    // `tenantScope` reste.
    files: ['packages/core/src/i18n/intl.ts', 'packages/core/src/i18n/intl.test.ts'],
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
