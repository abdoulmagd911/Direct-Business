import nextConfig from 'eslint-config-next';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

/**
 * v2 lint. Beside the Next defaults it enforces the spec's rules that a linter can catch:
 *  - A4: the Supabase client is created only inside src/core/db/
 *  - A2: no setInterval outside src/core/
 *  - A13: localStorage only through src/core/prefs
 * The colour, hint and physical-CSS rules live in scripts/check-*.mjs (they read CSS and JSX as text).
 */
const config = [
  ...nextConfig,
  ...nextCoreWebVitals,
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/core/db/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='createClient'], CallExpression[callee.name='createBrowserClient'], CallExpression[callee.name='createServerClient']",
          message: 'A4: one Supabase client, created only in src/core/db/.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/core/**'],
    rules: {
      'no-restricted-globals': ['error', { name: 'localStorage', message: 'A13: use core/prefs.' }, { name: 'sessionStorage', message: 'A13: use core/prefs.' }],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage', message: 'A13: use core/prefs.' },
        { object: 'window', property: 'setInterval', message: 'A2: no polling outside core/.' },
        { object: 'globalThis', property: 'setInterval', message: 'A2: no polling outside core/.' },
      ],
    },
  },
  {
    files: ['src/**/*.tsx'],
    rules: {
      // The logo is an SVG file and avatars are short-lived signed URLs (M21); next/image adds nothing here.
      '@next/next/no-img-element': 'off',
    },
  },
  { ignores: ['.next/**', 'node_modules/**', 'tests/sabotage/**', 'scripts/**', 'playwright-report/**', 'test-results/**'] },
];

export default config;
