import { describe, expect, it } from 'vitest';
import { taskIsTestOwned } from '@/modules/tasks/rules';

const TEST_OWNER = '11111111-1111-4111-8111-111111111111';
const TEST_CREATOR = '22222222-2222-4222-8222-222222222222';
const REAL = '33333333-3333-4333-8333-333333333333';
const PEOPLE = [
  { id: TEST_OWNER, is_test: true },
  { id: TEST_CREATOR, is_test: true },
  { id: REAL, is_test: false },
];

describe('task remove gate: only test tasks show Remove', () => {
  it('a TEST owner shows Remove', () => {
    expect(taskIsTestOwned({ owner_id: TEST_OWNER, created_by: REAL }, PEOPLE)).toBe(true);
  });

  it('a TEST creator shows Remove even when the owner is real', () => {
    expect(taskIsTestOwned({ owner_id: REAL, created_by: TEST_CREATOR }, PEOPLE)).toBe(true);
  });

  it('a real owner and a real creator hide Remove', () => {
    expect(taskIsTestOwned({ owner_id: REAL, created_by: REAL }, PEOPLE)).toBe(false);
  });

  it('an unknown owner and creator hide Remove', () => {
    expect(taskIsTestOwned({ owner_id: '44444444-4444-4444-8444-444444444444', created_by: REAL }, PEOPLE)).toBe(false);
  });

  it('a task with no owner still shows Remove when its creator is TEST', () => {
    expect(taskIsTestOwned({ owner_id: null, created_by: TEST_CREATOR }, PEOPLE)).toBe(true);
  });
});
