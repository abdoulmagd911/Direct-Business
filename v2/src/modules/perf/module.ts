import { defineModule } from '../../core/registry/define-module';

// KPIs, with achievements and challenges; and the Plan & performance settings. Levels: TECH-SPEC §8.
export default defineModule({
  key: 'perf',
  pages: [
    {
      key: 'kpis',
      route: '/kpis',
      label: 'nav.kpis',
      icon: 'target',
      built: true,
      nav: { group: 'main', order: 80, tier: 'manage', viewer: true },
      defaults: { admin: 'full', head: 'full', manager: 'full', member: 'own', viewer: 'view' },
    },
    {
      key: 'settings.performance',
      route: '/settings/performance',
      label: 'nav.settings.performance',
      nav: { group: 'settings', order: 40 },
      levels: ['none', 'full'],
      defaults: { admin: 'full' },
    },
  ],
  entities: [
    // A department's plan for a year and its achievement categories: edited by admins in Settings → Targets (§3.8).
    // Their labels reuse words both catalogs hold until builder C's Arabic for their own arrives (V376).
    { key: 'plan', table: 'perf.plan', page: 'settings.performance', label: 'nav.settings.performance' },
    {
      key: 'achievement_category',
      table: 'perf.achievement_category',
      page: 'settings.performance',
      label: 'nav.settings.performance',
    },
    // An achievement and what hangs on it: seen by the whole team of its department (V96), changed by its own people
    // with Own on KPIs, or anyone's with Full (§3.8); its owner, creator and participants are told of changes.
    {
      key: 'achievement',
      table: 'perf.achievement',
      page: 'kpis',
      label: 'entity.achievement',
      owners: 'perf.achievement_owners',
      level: 'perf.row_level',
    },
    {
      key: 'achievement_ref',
      table: 'perf.achievement_ref',
      page: 'kpis',
      label: 'entity.achievement',
      owners: 'perf.achievement_ref_owners',
      level: 'perf.row_level',
    },
    {
      key: 'achievement_participant',
      table: 'perf.achievement_participant',
      page: 'kpis',
      label: 'entity.achievement',
      owners: 'perf.achievement_participant_owners',
      level: 'perf.row_level',
    },
  ],
});
