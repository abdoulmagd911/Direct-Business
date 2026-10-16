// Sabotages for Create's clearance on a phone (the architect's ruling of 15 Oct; option C made Create the bottom bar's
// last slot). Each puts Create back to floating over the page, as the + did before: without the foot padding the page
// ends under it, and with the padding it still sits over My day's Weekly review row at first view.
const E2E = 'e2e:tests/e2e/plus-clear.spec.ts';
const BAR_SLOT = "'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px]";
const FLOATING =
  "'fixed bottom-[calc(76px+env(safe-area-inset-bottom))] end-4 z-40 flex size-14 flex-col items-center justify-center gap-1 text-[11px]";

export const sabotages = [
  {
    name: 'page-foot-has-no-room-for-the-plus',
    breaks: [E2E],
    expect: 'Create covers nothing at the foot of',
    edits: [
      { file: 'src/ui/shell/CreateMenu.tsx', find: BAR_SLOT, replace: FLOATING },
      {
        file: 'src/ui/shell/AppShell.tsx',
        find: 'px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-6 sm:px-6',
        replace: 'px-4 pb-0 pt-6 sm:px-6',
      },
    ],
  },
  {
    name: 'create-floats-over-the-page-again',
    breaks: [E2E],
    expect: 'Create covers nothing at the top of My day',
    edits: [{ file: 'src/ui/shell/CreateMenu.tsx', find: BAR_SLOT, replace: FLOATING }],
  },
  {
    name: 'toast-sits-on-the-bottom-bar',
    breaks: [E2E],
    expect: 'the "Profile saved" toast stands above the bottom bar',
    edits: [
      {
        file: 'src/ui/globals.css',
        find: '--mobile-offset-bottom: calc(68px + env(safe-area-inset-bottom)) !important;',
        replace: '--mobile-offset-bottom: 16px !important;',
      },
    ],
  },
];
