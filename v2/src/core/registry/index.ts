// The registry index (TECH-SPEC §2.3): every module, in drawer order. A new module is added here and nowhere else;
// `pnpm registry:sync` then writes the database's copy (V123).
import appraisal from '../../modules/appraisal/module';
import finance from '../../modules/finance/module';
import myDay from '../../modules/my-day/module';
import org from '../../modules/org/module';
import overview from '../../modules/overview/module';
import partners from '../../modules/partners/module';
import perf from '../../modules/perf/module';
import pipeline from '../../modules/pipeline/module';
import projects from '../../modules/projects/module';
import reports from '../../modules/reports/module';
import settings from '../../modules/settings/module';
import tasks from '../../modules/tasks/module';
import type { ModuleDef } from './define-module';

export const modules: readonly ModuleDef[] = [
  myDay,
  overview,
  partners,
  pipeline,
  projects,
  tasks,
  finance,
  perf,
  reports,
  appraisal,
  org,
  settings,
];
