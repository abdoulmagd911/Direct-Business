import { z } from 'zod';
import { defineModule } from '../../core/registry/define-module';

// Every kind of notification (TECH-SPEC §3.3); an admin can switch a kind off for everyone, or a department.
export const NOTIFICATION_KINDS = [
  'assigned',
  'helper_added',
  'mentioned',
  'changed_by_other',
  'followed_change',
  'decision_needed',
  'report_issued',
  'report_for_review',
  'appraisal_step',
  'import_done',
  'alert_contract_expiring',
  'alert_kpi_behind',
  'alert_invoice_unpaid',
  'alert_kpi_checkin',
] as const;

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
  entities: [
    {
      key: 'profile',
      table: 'core.person_profile',
      page: 'settings.profile',
      label: 'entity.profile',
      owners: 'person_id',
    },
    { key: 'setting', table: 'core.setting', page: 'settings.app', label: 'entity.setting' },
    { key: 'setting_def', table: 'core.setting_def', page: 'settings.app', label: 'entity.setting_def' },
    { key: 'wording', table: 'core.wording', page: 'settings.app', label: 'entity.wording' },
    { key: 'saved_view', table: 'core.saved_view', page: null, label: 'entity.saved_view', owners: 'owner_id' },
    // Files and notes belong to whatever record they are linked to: no page of their own (V138, V139).
    { key: 'file_kind', table: 'core.file_kind', page: 'settings.app', label: 'entity.file_kind', list: true },
    { key: 'file', table: 'core.file', page: null, label: 'entity.file', owners: 'created_by' },
    { key: 'file_link', table: 'core.file_link', page: null, label: 'entity.file_link', owners: 'created_by' },
    { key: 'note', table: 'core.note', page: null, label: 'entity.note', owners: 'core.note_owners' },
    { key: 'mention', table: 'core.mention', page: null, label: 'entity.mention' },
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
      key: 'core.file_download_display_name',
      group: 'settings.app',
      label: 'setting.core.file_download_display_name',
      schema: z.boolean(),
      default: true,
    },
    {
      key: 'core.file_keep_original_name',
      group: 'settings.app',
      label: 'setting.core.file_keep_original_name',
      schema: z.boolean(),
      default: true,
    },
    {
      key: 'files.allowed_types',
      group: 'settings.app',
      label: 'setting.files.allowed_types',
      schema: z.array(z.string().regex(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/)).min(1),
      default: [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
        'text/csv',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ],
    },
    {
      key: 'files.max_mb',
      group: 'settings.app',
      label: 'setting.files.max_mb',
      schema: z.number().int().min(1).max(50),
      default: 20,
    },
    {
      key: 'notify.kinds_enabled',
      group: 'settings.app',
      label: 'setting.notify.kinds_enabled',
      schema: z.array(z.enum(NOTIFICATION_KINDS)),
      default: [...NOTIFICATION_KINDS],
    },
  ],
  capabilities: [
    // Restricted files (IBAN letters, agreements — D10): managers and admins (§3.4).
    {
      key: 'files.restricted',
      page: 'settings.app',
      label: 'cap.files.restricted',
      defaults: { head: true, manager: true },
    },
  ],
});
