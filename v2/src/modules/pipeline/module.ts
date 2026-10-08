import { defineModule } from '../../core/registry/define-module';

// Pipeline — tenders and partnership opportunities (V80). Levels: TECH-SPEC §8.
export default defineModule({
  key: 'pipeline',
  pages: [
    {
      key: 'pipeline',
      route: '/pipeline',
      label: 'nav.pipeline',
      icon: 'git-branch',
      nav: { group: 'main', order: 40, tier: 'work' },
      defaults: { admin: 'full', head: 'full', manager: 'full', member: 'own', viewer: 'view' },
    },
  ],
  capabilities: [
    // Giving a card to someone else (§3.7a), like tasks.assign.
    { key: 'pipeline.assign', page: 'pipeline', label: 'cap.pipeline.assign', defaults: { head: true, manager: true } },
  ],
  entities: [
    // The boards' lists (V99, V457, V476): stages on locked meanings, the Source every card needs, the lost reasons.
    {
      key: 'pipeline_stage',
      table: 'pipeline.stage',
      page: 'settings.work',
      label: 'entity.pipeline_stage',
      list: true,
    },
    {
      key: 'pipeline_source',
      table: 'pipeline.source',
      page: 'settings.work',
      label: 'entity.pipeline_source',
      list: true,
    },
    {
      key: 'pipeline_lost_reason',
      table: 'pipeline.lost_reason',
      page: 'settings.work',
      label: 'entity.pipeline_lost_reason',
      list: true,
    },
    // A card: seen by the whole team of its department (V96), changed by its owner or maker with Own, or with Full.
    {
      key: 'tender',
      table: 'pipeline.tender',
      page: 'pipeline',
      label: 'entity.tender',
      owners: 'pipeline.tender_owners',
      level: 'pipeline.row_level',
    },
    {
      key: 'opportunity',
      table: 'pipeline.opportunity',
      page: 'pipeline',
      label: 'entity.opportunity',
      owners: 'pipeline.opportunity_owners',
      level: 'pipeline.row_level',
    },
    {
      key: 'pipeline_stage_change',
      table: 'pipeline.stage_change',
      page: 'pipeline',
      label: 'entity.pipeline_stage_change',
      owners: 'pipeline.stage_change_owners',
      level: 'pipeline.row_level',
      // What happened stays as it was logged: retiring a stage leaves its history alone (V161).
      history: true,
    },
  ],
});
