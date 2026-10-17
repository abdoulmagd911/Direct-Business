// Sabotages for the Mark done? pop-up and the phone task page's action row (the owner's live test of 17 Oct, V641; builder D).
const E2E = 'e2e:tests/e2e/done-pop-up-and-phone-actions.spec.ts';
const TICK = 'src/modules/tasks/screens/StatusControl.tsx';
const RECORD = 'src/modules/tasks/screens/TaskRecord.tsx';

export const sabotages = [
  {
    // the round tick completes the task at once, as before
    name: 'done-tick-completes-without-asking',
    breaks: [E2E],
    expect: 'the tick opens a Mark done? box',
    edits: [{ file: TICK, find: 'onClick={() => setAsking(true)}', replace: 'onClick={() => void move.markDone?.()}' }],
  },
  {
    // Cancel has focus, so Enter would cancel
    name: 'done-box-focuses-cancel',
    breaks: [E2E],
    expect: 'Done has focus, so Enter confirms',
    edits: [{ file: TICK, find: 'focus="confirm"', replace: 'focus="cancel"' }],
  },
  {
    // the confirming button does not say Done
    name: 'done-box-button-does-not-say-done',
    breaks: [E2E],
    expect: 'the button says Done',
    edits: [{ file: TICK, find: "t('pages.tasks.doneAsk.done')", replace: "t('common.save')" }],
  },
  {
    // Edit stays on the phone's row
    name: 'phone-task-edit-stays-on-the-row',
    breaks: [E2E],
    expect: 'Edit is not on the row',
    edits: [
      {
        file: RECORD,
        find: '<Button icon={<Pencil />} className="max-sm:hidden"',
        replace: '<Button icon={<Pencil />}',
      },
    ],
  },
  {
    // Follow up stays on the phone's row
    name: 'phone-task-follow-up-stays-on-the-row',
    breaks: [E2E],
    expect: 'Follow up is not on the row',
    edits: [
      {
        file: RECORD,
        find: '<FollowUpButton about={follow} className="max-sm:hidden" />',
        replace: '<FollowUpButton about={follow} />',
      },
    ],
  },
  {
    // the dots fall to a second row on a phone
    name: 'phone-task-dots-fall-to-a-second-row',
    breaks: [E2E],
    expect: 'the actions all sit on one row',
    edits: [{ file: RECORD, find: "className={escalatable ? undefined : 'sm:hidden'}", replace: 'className="w-full"' }],
  },
];
