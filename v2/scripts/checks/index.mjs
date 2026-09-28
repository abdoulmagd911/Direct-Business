// @ts-check
// Every v2 check, in the order they run. A new check is added here and gets a planted violation in tests/sabotage/.
import forwardOnlyMigrations from './forward-only-migrations.mjs';
import noBlobTables from './no-blob-tables.mjs';
import noHex from './no-hex.mjs';
import noPhysicalCss from './no-physical-css.mjs';
import noTableWrites from './no-table-writes.mjs';
import noVatColumns from './no-vat-columns.mjs';
import normRebuildCalled from './norm-rebuild-called.mjs';
import oneClient from './one-client.mjs';
import oneCopy from './one-copy.mjs';
import rule7 from './rule-7.mjs';
import v2Ids from './v2-ids.mjs';

/** @type {import('./lib.mjs').Check[]} */
export const checks = [
  rule7,
  oneClient,
  noTableWrites,
  noPhysicalCss,
  noHex,
  oneCopy,
  forwardOnlyMigrations,
  noVatColumns,
  noBlobTables,
  normRebuildCalled,
  v2Ids,
];
