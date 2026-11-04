import { defineModule } from '../../core/registry/define-module';

// Discount Codes — standalone individual bookings, tracked for targets, KPIs and audit (owner decisions 4 Nov 2026).
// Levels: like Reports — everyone who can see the page reads it; only Full records a use or an attribution.
export default defineModule({
  key: 'codes',
  pages: [
    {
      key: 'codes',
      route: '/codes',
      label: 'nav.codes',
      icon: 'tag',
      built: true,
      nav: { group: 'main', order: 95, tier: 'manage', viewer: true },
      defaults: { admin: 'full', head: 'full', manager: 'view', member: 'view', viewer: 'view' },
    },
  ],
  entities: [
    // A recorded use of a code on one invoice, and a code's company attribution (promo only, apart from the
    // company's own totals). Both belong to the person who recorded them.
    { key: 'code_use', table: 'finance.code_use', page: 'codes', label: 'entity.code_use', owners: 'created_by' },
    {
      key: 'code_attribution',
      table: 'finance.code_attribution',
      page: 'codes',
      label: 'entity.code_attribution',
      owners: 'created_by',
    },
  ],
});
