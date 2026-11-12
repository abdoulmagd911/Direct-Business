// @vitest-environment jsdom
/**
 * F-B1-05: a file upload goes through command() — a toast naming the stored file, with Undo, and the
 * global refetch — where the bare rpc + onDone() before it showed no toast at all. A failed upload lands
 * in the pending retry rows with no refresh, so the rows stay on the page (F163). Every name is made up.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no subtle crypto — the upload hashes the file before finishing it.
vi.stubGlobal('crypto', {
  subtle: { digest: vi.fn(async () => new Uint8Array(32).buffer) },
});

const { upload } = vi.hoisted(() => ({
  upload: vi.fn(async (): Promise<{ error: { message: string } | null }> => ({ error: null })),
}));
// the mock command runs the write and its after, as the real one does on success, and swallows a failure
// the way the real one turns it into a refusal toast — so the test pins what the section asks for.
vi.mock('@/core/commands/run', () => ({
  command: vi.fn(async (_words: unknown, fn: () => Promise<unknown>, opts?: { after?: (r: unknown) => void }) => {
    try {
      const r = await fn();
      await opts?.after?.(r);
      return r;
    } catch {
      return undefined;
    }
  }),
}));
vi.mock('@/core/db/rpc', () => ({ rpc: vi.fn() }));
vi.mock('@/core/db/client', () => ({
  browserDb: () => ({ storage: { from: () => ({ upload }) } }),
}));

import { command, type CommandWords } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { FilesSection } from '../../../src/ui/record/FilesSection';

let root: Root | null = null;
let host: HTMLElement | null = null;
const onDone = vi.fn();
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host = null;
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const draw = () => {
  (
    rpc as unknown as { mockImplementation: (fn: (name: string, args?: unknown) => unknown) => void }
  ).mockImplementation((name: string) => {
    if (name === 'file_begin') return Promise.resolve({ id: 'file-1', bucket: 'files', path: '2026/11/file-1.pdf' });
    if (name === 'file_finish')
      return Promise.resolve({ id: 'file-1', request_id: 'req-1', display_name_en: 'Agreement · to.csv' });
    return Promise.resolve(null);
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <FilesSection
          entity="task"
          recordId="t-1"
          kinds={[{ kind: 'evidence', purpose: 'evidence', label: 'Evidence' }]}
          files={[]}
          mayWrite
          onDone={onDone}
          title="Files"
        />
      </NextIntlClientProvider>,
    );
  });
};

const pick = (name: string) => {
  const input = host!.querySelector('input[type="file"]') as HTMLInputElement;
  const f = new File(['made-up contents'], name, { type: 'application/pdf' });
  // jsdom's File has no arrayBuffer() — the upload hashes the file before finishing it.
  Object.defineProperty(f, 'arrayBuffer', { value: async () => new Uint8Array([1, 2, 3]).buffer });
  Object.defineProperty(input, 'files', { value: [f], configurable: true });
  act(() => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

const pressUpload = async () => {
  const button = host!.querySelector('[data-file-upload]') as HTMLButtonElement;
  expect(button.disabled, 'the Upload button is off with nothing picked').toBe(false);
  act(() => {
    button.click();
  });
  await act(async () => {});
  await act(async () => {});
};

describe('a file upload goes through command(), with a toast and Undo (F-B1-05)', () => {
  it('toasts the stored file name with Undo, finishes the file and refreshes', async () => {
    draw();
    pick('agreement.pdf');
    await pressUpload();
    expect(command).toHaveBeenCalledTimes(1);
    const words = vi.mocked(command).mock.calls[0]![0] as CommandWords;
    expect(words.done).toBe('File agreement.pdf uploaded');
    expect(words.undo).toBe('Undo');
    expect(rpc).toHaveBeenCalledWith(
      'file_begin',
      expect.objectContaining({ p_original_name: 'agreement.pdf', p_entity: 'task', p_id: 't-1' }),
    );
    expect(rpc).toHaveBeenCalledWith('file_finish', { p_id: 'file-1', p_sha256: '00'.repeat(32) });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('a failed upload lands in the pending retry rows and refreshes nothing', async () => {
    upload.mockResolvedValueOnce({ error: { message: 'made-up storage failure' } });
    draw();
    pick('agreement.pdf');
    await pressUpload();
    expect(command).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    expect(host!.querySelector('[data-file-retry]'), 'no retry row for the failed upload').not.toBeNull();
    expect(host!.textContent).toContain('The file could not be uploaded');
  });
});
