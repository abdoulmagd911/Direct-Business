export default {
  expect: 'check-ui-no-hints',
  files: ['src/ui/DataState.tsx'],
  apply: (f, s) =>
    s +
    '\nexport function Banner({ children }: { children: React.ReactNode }) { return <div className="banner">{children}</div>; }\n',
  command: ['node', 'scripts/check-ui-no-hints.mjs'],
};
