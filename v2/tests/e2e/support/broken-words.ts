import type { Page } from '@playwright/test';

/**
 * Every word inside the matching elements that the page breaks across two lines ("Departme" / "nt"): a word whose text
 * range has pieces on more than one line. A line that wraps between words is not a broken word.
 */
export const brokenWords = (page: Page, scope: string): Promise<string[]> =>
  page.evaluate((selector) => {
    const out: string[] = [];
    for (const root of Array.from(document.querySelectorAll(selector))) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.parentElement?.getClientRects().length) continue;
        const text = node.textContent ?? '';
        for (const m of text.matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, m.index!);
          range.setEnd(node, m.index! + m[0].length);
          const lines = new Set(
            Array.from(range.getClientRects())
              .filter((r) => r.width > 0)
              .map((r) => Math.round(r.top)),
          );
          if (lines.size > 1) out.push(m[0]);
        }
      }
    }
    return Array.from(new Set(out));
  }, scope);
