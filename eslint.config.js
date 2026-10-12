// ESLint 9 flat config for speculor-ai.
// TypeScript-aware linting via typescript-eslint, with Prettier taking care of
// all formatting concerns (formatting rules are turned off here).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', 'package-lock.json'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['**/*.{ts,mjs,js}'],
    rules: {
      // TypeScript already catches undefined globals; avoids false positives.
      'no-undef': 'off',
      // Allow intentional no-op expressions such as `void expr`.
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
