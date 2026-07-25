import base from './base.js';
import tseslint from 'typescript-eslint';

/** @type {import('typescript-eslint').ConfigArray} */
export default tseslint.config(...base, {
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    // NestJS uses emitDecoratorMetadata — DI class imports must remain value imports
    // even when used only in type positions. Turning off avoids false positives.
    '@typescript-eslint/consistent-type-imports': 'off',
  },
});
