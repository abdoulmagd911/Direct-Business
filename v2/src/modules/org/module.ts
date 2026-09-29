import { z } from 'zod';
import { defineModule } from '../../core/registry/define-module';

// Settings → Organization & access: people, their allowed emails, teams, roles, the access matrix (P3-5), and signing
// a person out (V74). Levels: TECH-SPEC §8.
export default defineModule({
  key: 'org',
  pages: [
    {
      key: 'settings.org',
      route: '/settings/org',
      label: 'nav.settings.org',
      nav: { group: 'settings', order: 20 },
      defaults: { admin: 'full', head: 'view' },
    },
  ],
  capabilities: [{ key: 'org.sign_out', page: 'settings.org', label: 'cap.org.sign_out', defaults: {} }],
  settings: [
    {
      key: 'auth.device_idle_days',
      group: 'settings.org',
      label: 'setting.auth.device_idle_days',
      schema: z.number().int().min(1).max(365),
      default: 30,
    },
  ],
});
