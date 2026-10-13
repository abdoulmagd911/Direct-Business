import { defineModule } from '../../core/registry/define-module';

// Reports — named report editors edit drafts whatever their level (V57, V79). Levels: TECH-SPEC §8.
export default defineModule({
  key: 'reports',
  pages: [
    {
      key: 'reports',
      route: '/reports',
      label: 'nav.reports',
      icon: 'file-text',
      nav: { group: 'main', order: 90, tier: 'manage', viewer: true },
      defaults: { admin: 'full', head: 'full', manager: 'view', member: 'view', viewer: 'view' },
    },
  ],
  entities: [
    // The sections a template may hold, the templates ("sections are a setting") and each department's named editors
    // and reviewers: kept by Full on Reports.
    { key: 'report_section', table: 'report.section_def', page: 'reports', label: 'entity.report' },
    { key: 'report_template', table: 'report.template', page: 'reports', label: 'entity.report' },
    { key: 'report_editor', table: 'report.editor', page: 'reports', label: 'entity.report' },
    { key: 'report_reviewer', table: 'report.reviewer', page: 'reports', label: 'entity.report' },
    // A report and its lines: read by those who see its department with View on Reports; its drafts edited by the
    // department's named editors or Full on Reports; an issued report never changes (§3.9, P6-1).
    { key: 'report', table: 'report.report', page: 'reports', label: 'entity.report', level: 'report.row_level' },
    { key: 'report_line', table: 'report.line', page: 'reports', label: 'entity.report', level: 'report.row_level' },
    {
      key: 'report_line_achievement',
      table: 'report.line_achievement',
      page: 'reports',
      label: 'entity.report',
      level: 'report.row_level',
    },
    {
      key: 'report_line_invoice',
      table: 'report.line_invoice',
      page: 'reports',
      label: 'entity.report',
      level: 'report.row_level',
    },
  ],
});
