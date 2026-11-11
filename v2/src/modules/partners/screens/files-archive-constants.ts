/** The page sizes the files archive offers: 10 / 25 / 50 / 100, default 25 (FIX-08 F151).
 * Kept in a plain file (no 'use client'): the server page (files-archive-page.tsx) imports these, and a
 * 'use client' file hands a server page placeholder values, which crashed /files with
 * "PAGE_SIZES.includes is not a function". */
export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;
