import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

/** A page's tab title (W37): the screen's own name; the layout's template adds "· Commercial". */
export const pageTitle = (key: string) => async (): Promise<Metadata> => ({ title: (await getTranslations())(key) });
