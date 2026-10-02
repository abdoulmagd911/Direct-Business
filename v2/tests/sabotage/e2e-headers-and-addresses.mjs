// Sabotages for W31 and W32: no security headers, a signed-out /api address sent to the sign-in page, and an unknown
// address answered 200 must each turn their spec red.
const spec = 'e2e:tests/e2e/security-headers-and-addresses-nothing-answers.spec.ts';
const unit = 'unit:tests/unit/http/every-answer-carries-the-security-headers.test.ts';

export const sabotages = [
  {
    name: 'e2e-no-security-headers',
    breaks: [spec],
    expect: 'every answer carries the security headers',
    edits: [
      {
        file: 'next.config.ts',
        find: "    return [{ source: '/:path*', headers: securityHeaders(url, process.env.NODE_ENV !== 'production') }];",
        replace: '    return url ? [] : [];',
      },
    ],
  },
  {
    name: 'e2e-api-sent-to-sign-in',
    breaks: [spec],
    expect: 'signed out, an /api address answers 401 in JSON',
    edits: [
      {
        file: 'src/core/db/proxy-session.ts',
        find: "  return path === '/api' || path.startsWith('/api/');",
        replace: '  return path === null;',
      },
    ],
  },
  {
    name: 'e2e-unknown-address-answers-200',
    breaks: [spec],
    expect: 'signed in, an address nothing answers is a 404',
    edits: [
      {
        file: 'src/app/(app)/[[...path]]/page.tsx',
        find: '  if (!path?.length) redirect(await startRoute());\n  notFound();',
        replace:
          '  if (!path?.length) redirect(await startRoute());\n  if (path.length > 9) notFound();\n  return <div data-state="not-found">Page not found</div>;',
      },
    ],
  },
  {
    name: 'framing-allowed',
    breaks: [unit],
    expect: 'no other site may frame the app',
    edits: [
      {
        file: 'src/core/http/security-headers.ts',
        find: `    ['frame-ancestors', ["'none'"]],`,
        replace: `    ['frame-ancestors', ["'self'"]],`,
      },
    ],
  },
];
