#!/usr/bin/env node
// @ts-check
// Prints the deny-list line for a term: node scripts/checks/rule7-hash.mjs "<term>" — paste it into
// scripts/checks/rule7-denylist.txt with a comment naming only the kind of term. The term itself is never written down.
import { termHash } from './rule-7.mjs';

const term = process.argv.slice(2).join(' ');
if (!term.trim()) {
  console.error('usage: node scripts/checks/rule7-hash.mjs "<term>"');
  process.exit(2);
}
console.log(`${termHash(term)}  # <kind of term>`);
