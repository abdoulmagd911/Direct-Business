// Sabotage for the normalized-text check (V137): a migration whose Arabic marks are out of their canonical order, as
// norm.fold's once were. The marks are made from their code points when the sabotage runs.
const marks = String.fromCodePoint(0x65f, 0x670);

export const sabotages = [
  {
    name: 'plant-unnormalized-migration',
    breaks: ['check:normalized-text'],
    expect: '[normalized-text] changes under Unicode NFC normalization (marks U+065F U+0670)',
    writes: [
      {
        file: 'supabase/migrations/20990101000009_norm_marks.sql',
        content: `select pg_catalog.regexp_replace('made up', '[${marks}]', '', 'g');\n`,
      },
    ],
  },
];
