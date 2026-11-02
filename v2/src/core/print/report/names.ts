import { resolveEntityTokens, type EntityKind } from '../text';
import type { Bi, Cell, ReportDoc, Section } from './model';

/**
 * Puts the current names into a report's entity tokens (V58) before it is laid out, in both languages. The frozen
 * snapshot keeps its tokens (its hash covers them); only the rendering, made at download time, shows today's names.
 */
export function withCurrentNames(doc: ReportDoc, nameOf: (kind: EntityKind, id: string) => string | null): ReportDoc {
  const t = (v: Bi): Bi => ({
    ...v,
    ar: resolveEntityTokens(v.ar, nameOf),
    ...(v.en ? { en: resolveEntityTokens(v.en, nameOf) } : {}),
  });
  const cell = (c: Cell): Cell => (c && typeof c === 'object' && 'ar' in c ? t(c) : c);
  const section = (s: Section): Section => {
    switch (s.kind) {
      case 'tiles':
        return { ...s, title: t(s.title), tiles: s.tiles.map((x) => ({ ...x, label: t(x.label) })) };
      case 'lines':
        return {
          ...s,
          title: t(s.title),
          groups: s.groups.map((g) => ({
            title: g.title ? t(g.title) : null,
            lines: g.lines.map((l) => ({ ...l, text: t(l.text) })),
          })),
        };
      case 'table':
        return { ...s, title: t(s.title), rows: s.rows.map((r) => r.map(cell)) };
    }
  };
  return { ...doc, sections: doc.sections.map(section) };
}
