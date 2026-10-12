import { getLocale, getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import { nameOf, type OrgAnswer } from '@/modules/org/types';
import { riyadhDay } from '../period';
import type { ListEntry, Lists } from '../invoice-form';
import { NewInvoice } from './NewInvoice';

const list = async (name: string) => ((await serverRpc('list', { p_list: name })) as ListEntry[] | null) ?? [];

/**
 * New invoice (P4-4, GC-5): for a person with Full on Finance — typing an invoice is a write (V622). The word lists the
 * form offers (statuses, services, products, channels) are read from the database, never typed into the screen (V621).
 * A list that cannot be read is said so in place; the form is not drawn half-empty.
 */
export async function NewInvoicePage() {
  const [me, t] = await Promise.all([requireMe(), getTranslations()]);
  const full = (me.levels.finance ?? 'none') === 'full';
  const locale = (await getLocale()) as 'en' | 'ar';
  let lists: Lists | null = null;
  let people: { id: string; label: string }[] = [];
  if (full) {
    try {
      const [status, expenseStatus, product, service, channel] = await Promise.all([
        list('status_map'),
        list('expense_status_word'),
        list('product'),
        list('service'),
        list('channel'),
      ]);
      lists = { status, expenseStatus, product, service, channel };
      // who a Commercial unit can be credited to (V613): the staff, by name
      const org = (await serverRpc('org', {} as never).catch(() => null)) as OrgAnswer | null;
      people = (org?.people ?? [])
        .filter((x) => !x.account || x.account === 'team_member')
        .map((x) => ({ id: x.id, label: nameOf(x, locale) }))
        .sort((a, b) => a.label.localeCompare(b.label));
    } catch {
      lists = null;
    }
  }
  return (
    <Page page="finance" title={t('nav.finance')}>
      {!full ? (
        <>
          <PageHeader title={t('finance.new.title')} />
          <DataState
            kind="no-access"
            what={t('finance.new.title')}
            message={t('state.noAccess', { what: t('finance.new.title') })}
            goHome={t('errors.notFound.goMyDay')}
          />
        </>
      ) : (
        <NewInvoice today={riyadhDay()} lists={lists} people={people} />
      )}
    </Page>
  );
}
