import { z } from 'zod';
import { defineModule } from '../../core/registry/define-module';

// Settings: My profile (every person's own — it cannot be switched off), App, and Activity (the change log).
// Levels: TECH-SPEC §8.
export default defineModule({
  key: 'settings',
  pages: [
    {
      key: 'settings.profile',
      route: '/settings/profile',
      label: 'nav.settings.profile',
      nav: { group: 'settings', order: 10 },
      levels: ['own'],
      defaults: { admin: 'own', head: 'own', manager: 'own', member: 'own', viewer: 'own' },
    },
    {
      key: 'settings.app',
      route: '/settings/app',
      label: 'nav.settings.app',
      nav: { group: 'settings', order: 70 },
      defaults: { admin: 'full', head: 'view' },
    },
    {
      key: 'activity',
      route: '/settings/activity',
      label: 'nav.activity',
      nav: { group: 'settings', order: 80 },
      defaults: { admin: 'full', head: 'view', manager: 'view' },
    },
  ],
  settings: [
    {
      key: 'app.arabic_enabled',
      group: 'settings.app',
      label: 'setting.app.arabic_enabled',
      schema: z.boolean(),
      default: false,
    },
    {
      key: 'app.default_theme',
      group: 'settings.app',
      label: 'setting.app.default_theme',
      schema: z.enum(['light', 'dark', 'colorful', 'direct']),
      default: 'direct',
    },
    {
      key: 'app.default_density',
      group: 'settings.app',
      label: 'setting.app.default_density',
      schema: z.enum(['comfortable', 'compact']),
      default: 'comfortable',
    },
    {
      key: 'app.export_formats',
      group: 'settings.app',
      label: 'setting.app.export_formats',
      schema: z.array(z.enum(['csv', 'xlsx'])).min(1),
      default: ['csv', 'xlsx'],
    },
    {
      key: 'audit.undo_window_hours',
      group: 'settings.app',
      label: 'setting.audit.undo_window_hours',
      schema: z.number().int().min(1).max(168),
      default: 24,
    },
    {
      key: 'files.max_mb',
      group: 'settings.app',
      label: 'setting.files.max_mb',
      schema: z.number().int().min(1).max(50),
      default: 20,
    },
  ],
});
