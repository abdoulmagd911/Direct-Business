'use client';
import { useTranslations } from 'next-intl';
import { useMe } from '@/core/auth/me-context';
import { Comments } from '@/ui/record/Comments';
import type { RecordFile } from '@/ui/record/FilesSection';
import type { TaskComments as CommentsData, TaskDetail } from '../types';

export { COMMENT_MAX } from '@/ui/record/Comments';

/**
 * A task's comments (V657): the generic Discussion on the task. It reads core.comment (the Phase 2 cutover moved the
 * task's comments there); the old work.task_comment table's read path is retired.
 *
 * Landing 33: on a task a mention is a hand to help — the person becomes a helper (the note under the box says so).
 */
export function TaskComments({
  task,
  data,
  personName,
  locale,
  people,
  onCount,
  files,
  onFilesRetry,
  initialFilter,
  projects,
}: {
  task: Pick<TaskDetail, 'id' | 'number'>;
  data: CommentsData;
  personName: (id: string | null) => string;
  locale: 'en' | 'ar';
  /** The people who may be asked, named in the language on screen. */
  people?: { id: string; name: string }[];
  /** How many comments the screen shows now, so the tab's number follows an add or a delete at once. */
  onCount?: (n: number | null) => void;
  /** The task's files, merged into the Discussion stream; null when the files read failed. */
  files?: RecordFile[] | null;
  /** Try the files read again, after it failed. */
  onFilesRetry?: () => void;
  /** The filter the Discussion opens on — the header's files count links here with it. */
  initialFilter?: 'all' | 'files' | 'questions';
  /** The projects a comment may link with "@" (the search itself has none). */
  projects?: { id: string; name: string; number?: string | null }[];
}) {
  const t = useTranslations();
  const me = useMe();
  return (
    <Comments
      entity="task"
      id={task.id}
      data={data}
      locale={locale}
      personName={personName(me.person.id)}
      people={people}
      label={t('pages.tasks.tabs.discussion')}
      onCount={onCount}
      files={files}
      onFilesRetry={onFilesRetry}
      initialFilter={initialFilter}
      projects={projects}
      mentionNote={t('pages.tasks.comments.mentionNote')}
    />
  );
}
