import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { modules } from '../../../src/core/registry/index';
import { snapshotOf } from '../../../src/core/registry/snapshot';

// The registry (TECH-SPEC §2.3, V123). A module.ts changed without `pnpm registry:sync` fails here; a sync that lost
// something fails REG-01 on the database. Sabotages: tests/sabotage/registry-unsynced.mjs.
const V2 = path.resolve(__dirname, '..', '..', '..');
const wordOf = (catalog: unknown, key: string) =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], catalog);

describe('the registry agrees with its snapshot and its wording', () => {
  it('agrees with supabase/registry.json (run pnpm registry:sync after changing a module)', () => {
    const synced = JSON.parse(fs.readFileSync(path.join(V2, 'supabase', 'registry.json'), 'utf8')) as unknown;
    expect(JSON.parse(JSON.stringify(snapshotOf(modules)))).toEqual(synced);
  });

  it('gives every page, capability, setting and entity its wording in both catalogs', () => {
    const labels = modules.flatMap((m) => [
      ...(m.pages ?? []).map((p) => p.label),
      ...(m.capabilities ?? []).map((c) => c.label),
      ...(m.settings ?? []).map((s) => s.label),
      ...(m.entities ?? []).map((e) => e.label),
    ]);
    const missing = labels.flatMap((key) =>
      [
        ['en', en],
        ['ar', ar],
      ].flatMap(([name, catalog]) => (typeof wordOf(catalog, key) === 'string' ? [] : [`${name}: ${key}`])),
    );
    expect(missing).toEqual([]);
  });

  it('gives every page its own route', () => {
    const routes = modules.flatMap((m) => (m.pages ?? []).map((p) => p.route));
    expect(new Set(routes).size).toBe(routes.length);
  });
});
