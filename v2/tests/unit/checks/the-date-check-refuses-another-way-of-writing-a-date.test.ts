import { describe, expect, it } from 'vitest';
import check from '../../../scripts/checks/one-date-format.mjs';
import { findings, fixture } from './helpers';

// Sabotage: tests/sabotage/blind-checks.mjs "blind-one-date-format" turns this red.
describe('the date check refuses another way of writing a date', () => {
  it('refuses the browser and Intl ways of writing a date for the screen', async () => {
    const root = fixture({
      'src/modules/demo/when.ts': [
        `export const a = (d: Date) => d.toLocaleDateString('en-GB');`,
        `export const b = (d: Date) => d.toLocaleString();`,
        `export const c = (d: Date) => new Intl.DateTimeFormat('en-GB').format(d);`,
        `export const d1 = (d: Date) => Intl.DateTimeFormat('ar').format(d);`,
        ``,
      ].join('\n'),
    });
    const got = await findings(check, root);
    expect(got.map((f) => f.line)).toEqual([1, 2, 3, 4]);
  });

  it('refuses a long date style and a long month beside a day', async () => {
    const root = fixture({
      'src/modules/demo/style.ts': [
        `export const a = { dateStyle: 'long' };`,
        `export const b = { dateStyle: 'full', timeStyle: 'short' };`,
        `export const c = { weekday: 'long', day: 'numeric', month: 'long' };`,
        ``,
      ].join('\n'),
    });
    const got = await findings(check, root);
    expect(got.map((f) => f.line)).toEqual([1, 2, 3]);
  });

  it('refuses a raw date input anywhere but the one Input', async () => {
    const root = fixture({
      'src/modules/demo/Form.tsx': `export const F = () => <input type="date" name="due" />;\n`,
      'src/modules/demo/Form2.tsx': `export const F = () => <input type="datetime-local" />;\n`,
      'src/ui/Input.tsx': `export const I = () => <input type="date" />;\n`,
    });
    const got = await findings(check, root);
    expect(got.map((f) => f.file).sort()).toEqual(['src/modules/demo/Form.tsx', 'src/modules/demo/Form2.tsx']);
  });

  it('refuses a raw time input, which would show the browser clock (9:30 AM)', async () => {
    const root = fixture({
      'src/modules/demo/At.tsx': `export const F = () => <input type="time" name="at" />;\n`,
      'src/ui/Input.tsx': `export const I = () => <input type="time" />;\n`,
    });
    const got = await findings(check, root);
    expect(got.map((f) => f.file)).toEqual(['src/modules/demo/At.tsx']);
    expect(got[0]!.message).toContain('TimeInput');
  });

  it('allows the shared formatter, the en-CA day idiom, a month on its own and a date box made by Input', async () => {
    const root = fixture({
      'src/core/i18n/format.ts': `export const f = (d: Date) => new Intl.DateTimeFormat('en-GB', { month: 'long', day: 'numeric' }).format(d);\n`,
      'src/modules/demo/ok.tsx': [
        `import { Input } from '@/ui/Input';`,
        `export const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });`,
        `export const label = { month: 'long', year: 'numeric' };`,
        `export const gone = { day: undefined, month: 'long', year: 'numeric' };`,
        `export const Box = () => <Input type="date" />;`,
        `export const lab = (d: Date) => new Intl.DateTimeFormat('ar', { month: 'long' }).format(d); // check-allow: one-date-format — a month name for a label`,
        ``,
      ].join('\n'),
    });
    expect(await findings(check, root)).toEqual([]);
  });
});
