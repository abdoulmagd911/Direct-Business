import { defineModule } from '../../core/registry/define-module';

// Appraisal — always also yourself and your reporting line (row rules, P5-8). Levels: TECH-SPEC §8.
export default defineModule({
  key: 'appraisal',
  pages: [
    {
      key: 'appraisal',
      route: '/appraisal',
      label: 'nav.appraisal',
      icon: 'clipboard-check',
      nav: { group: 'main', order: 100 },
      defaults: { admin: 'full', head: 'own', manager: 'own', member: 'own' },
    },
  ],
});
