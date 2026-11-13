/**
 * The command runner (core/commands/command.ts), the 13 Nov sweep:
 *  - a write that went through is never said as failed: a step after it that throws (a dialog's close, a screen's
 *    own list) used to turn the "Saved" into a refusal and answer nothing, so the screen offered the same write again
 *    and a retry saved it twice;
 *  - the step after a write runs once: pressing Undo used to run it again — the achievement's "Saved — view the record"
 *    reopened for the undone achievement, a new task's page opened again for the undone task; the Undo's own step is
 *    `afterUndo`.
 * Every name is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type DoneOpts = { undo?: { onUndo: () => Promise<void> | void }; id?: unknown };
const { toast, rpc } = vi.hoisted(() => ({
  toast: {
    done: vi.fn<(title: string, opts?: DoneOpts) => string>(() => 'toast-1'),
    failed: vi.fn(),
    working: vi.fn(() => 'toast-2'),
  },
  rpc: vi.fn<(fn: string, args?: unknown) => Promise<unknown>>(async () => ({ request_id: 'undo-1' })),
}));
vi.mock('@/ui/Toast', () => ({ toast }));
vi.mock('@/core/db/rpc', () => ({ rpc }));

const { command } = await import('../../../src/core/commands/command');
const { commandBusy } = await import('../../../src/core/commands/refetch');

const words = {
  done: 'Saved',
  undo: 'Undo',
  undone: 'Undone',
  has: () => false,
  failed: (key: string) => `refused: ${key}`,
};
const pressUndo = async () => {
  const undo = toast.done.mock.calls[0]?.[1]?.undo;
  expect(undo, 'the done toast offers Undo').toBeTruthy();
  await undo!.onUndo();
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('a saved write stays saved whatever the step after it does', () => {
  it('answers the result and says Saved when the step after the write throws', async () => {
    const write = vi.fn(async () => ({ id: 'ach-1', request_id: 'req-1' }));
    const result = await command(words, write, {
      after: () => {
        throw new Error('the dialog was already gone');
      },
    });
    expect(result).toEqual({ id: 'ach-1', request_id: 'req-1' });
    expect(write).toHaveBeenCalledTimes(1);
    expect(toast.done).toHaveBeenCalledWith('Saved', expect.anything());
    expect(toast.failed).not.toHaveBeenCalled();
    expect(commandBusy()).toBe(false);
  });

  it('still says a write that failed as failed, and runs no step after it', async () => {
    const after = vi.fn();
    const result = await command(
      words,
      async () => {
        throw new Error('no answer');
      },
      { after },
    );
    expect(result).toBeUndefined();
    expect(after).not.toHaveBeenCalled();
    expect(toast.failed).toHaveBeenCalledTimes(1);
    expect(toast.done).not.toHaveBeenCalled();
  });

  it('runs the step after the write once — Undo runs afterUndo, never after again', async () => {
    const after = vi.fn();
    const afterUndo = vi.fn();
    await command(words, async () => ({ id: 'ach-1', request_id: 'req-1' }), { after, afterUndo, undoDirect: true });
    expect(after).toHaveBeenCalledTimes(1);
    await pressUndo();
    expect(rpc).toHaveBeenCalledWith('undo', { p_request: 'req-1' });
    expect(after).toHaveBeenCalledTimes(1);
    expect(afterUndo).toHaveBeenCalledTimes(1);
    expect(afterUndo).toHaveBeenCalledWith({ id: 'ach-1', request_id: 'req-1' });
    expect(toast.done).toHaveBeenLastCalledWith('Undone', expect.anything());
    expect(commandBusy()).toBe(false);
  });

  it('says an Undo that went through as undone even when its step throws', async () => {
    await command(words, async () => ({ request_id: 'req-2' }), {
      undoDirect: true,
      afterUndo: () => {
        throw new Error('the list was already gone');
      },
    });
    await pressUndo();
    expect(toast.done).toHaveBeenLastCalledWith('Undone', expect.anything());
    expect(toast.failed).not.toHaveBeenCalled();
  });

  it('says an Undo the database refused as refused, and runs no afterUndo', async () => {
    const afterUndo = vi.fn();
    await command(words, async () => ({ request_id: 'req-3' }), { undoDirect: true, afterUndo });
    rpc.mockRejectedValueOnce(new Error('refused'));
    await pressUndo();
    expect(afterUndo).not.toHaveBeenCalled();
    expect(toast.failed).toHaveBeenCalledTimes(1);
  });
});
