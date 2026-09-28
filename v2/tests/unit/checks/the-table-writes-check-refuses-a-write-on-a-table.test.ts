import { describe, expect, it } from 'vitest';
import check from '../../../scripts/checks/no-table-writes.mjs';
import { findings, fixture } from './helpers';

// Sabotage: tests/sabotage/blind-checks.mjs "no-table-writes" turns this red.
describe('the table-writes check refuses insert, update, upsert and delete on a table', () => {
  it('refuses each write method on a .from() chain, however long the chain', async () => {
    const root = fixture({
      'src/modules/tasks/data.ts': [
        `declare const db: any;`,
        `export const a = db.from('task').insert({ title: 't' });`,
        `export const b = db.from('task').update({ title: 't' }).eq('id', 1);`,
        `export const c = db.schema('api').from('task').upsert({ id: 1 });`,
        `export const d = db.from('task').select('id').eq('id', 1).delete();`,
        `export const e = db.from('task')['update']({ title: 't' });`,
        ``,
      ].join('\n'),
    });
    const got = await findings(check, root);
    expect(got.map((f) => f.line)).toEqual([2, 3, 4, 5, 6]);
  });

  it('allows reads, api.* calls, storage file calls and Map/Set/URLSearchParams methods', async () => {
    const root = fixture({
      'src/modules/tasks/data.ts': [
        `declare const db: any;`,
        `export const r = db.from('task_list').select('*').eq('id', 1);`,
        `export const w = db.rpc('task_save', { p: 1 });`,
        `export const f = db.storage.from('files').update('a/b.pdf', new Blob());`,
        `const m = new Map<string, number>(); m.delete('x'); new Set([1]).delete(1);`,
        `new URLSearchParams('a=1').delete('a');`,
        ``,
      ].join('\n'),
    });
    expect(await findings(check, root)).toEqual([]);
  });
});
