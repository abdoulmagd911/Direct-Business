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
  'alert_activity_stale',
  'alert_file_review',
  'reminder',
  'note_mention',
  'escalated',
  'alert_project_no_update',
  'alert_due_tomorrow',
  'alert_quiet_client',
] as const;

/** The seven a work-tier person sees in My profile, and the only ones on for them from the start (V217, cut 6). */
export const WORK_NOTIFICATION_KINDS = [
  'assigned',
  'helper_added',
  'mentioned',
  'decision_needed',
  'changed_by_other',
  'reminder',
  'note_mention',
] as const satisfies readonly (typeof NOTIFICATION_KINDS)[number][];

// Settings: My profile (every person's own — it cannot be switched off) and App — admins only, levels none / Full, like
// every Settings page (V97) — and Activity (the change log), whose key is not a Settings key, so heads and managers keep
// their View; where its entry sits is the screens' (V138). Levels: TECH-SPEC §8.
export default defineModule({
  key: 'settings',
  pages: [
    {
      // My profile is everyone's, reached from the profile chip — not a Settings group (V97); no drawer entry.
      key: 'settings.profile',
      route: '/profile',
      label: 'nav.settings.profile',
      levels: ['own'],
      defaults: { admin: 'own', head: 'own', manager: 'own', member: 'own', viewer: 'own' },
    },
    {
      key: 'settings.app',
      route: '/settings/app',
      label: 'nav.settings.app',
      nav: { group: 'settings', order: 70 },
      levels: ['none', 'full'],
      defaults: { admin: 'full' },
    },
    {
      // Activity is its own page (V97): the change log, the settings log with Revert, the sign-in log.
      key: 'activity',
      route: '/activity',
      label: 'nav.activity',
      icon: 'history',
      nav: { group: 'main', order: 110, tier: 'manage', from: 'head' },
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
    // Files and notes belong to whatever record they are linked to: seen and changed as it allows (V150, V152).
    { key: 'file_kind', table: 'core.file_kind', page: 'settings.app', label: 'entity.file_kind', list: true },
    {
      key: 'file',
      table: 'core.file',
      page: null,
      label: 'entity.file',
      owners: 'created_by',
      visible: 'core.file_visible_as',
    },
    {
      key: 'file_link',
      table: 'core.file_link',
      page: null,
      label: 'entity.file_link',
      owners: 'created_by',
      visible: 'core.file_link_visible',
    },
    {
      key: 'note',
      table: 'core.note',
      page: null,
      label: 'entity.note',
      owners: 'core.note_owners',
      visible: 'core.note_visible',
      level: 'core.note_level',
      // What happened stays as it was logged: retiring an activity type or outcome leaves its notes alone (V161).
      history: true,
    },
    {
      key: 'mention',
      table: 'core.mention',
      page: null,
      label: 'entity.mention',
      visible: 'core.mention_visible',
      level: 'core.mention_level',
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
      // The day the app goes live (V400): an entry that happened on or after it and was logged more than
      // work.late_days later is "logged late". Empty: nothing is late yet.
      key: 'app.go_live_on',
      group: 'settings.app',
      label: 'setting.app.go_live_on',
      schema: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
      default: '',
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
      // The start page of everyone who has not chosen their own (ACC-091, V214, QA-207): a page of the main
      // navigation; a person who may not see it lands on My day.
      key: 'app.default_start_page',
      group: 'settings.app',
      label: 'setting.app.default_start_page',
      schema: z.enum([
        'my_day',
        'overview',
        'clients',
        'suppliers_partners',
        'pipeline',
        'projects',
        'tasks',
        'finance',
        'kpis',
        'reports',
        'appraisal',
        'activity',
      ]),
      default: 'my_day',
    },
    {
      key: 'app.export_formats',
      group: 'settings.app',
      label: 'setting.app.export_formats',
      schema: z.array(z.enum(['csv', 'xlsx'])).min(1),
      default: ['csv', 'xlsx'],
    },
    {
      key: 'audit.recently_deleted_days',
      group: 'settings.app',
      label: 'setting.audit.recently_deleted_days',
      schema: z.number().int().min(1).max(365),
      default: 30,
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
    // Restricted files (IBAN letters, agreements — D10): heads and managers by default, admins always (§3.4).
    {
      key: 'files.restricted',
      page: 'settings.app',
      label: 'cap.files.restricted',
      defaults: { head: true, manager: true },
    },
  ],
});
