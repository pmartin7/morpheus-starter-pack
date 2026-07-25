import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import base from './base.js';
import tseslint from 'typescript-eslint';

/** @type {import('typescript-eslint').ConfigArray} */
export default tseslint.config(...base, {
  plugins: {
    'react-hooks': reactHooks,
    'jsx-a11y': jsxA11y,
  },
  rules: {
    ...reactHooks.configs.recommended.rules,
    'react-hooks/exhaustive-deps': 'warn',
  },
});
