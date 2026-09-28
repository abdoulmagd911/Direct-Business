import { describe, expect, it } from 'vitest';
import check from '../../../scripts/checks/one-client.mjs';
import { findings, fixture } from './helpers';

// Sabotage: tests/sabotage/blind-checks.mjs "one-client" (the check stops matching factory calls) turns this red.
describe('the one-client check refuses a Supabase client made outside src/core/db', () => {
  it('refuses createClient, createBrowserClient and createServerClient, and a value import of the packages', async () => {
    const root = fixture({
      'src/modules/tasks/data.ts': `import { createClient } from '@supabase/supabase-js';\nexport const c = createClient('u', 'k');\n`,
      'src/app/x.tsx': `import * as ssr from '@supabase/ssr';\nexport const b = ssr.createBrowserClient('u', 'k');\n`,
      'src/app/y.ts': `declare const lib: any;\nexport const s = lib.createServerClient('u', 'k', {});\n`,
      'src/app/z.ts': `export const later = () => import('@supabase/supabase-js');\n`,
    });
    const got = await findings(check, root);
    expect(got.map((f) => `${f.file}:${f.line}`).sort()).toEqual([
      'src/app/x.tsx:1',
      'src/app/x.tsx:2',
      'src/app/y.ts:2',
      'src/app/z.ts:1',
      'src/modules/tasks/data.ts:1',
      'src/modules/tasks/data.ts:2',
    ]);
  });

  it('allows the client inside src/core/db and type-only imports elsewhere', async () => {
    const root = fixture({
      'src/core/db/client.ts': `import { createBrowserClient } from '@supabase/ssr';\nexport const db = createBrowserClient('u', 'k');\n`,
      'src/modules/tasks/data.ts': `import type { SupabaseClient } from '@supabase/supabase-js';\nimport { type User } from '@supabase/supabase-js';\nexport type X = SupabaseClient | User;\n`,
    });
    expect(await findings(check, root)).toEqual([]);
  });
});
