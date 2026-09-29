import { z } from 'zod';
import { defineModule } from '../../core/registry/define-module';

// Tasks, and the Work settings (§3.2). Levels: TECH-SPEC §8.
export default defineModule({
  key: 'tasks',
  pages: [
    {
      key: 'tasks',
      route: '/tasks',
      label: 'nav.tasks',
      icon: 'check-square',
      nav: { group: 'main', order: 60 },
      defaults: { admin: 'full', head: 'full', manager: 'full', member: 'own', viewer: 'view' },
    },
    {
      key: 'settings.work',
      route: '/settings/work',
      label: 'nav.settings.work',
      nav: { group: 'settings', order: 60 },
      levels: ['none', 'full'],
      defaults: { admin: 'full' },
    },
  ],
  capabilities: [
    { key: 'tasks.assign', page: 'tasks', label: 'cap.tasks.assign', defaults: { head: true, manager: true } },
  ],
  entities: [
    { key: 'priority', table: 'work.priority', page: 'settings.work', label: 'entity.priority', list: true },
    // Direct's systems a reference points into, with each one's URL pattern (V98, V99, V154).
    { key: 'ref_system', table: 'work.ref_system', page: 'settings.work', label: 'entity.ref_system', list: true },
  ],
  settings: [
    {
      // V400: an entry logged more than this many days after it happened is "logged late" (after go-live).
      key: 'work.late_days',
      group: 'settings.work',
      label: 'setting.work.late_days',
      schema: z.number().int().min(1).max(90),
      default: 14,
    },
    {
      key: 'work.no_update_days',
      group: 'settings.work',
      label: 'setting.work.no_update_days',
      schema: z.number().int().min(1).max(60),
      default: 7,
      effectiveDated: true,
    },
    {
      key: 'work.week_starts_on',
      group: 'settings.work',
      label: 'setting.work.week_starts_on',
      schema: z.enum(['saturday', 'sunday', 'monday']),
      default: 'sunday',
      effectiveDated: true,
    },
    {
      key: 'work.meeting_note_on_time_days',
      group: 'settings.work',
      label: 'setting.work.meeting_note_on_time_days',
      schema: z.number().int().min(0).max(14),
      default: 1,
      effectiveDated: true,
    },
    {
      key: 'work.reminder_days_before_due',
      group: 'settings.work',
      label: 'setting.work.reminder_days_before_due',
      schema: z.number().int().min(0).max(30),
      default: 1,
      effectiveDated: true,
    },
    {
      key: 'work.pipeline_weekly_target',
      group: 'settings.work',
      label: 'setting.work.pipeline_weekly_target',
      schema: z.number().int().min(0).max(100),
      default: 1,
      effectiveDated: true,
    },
  ],
});
