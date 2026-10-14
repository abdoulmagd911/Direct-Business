import 'server-only';
import { serverRpc } from '@/core/db/server-rpc';
import type { WeeklyReviewAnswer } from './types';

/** My week (api.weekly_review): the week holding today in Riyadh. Null when the read failed, so the screen says so. */
export async function weeklyReview(): Promise<WeeklyReviewAnswer | null> {
  try {
    return (await serverRpc('weekly_review', {})) as unknown as WeeklyReviewAnswer;
  } catch {
    return null;
  }
}
