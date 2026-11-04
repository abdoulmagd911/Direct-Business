import { defineModule } from '../../core/registry/define-module';

// Imports — per-company file imports (invoice, expense and promo exports), draft until confirmed.
// The batch and its money rows are change-logged tables, so they are record types (ENT-01);
// their page is Finance, where the import preview lives.
export default defineModule({
  key: 'imports',
  entities: [
    {
      key: 'import_batch',
      table: 'work.import_batch',
      page: 'finance',
      label: 'entity.import_batch',
      owners: 'created_by',
    },
    {
      key: 'import_record',
      table: 'work.import_record',
      page: 'finance',
      label: 'entity.import_record',
      owners: 'created_by',
    },
  ],
});
