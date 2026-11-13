import { describe, expect, it } from 'vitest';
import { DbError } from '@/core/db/errors';
import { errorKey } from '@/core/db/words';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';

// 13 Nov: a refusal the catalog has no words for, and with no detail (the database's `common.invalid`, one of about 180
// such keys), read "This change was refused:" and then nothing — in Arabic "رُفض هذا التغيير:" — on a phone's toast.
const none = () => false;

describe('a refused change with no words of its own', () => {
  it('and no detail is said in a whole sentence, without the colon', () => {
    expect(errorKey(new DbError('RuleBroken', 'common.invalid'), none)).toEqual({
      key: 'errors.kind.RuleBrokenBare',
      detail: '',
    });
    expect(errorKey(new DbError('RuleBroken', 'common.unavailable', '  '), none).key).toBe(
      'errors.kind.RuleBrokenBare',
    );
    expect(en.errors.kind.RuleBrokenBare).toBe('This change was refused.');
    expect(ar.errors.kind.RuleBrokenBare).toBe('رُفض هذا التغيير.');
  });
  it('with a detail keeps the general line and its detail', () => {
    expect(errorKey(new DbError('RuleBroken', 'common.invalid', 'due_on'), none)).toEqual({
      key: 'errors.kind.RuleBroken',
      detail: 'due_on',
    });
    expect(errorKey(new DbError('RuleBroken', 'common.unavailable', 'x'), none).key).toBe('errors.kind.RuleBroken');
  });
  it('with words of its own uses them, detail or not', () => {
    const has = (k: string) => k === 'errors.common.reason_required';
    expect(errorKey(new DbError('RuleBroken', 'common.reason_required'), has).key).toBe(
      'errors.common.reason_required',
    );
  });
  it('the other kinds keep their own lines', () => {
    expect(errorKey(new DbError('PermissionDenied', 'access.denied'), none).key).toBe('errors.kind.PermissionDenied');
    expect(errorKey(new DbError('NotFound', 'common.not_found'), none).key).toBe('errors.kind.NotFound');
    expect(errorKey(new Error('offline'), none)).toEqual({ key: 'errors.kind.Unavailable', detail: 'offline' });
  });
});
