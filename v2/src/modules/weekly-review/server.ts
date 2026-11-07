import 'server-only';
import { serverRpc } from '@/core/db/server-rpc';
import type { Category } from '@/modules/perf/types';
import type { UnloggedAnswer, WeeklyReviewAnswer } from './types';

/** My week (api.weekly_review): the week holding today in Riyadh. Null when the read failed, so the screen says so. */
export async function weeklyReview(): Promise<WeeklyReviewAnswer | null> {
  try {
    return (await serverRpc('weekly_review', {})) as unknown as WeeklyReviewAnswer;
  } catch {
    return null;
  }
}

/** My closed tasks with no achievement logged (api.weekly_unlogged): this week's on top, then older ones, capped
 * at 50. Null when the read failed — the review still draws, without the nudge actions. */
export async function weeklyUnlogged(showRoutine = false): Promise<UnloggedAnswer | null> {
  try {
    return (await serverRpc('weekly_unlogged', { p_show_routine: showRoutine })) as unknown as UnloggedAnswer;
  } catch {
    return null;
  }
}

/** The achievement categories of this year's plan, for the inline quick form (empty when the read failed, so the
 * Log action falls back to the full form). */
export async function achievementCategories(year: number): Promise<Category[]> {
  try {
    return (await serverRpc('achievement_categories', { p_year: year })) as unknown as Category[];
  } catch {
    return [];
  }
}
