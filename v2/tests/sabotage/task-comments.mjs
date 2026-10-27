// Sabotages for the comments on a task (V657, Stage L step L-5): the reader's box, the delete's own question, the tab.
const E2E = 'e2e:tests/e2e/task-comments.spec.ts';

export const sabotages = [
  {
    name: 'comment-box-shows-to-a-reader',
    breaks: [E2E],
    expect: 'a reader has no box',
    edits: [{ file: 'src/modules/tasks/screens/TaskComments.tsx', find: '{data.can_write ? (', replace: '{true ? (' }],
  },
  {
    name: 'comment-delete-asks-nothing',
    breaks: [E2E],
    expect: 'alertdialog',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskComments.tsx',
        find: 'onClick={() => setRemoving(c)}',
        replace: 'onClick={() => void remove(c)}',
      },
    ],
  },
  {
    name: 'comments-tab-shows-nothing',
    breaks: [E2E],
    expect: 'No comments yet',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskRecord.tsx',
        find: "{tab === 'comments' ? (",
        replace: "{tab === 'comments-off' ? (",
      },
    ],
  },
  {
    name: 'comment-waits-for-the-reread',
    breaks: [E2E],
    expect: 'the comment shows at once',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskComments.tsx',
        find: '[...data.comments, ...added.filter((a) => !data.comments.some((c) => c.id === a.id))]',
        replace: '[...data.comments]',
      },
    ],
  },
  {
    name: 'comments-tab-count-waits-for-the-reread',
    breaks: [E2E],
    expect: 'and the tab counts it at once',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskRecord.tsx',
        find: '(commentCount ?? comments?.comments.length ?? undefined)',
        replace: '(comments?.comments.length ?? undefined)',
      },
    ],
  },
];
