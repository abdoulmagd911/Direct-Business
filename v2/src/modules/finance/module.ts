import { z } from 'zod';
import { defineModule } from '../../core/registry/define-module';

// Finance — Own is entering invoices and editing your own entries (owner decision 4). Levels: TECH-SPEC §8.
export default defineModule({
  key: 'finance',
  pages: [
    {
      key: 'finance',
      route: '/finance',
      label: 'nav.finance',
      icon: 'wallet',
      nav: { group: 'main', order: 70, tier: 'manage' },
      defaults: { admin: 'full', head: 'full', manager: 'full', member: 'own', viewer: 'view' },
    },
    {
      key: 'settings.finance',
      route: '/settings/finance',
      label: 'nav.settings.finance',
      nav: { group: 'settings', order: 50 },
      levels: ['none', 'full'],
      defaults: { admin: 'full' },
    },
  ],
  capabilities: [
    { key: 'finance.import', page: 'finance', label: 'cap.finance.import', defaults: { head: true } },
    { key: 'finance.credit', page: 'finance', label: 'cap.finance.credit', defaults: { head: true, manager: true } },
  ],
  entities: [
    // An invoice is its enterer's (Own: your own entries; an imported one is Import's — V44); its parts go with it (V157).
    { key: 'invoice', table: 'finance.invoice', page: 'finance', label: 'entity.invoice', owners: 'created_by' },
    ...(
      [
        ['invoice_line', 'finance.invoice_line'],
        ['billing_link', 'finance.billing_link'],
        ['billing_proposal', 'finance.billing_proposal'],
        ['expense_line', 'finance.expense_line'],
        ['tax_invoice', 'finance.tax_invoice'],
        ['credit_split', 'finance.credit_split'],
      ] as const
    ).map(([key, table]) => ({ key, table, page: 'finance', label: `entity.${key}`, owners: `${table}_owners` })),
    // A closed month and its snapshot (V610): the person who closed it.
    {
      key: 'month_close',
      table: 'finance.month_close',
      page: 'finance',
      label: 'entity.month_close',
      owners: 'created_by',
    },
    // The exclusion rules (D16): Settings → Finance, admins (V97).
    {
      key: 'exclusion_rule',
      table: 'finance.exclusion_rule',
      page: 'settings.finance',
      label: 'entity.exclusion_rule',
    },
    // The Finance lists (§3.6): Settings → Finance, admins (V97).
    ...(
      [
        ['status_map', 'finance.status_map'],
        ['expense_status_word', 'finance.expense_status_word'],
        ['service', 'finance.service'],
        ['product', 'finance.product'],
        ['wallet_rule', 'finance.wallet_rule'],
        ['commission_word', 'finance.commission_word'],
        ['channel', 'finance.channel'],
      ] as const
    ).map(([key, table]) => ({ key, table, page: 'settings.finance', label: `entity.${key}`, list: true })),
  ],
  settings: [
    {
      // V614 / Q46: whether a tender's signed value is revenue and profit in its signing month, or the account manager's
      // sales credit only. 'unset' until the owner answers (P4-2 does not ship unset); finance.tender_use reads it as of
      // each month.
      key: 'finance.tender_counts_as',
      group: 'settings.finance',
      label: 'setting.finance.tender_counts_as',
      schema: z.enum(['unset', 'sales_credit', 'revenue']),
      default: 'unset',
      effectiveDated: true,
    },
  ],
});
