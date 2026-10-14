// @ts-check
// Which sabotages a change must run (V634 (2), V281). On a pull request the sabotage runner proves again only what the
// change could have broken; v2/main runs the full set on every push, so anything this misses turns main red there.
//
// A sabotage runs when any of these holds:
//   1. the change adds or edits the sabotage itself (its .patch / .sql, or its entry in a .mjs file);
//   2. the change adds or edits a spec (or test) the sabotage breaks, or a helper of the specs that spec imports
//      (tests/e2e/helpers.ts, tests/e2e/support/*, followed through their own imports);
//   3. the change edits a file the sabotage plants into;
//   4. the change touches a MODULE that one of the same spec's sabotages plants into — the spec↔module mapping. A
//      module is one of the folders
//        src/modules/<m> · src/core/<x> · src/app/(app)/<route> · src/app/<segment> · src/ui/<folder>
//      and a spec covers it when one of its sabotages plants a file there, so the mapping is read from the sabotages
//      and never kept by hand: a new sabotage widens it in the same PR. `sabotage.mjs --map` prints it. A file in no
//      module (a kit component such as src/ui/Tabs.tsx; messages/en.json, which nearly every PR edits) is matched by
//      rule 3 alone.
// Every sabotage runs when the change touches one of FULL_RUN — the runner, CI and the build, which every spec leans on.
//
// Paths are relative to v2/; a changed file outside v2/ is written `../<its path from the repository root>`.

/** Files and folders (ending in /) whose change runs every sabotage. */
export const FULL_RUN = [
  'scripts/sabotage.mjs',
  'scripts/sabotage-select.mjs',
  'scripts/e2e/',
  '../.github/workflows/v2.yml',
  'package.json',
  'pnpm-lock.yaml',
  '.nvmrc',
  'tsconfig.json',
  'next.config.ts',
  'playwright.config.ts',
  'supabase/config.toml',
  'src/proxy.ts',
  'src/app/layout.tsx',
];

/** The module folder a file is in (see the header), or null. @param {string} file */
export function moduleOf(file) {
  const m =
    /^src\/(?:modules|core)\/[^/]+(?=\/)/.exec(file) ??
    /^src\/app\/\(app\)\/[^/]+(?=\/)/.exec(file) ??
    /^src\/app\/(?!\(app\)\/)[^/]+(?=\/)/.exec(file) ??
    /^src\/ui\/[^/]+(?=\/)/.exec(file);
  return m ? m[0] : null;
}

/** The file a target names, when it names one (e2e:, unit:, lint:<path>). @param {string} target */
export function targetFile(target) {
  const [kind, arg = ''] = target.split(/:(.*)/s);
  return kind === 'e2e' || kind === 'unit' || kind === 'lint' ? arg : '';
}

/**
 * @typedef {{ name: string, breaks: string[], source: string, plants: string[] }} Planned
 * @typedef {{ full: string | null, reasons: Map<string, string> }} Selection
 */

/** Each target and the modules its sabotages plant into. @param {Planned[]} all */
function coverage(all) {
  /** @type {Map<string, Set<string>>} */
  const covers = new Map();
  for (const s of all)
    for (const t of s.breaks) {
      const set = covers.get(t) ?? new Set();
      for (const p of s.plants) {
        const m = moduleOf(p);
        if (m) set.add(m);
      }
      covers.set(t, set);
    }
  return covers;
}

/**
 * Picks the sabotages a change must run.
 * @param {Planned[]} all every sabotage in the tree, with the files it plants into
 * @param {string[]} changed the files the change adds, edits or deletes (v2-relative, see the header)
 * @param {Set<string>} edited the names of the sabotages the change adds or edits (rule 1)
 * @param {Map<string, string[]>} [uses] each spec and the local helper files it imports (rule 2)
 * @returns {Selection} `full` names the FULL_RUN file that runs everything; `reasons` maps each chosen sabotage to why
 */
export function select(all, changed, edited, uses = new Map()) {
  /** @type {Map<string, string>} */
  const reasons = new Map();
  const hit = changed.find((f) => FULL_RUN.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p)));
  if (hit) {
    for (const s of all) reasons.set(s.name, `every sabotage runs: ${hit} changed`);
    return { full: hit, reasons };
  }
  const files = new Set(changed);
  const modules = new Set(changed.map(moduleOf).filter(Boolean));
  const covers = coverage(all);
  for (const s of all) {
    if (edited.has(s.name)) {
      reasons.set(s.name, `the sabotage itself is new or edited (${s.source})`);
      continue;
    }
    const spec = s.breaks.map(targetFile).find((f) => f && files.has(f));
    if (spec) {
      reasons.set(s.name, `its spec ${spec} changed`);
      continue;
    }
    const helper = s.breaks
      .map(targetFile)
      .flatMap((f) => (uses.get(f) ?? []).map((h) => [f, h]))
      .find(([, h]) => files.has(/** @type {string} */ (h)));
    if (helper) {
      reasons.set(s.name, `${helper[1]}, which its spec ${helper[0]} imports, changed`);
      continue;
    }
    const planted = s.plants.find((p) => files.has(p));
    if (planted) {
      reasons.set(s.name, `${planted}, which it plants into, changed`);
      continue;
    }
    for (const t of s.breaks) {
      const m = [...(covers.get(t) ?? [])].find((x) => modules.has(x));
      if (m) {
        reasons.set(s.name, `${m} changed, and ${targetFile(t) || t} covers it`);
        break;
      }
    }
  }
  return { full: null, reasons };
}

/**
 * The spec↔module mapping, for `--map`: each target and the modules its sabotages plant into.
 * @param {Planned[]} all @returns {[string, string[]][]}
 */
export function mapping(all) {
  return [...coverage(all)].map(([t, m]) => /** @type {[string, string[]]} */ ([t, [...m].sort()])).sort();
}
