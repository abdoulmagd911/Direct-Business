/**
 * Oversight's live test of #378: the Reminder's Day text was in the normal font and its Time text in the monospace one.
 * The Time box now carries the same font as the date box beside it. Sabotage: tests/sabotage/time-box-font.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import { Input, TimeInput } from '../../../src/ui/Input';

const draw = (node: React.ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      {node}
    </NextIntlClientProvider>,
  );

describe('the time box and the date box', () => {
  it('the Time box is not in the monospace font, as the date box is not', () => {
    const time = draw(<TimeInput value="09:00" onChange={() => {}} data-t />);
    const date = draw(<Input type="date" value="2026-11-01" onChange={() => {}} data-d />);
    expect(time).not.toContain('font-data');
    expect(date).not.toContain('font-data');
  });
});
