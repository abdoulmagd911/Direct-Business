import { getLocale, getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { DbError } from '@/core/db/errors';
import { serverRpc } from '@/core/db/server-rpc';
import { CodesScreen } from '@/modules/codes/screens/CodesScreen';
import type { CodeDetail, CompanyCodeRow, CodeRow, PartnerOption } from '@/modules/codes/types';
import { tradeName, type PartnersAnswer } from '@/modules/partners/types';
import type { RecordFile } from '@/ui/record/FilesSection';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.codes');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * F-B3-04: one more try for a read the gateway held and dropped. serverRpc already tries twice, 250 ms
 * apart (readTwice, W43); a stall that outlasts both still answers on a third try a second later, so an
 * intermittent 555 no longer drops the detail into a failed state. Only a failure in transit is retried —
 * a refusal the database gave (an answer, never a stall) returns null at once, as before. The five reads
 * stay five reads, in one round; they are not collapsed (that would need a new database function) and not
 * staggered (they are independent, and serialising them would only wait longer on a stall).
 */
async function readAgain<T>(call: () => Promise<T>): Promise<T | null> {
  try {
    return await call();
  } catch (e) {
    if (!(e instanceof DbError) || e.kind !== 'Unavailable') return null;
    await new Promise((done) => setTimeout(done, 1000));
    try {
      return await call();
    } catch {
      return null;
    }
  }
}

/**
 * Discount Codes: the list, the per-company view and the partners an attribution can name come from the
 * database's own reads; one code's detail only when its id is asked for. Each read is caught on its own,
 * so a missing side says which read failed instead of breaking the page. The page itself gates on the
 * codes level (a person at none sees no access, never an empty screen).
 */
export default async function CodesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [q, me, t] = await Promise.all([searchParams, requireMe(), getTranslations()]);
  const level = me.levels.codes ?? 'none';
  const rawCode = typeof q.code === 'string' ? q.code : undefined;
  const codeId = rawCode && UUID.test(rawCode) ? rawCode : null;
  const [rows, companies, detail, clients, files] = await Promise.all([
    level === 'none' ? null : readAgain(() => serverRpc('codes_list', {}) as Promise<unknown>),
    level === 'none' ? null : readAgain(() => serverRpc('codes_by_company', {}) as Promise<unknown>),
    level === 'none' || !codeId ? null : readAgain(() => serverRpc('codes_detail', { p_code: codeId })),
    readAgain(() => serverRpc('partners', { p_filters: { side: 'client' } as never, p_limit: 500 })),
    // The selected code's own files (a failed read says so on the detail, never an empty section). The entity is
    // 'identifier': the id is a partner.identifier row, and the codes-level carve-out in 20261109000000 lets a
    // codes reader see it (F157 — 'campaign_code' is the short-trial code table, which never holds it).
    level === 'none' || !codeId ? null : readAgain(() => serverRpc('files', { p_entity: 'identifier', p_id: codeId })),
  ]);
  const lang = (await getLocale()) as 'en' | 'ar';
  const partners: PartnerOption[] = ((clients as PartnersAnswer | null)?.rows ?? []).map((p) => ({
    id: p.id,
    name: tradeName(p, lang),
  }));
  return (
    <Page page="codes" title={t('nav.codes')}>
      <CodesScreen
        rows={(rows as CodeRow[] | null) ?? []}
        detail={detail as CodeDetail | null}
        companyRows={(companies as CompanyCodeRow[] | null) ?? []}
        partners={partners}
        full={level === 'full'}
        selectedId={codeId}
        listFailed={level !== 'none' && rows === null}
        detailFailed={level !== 'none' && codeId !== null && detail === null}
        companiesFailed={level !== 'none' && companies === null}
        files={(files as RecordFile[] | null) ?? null}
        filesFailed={level !== 'none' && codeId !== null && files === null}
      />
    </Page>
  );
}
