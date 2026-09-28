// ESLint for v2 (flat config). The rules below the Next presets are the spec's lint-enforced architecture rules
// (TECH-SPEC §0): A2 no polling timers outside core/, A13 browser storage only through core/prefs. The other §9.1
// rules (one client, no table writes, no physical CSS, no hex …) are checks under scripts/checks/, run by
// `pnpm checks`, each with a planted violation under tests/sabotage/.
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

const storageMessage = 'A13: browser storage only through src/core/prefs (an allow-list of UI-preference keys).';
const timerMessage = 'A2: no timers that poll app state outside src/core/.';

const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'next-env.d.ts',
    ],
  },
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ['src/**/*.{ts,tsx,js,jsx,mjs}'],
    ignores: ['src/core/prefs/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: storageMessage },
        { name: 'sessionStorage', message: storageMessage },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage', message: storageMessage },
        { object: 'window', property: 'sessionStorage', message: storageMessage },
        { object: 'globalThis', property: 'localStorage', message: storageMessage },
        { object: 'globalThis', property: 'sessionStorage', message: storageMessage },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx,js,jsx,mjs}'],
    ignores: ['src/core/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: "CallExpression[callee.name='setInterval']", message: timerMessage },
        { selector: "CallExpression[callee.property.name='setInterval']", message: timerMessage },
      ],
    },
  },
];

export default config;
