import 'server-only';
import { cache } from 'react';
import { serviceDb } from '@/core/db/service';

/**
 * The app-wide settings every page needs before it knows who is asking (ACC-090/091, ACC-129/139): the admin's default
 * theme and density (a person without their own choice gets them), the default start page, and whether Arabic is on
 * (V122 — the switch shows only then, and a locale cookie saying Arabic is ignored while it is off).
 *
 * They come from `api.app_settings()` (V182, QA-207): the four keys as they stand today, the same for everyone. The server
 * reads them with its own key, so the sign-in page knows whether Arabic is on before anyone has signed in — someone not
 * signed in reaches nothing in the database (M87). When it cannot be reached the registry's defaults apply, so nothing
 * is invented and the screens behave as before. One read per request (React's cache).
 */
export type AppSettings = {
  arabic_enabled: boolean;
  default_theme: 'light' | 'dark' | 'colorful' | 'direct';
  default_density: 'comfortable' | 'compact';
  default_start_page: string | null;
};

export const APP_DEFAULTS: AppSettings = {
  arabic_enabled: false,
  default_theme: 'direct',
  default_density: 'comfortable',
  default_start_page: null,
};

const THEMES = new Set(['light', 'dark', 'colorful', 'direct']);
const DENSITIES = new Set(['comfortable', 'compact']);

export const getAppSettings = cache(async (): Promise<AppSettings> => {
  try {
    const { data, error } = await serviceDb().rpc('app_settings');
    if (error || !data || typeof data !== 'object') return APP_DEFAULTS;
    const v = data as Record<string, unknown>;
    const theme = v['app.default_theme'];
    const density = v['app.default_density'];
    const start = v['app.default_start_page'];
    return {
      arabic_enabled: v['app.arabic_enabled'] === true,
      default_theme:
        typeof theme === 'string' && THEMES.has(theme) ? (theme as AppSettings['default_theme']) : 'direct',
      default_density:
        typeof density === 'string' && DENSITIES.has(density)
          ? (density as AppSettings['default_density'])
          : 'comfortable',
      default_start_page: typeof start === 'string' && start ? start : null,
    };
  } catch {
    return APP_DEFAULTS;
  }
});
