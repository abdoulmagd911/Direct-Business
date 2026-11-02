import type { Bi, Cell, Column, ReportDoc } from '@/core/print/report/model';

/**
 * A made-up monthly report (rule 7: every name, figure and ID here is invented — V101's shapes) that exercises what
 * the Arabic spike must prove (plan P3-10): Arabic lines holding English names, IDs and Latin digits, a line opening
 * with an English name, money and percentages, a negative figure, a "not measured" tile, a KPI table long enough to
 * flow onto a second page (its header repeats), and page numbers. Nothing here comes from a real report: the
 * department's reports are read for their layout only (V34) — an earlier version that echoed one was caught (QA-79).
 */

const b = (en: string, ar: string): Bi => ({ en, ar });
/** A line typed only in Arabic: the English copy prints it in Arabic (V403). */
const arOnly = (ar: string): Bi => ({ ar, en: null });

const columns: Column[] = [
  { key: 'code', title: b('Code', 'الرمز'), kind: 'id', width: 0.1 },
  { key: 'kpi', title: b('KPI', 'المؤشر'), kind: 'text', width: 0.38 },
  { key: 'target', title: b('Q3 target', 'مستهدف الربع الثالث'), kind: 'number', width: 0.14 },
  { key: 'month', title: b('September', 'سبتمبر'), kind: 'number', width: 0.12 },
  { key: 'qtd', title: b('Quarter to date', 'منذ بداية الربع'), kind: 'number', width: 0.12 },
  { key: 'status', title: b('Status', 'الحالة'), kind: 'status', width: 0.14 },
];

const kpi = (
  code: string,
  name: Bi,
  target: number | null,
  month: number | null,
  qtd: number | null,
  status: Cell,
): Cell[] => [{ id: code }, name, target, month, qtd, status];

const kpiRows: Cell[][] = [
  kpi('K-REV', b('Department revenue (SAR)', 'إيرادات الإدارة (ريال)'), 90000, 7250, 7250, { status: 'behind' }),
  kpi('K-NEW', b('New clients', 'عملاء جدد'), 4, 1, 2, { status: 'at_risk' }),
  kpi('K-TND', b('Tenders submitted', 'المنافسات المقدمة'), 3, 1, 1, { status: 'on_track' }),
  kpi('K-AWD', b('Awarded value (SAR)', 'قيمة الترسية (ريال)'), 300000, 0, 120000, { status: 'at_risk' }),
  kpi('K-CTR', b('Contracts improved', 'العقود المحسّنة'), 5, 1, 3, { status: 'on_track' }),
  kpi('K-SUP', b('New suppliers', 'موردون جدد'), 6, 2, 6, { status: 'done' }),
  kpi('K-INT', b('Integrations handed to Product', 'التكاملات المسلّمة لفريق المنتج'), 2, 0, 0, { status: 'behind' }),
  kpi('K-MOU', b('MoU signings', 'مذكرات التفاهم الموقّعة'), 2, 1, 2, { status: 'done' }),
  kpi('K-CSV', b('Cost savings (SAR, not revenue)', 'وفورات التكلفة (ريال، ليست إيرادات)'), 30000, 18500, 18500, {
    status: 'on_track',
  }),
  kpi('K-CSAT', b('Client satisfaction (%)', 'رضا العملاء (%)'), 85, null, null, { status: 'not_measured' }),
  kpi('K-EVT', b('Events and exhibitions attended', 'الفعاليات والمعارض'), 4, 1, 2, { status: 'on_track' }),
  kpi('K-TRN', b('Operations trainings delivered', 'التدريبات المقدمة للعمليات'), 3, 1, 2, { status: 'at_risk' }),
  kpi('K-PAY', b('Average days to pay', 'متوسط أيام السداد'), 25, 27, 29, { status: 'behind' }),
  kpi('K-OPS', b('Operational plan items', 'بنود الخطة التشغيلية'), 6, 2, 4, { status: 'carried_over' }),
];

export const sampleReport: ReportDoc = {
  kind: 'monthly',
  status: 'issued',
  number: 'COM-M-2026-09',
  department: b('Commercial', 'الإدارة التجارية'),
  period: { start: '2026-09-01', end: '2026-09-30' },
  issuedOn: '2026-10-05',
  sections: [
    {
      kind: 'tiles',
      key: 'tiles',
      title: b('This month vs the same month last year', 'مقارنة الشهر بنفس الشهر من العام الماضي'),
      currentLabel: b('September 2026', 'سبتمبر 2026'),
      previousLabel: b('September 2025', 'سبتمبر 2025'),
      tiles: [
        {
          key: 'revenue',
          label: b('Revenue', 'الإيرادات'),
          current: { kind: 'number', value: 48300, unit: 'sar' },
          previous: { kind: 'number', value: 40250, unit: 'sar' },
        },
        {
          key: 'new_clients',
          label: b('New clients', 'عملاء جدد'),
          current: { kind: 'number', value: 3, unit: 'count' },
          previous: { kind: 'number', value: 1, unit: 'count' },
        },
        {
          key: 'visits',
          label: b('Partner visits', 'زيارات الشركاء'),
          current: { kind: 'number', value: 9, unit: 'count' },
          previous: { kind: 'number', value: 6, unit: 'count' },
        },
        {
          key: 'proposals',
          label: b('Proposals sent', 'العروض المرسلة'),
          current: { kind: 'number', value: 14, unit: 'count' },
          previous: { kind: 'number', value: 11, unit: 'count' },
        },
        {
          key: 'contacts',
          label: b('Partner contacts added', 'جهات اتصال الشركاء المضافة'),
          current: { kind: 'number', value: 137, unit: 'count' },
          previous: { kind: 'number', value: 120, unit: 'count' },
        },
        {
          key: 'cities',
          label: b('Cities covered', 'المدن المغطاة'),
          current: { kind: 'number', value: 7, unit: 'count' },
          previous: { kind: 'number', value: 5, unit: 'count' },
        },
        {
          key: 'workshops',
          label: b('Workshops held', 'ورش العمل المنفذة'),
          current: { kind: 'number', value: 5, unit: 'count' },
          previous: { kind: 'number', value: 4, unit: 'count' },
        },
        {
          key: 'replies_on_time',
          label: b('Replies on time', 'الردود في الموعد'),
          current: { kind: 'number', value: 92.5, unit: 'percent' },
          previous: { kind: 'number', value: 90, unit: 'percent' },
        },
        {
          key: 'complaints',
          label: b('Complaints', 'الشكاوى'),
          current: { kind: 'number', value: 4, unit: 'count' },
          previous: { kind: 'number', value: 6, unit: 'count' },
          better: 'down',
        },
        {
          key: 'tenders',
          label: b('Tenders submitted', 'المنافسات المقدمة'),
          current: { kind: 'number', value: 1, unit: 'count' },
          previous: { kind: 'not_measured' },
        },
      ],
    },
    {
      kind: 'table',
      key: 'kpi_month_additions',
      title: b("Each KPI's addition this month", 'إضافة كل مؤشر هذا الشهر'),
      columns,
      rows: kpiRows,
    },
    {
      kind: 'lines',
      key: 'achievements_by_category',
      title: b('Key achievements', 'الإنجازات الرئيسية'),
      groups: [
        {
          title: b('Contracts and agreements', 'العقود والاتفاقيات'),
          lines: [
            {
              text: b(
                'Signed a three-month pilot with Sample Travel LLC giving a 3% discount on made-up package prices.',
                'توقيع اتفاقية تجريبية لثلاثة أشهر مع Sample Travel LLC بخصم 3% على أسعار باقات افتراضية.',
              ),
            },
            {
              text: b(
                'Renewed the {{partner:00000000-0000-4000-8000-000000000001}} test contract (DK-P-0001) and set its credit line to 20,000 SAR.',
                'تجديد العقد التجريبي مع {{partner:00000000-0000-4000-8000-000000000001}} (DK-P-0001) وتحديد الحد الائتماني بـ 20,000 ريال.',
              ),
            },
            {
              text: b(
                'Madeup Airlines agreed to a fixed test fare for groups of 8 or more, reviewed on 12/07/2026.',
                'Madeup Airlines وافقت على سعر تجريبي ثابت للمجموعات من 8 أشخاص فأكثر (مراجعة في 12/07/2026).',
              ),
            },
          ],
        },
        {
          title: b('Revenue and collections', 'الإيرادات والتحصيل'),
          lines: [
            {
              text: b(
                'Invoice INV-T-0001 for Test Co A was paid in full; requests rose from 240 to 310 in Q1–Q2, up 29.2%.',
                'سداد الفاتورة INV-T-0001 لعميل Test Co A بالكامل، وارتفعت الطلبات من 240 إلى 310 خلال Q1–Q2 بنسبة 29.2%.',
              ),
              amount: { value: 7250, unit: 'sar', label: null },
            },
            {
              text: b(
                'Recorded a made-up referral fee from Sample Holding under DPIN-T-0001.',
                'تسجيل رسوم إحالة افتراضية من Sample Holding برقم DPIN-T-0001.',
              ),
              amount: { value: 3140, unit: 'sar', label: null },
            },
          ],
        },
        {
          title: b('Problem solving', 'حل المشكلات'),
          lines: [
            {
              text: b(
                'Fixed duplicate confirmations on Madeup Airlines test bookings: exposure 20,000, actual loss -1,500 avoided.',
                'معالجة التأكيدات المكررة في حجوزات Madeup Airlines التجريبية: التعرض 20,000 والخسارة الفعلية -1,500.',
              ),
              amount: { value: 18500, unit: 'sar', label: b('avoided · not revenue', 'تم تجنبها · ليست إيرادات') },
            },
            {
              text: b(
                'Arabic digits typed by a person print as Latin digits: ٤ contracts, ٧٫٥٪ saving.',
                'الأرقام العربية المكتوبة تُطبع بأرقام لاتينية: ٤ عقود ووفر ٧٫٥٪.',
              ),
            },
          ],
        },
      ],
    },
    {
      kind: 'lines',
      key: 'challenges',
      title: b('Challenges', 'التحديات'),
      groups: [
        {
          title: null,
          lines: [
            {
              text: b(
                'No reply yet from Test Co D on the pilot, open since 10 August 2026 (50 days).',
                'لم يصل رد من Test Co D بشأن التجربة، مفتوح منذ 10 أغسطس 2026 (50 يوماً).',
              ),
            },
            {
              text: b(
                'The shared calendar sync with Sample Pay is still waiting for the provider’s review.',
                'مزامنة التقويم المشترك مع Sample Pay ما زالت بانتظار مراجعة المزود.',
              ),
            },
            { text: arOnly('لم يؤكد العميل التجريبي موعد الاجتماع بعد (المرجع T-0042).') },
          ],
        },
      ],
    },
    {
      kind: 'lines',
      key: 'period_targets',
      title: b('Next month’s targets', 'مستهدفات الشهر القادم'),
      groups: [
        {
          title: null,
          lines: [
            {
              text: b(
                'Follow up the pilot results with Sample Travel LLC.',
                'متابعة نتائج التجربة مع Sample Travel LLC.',
              ),
            },
            {
              text: b(
                'Hold two partner visits and send the made-up price list for the next quarter.',
                'تنفيذ زيارتين للشركاء وإرسال قائمة الأسعار الافتراضية للربع القادم.',
              ),
            },
          ],
        },
      ],
    },
  ],
};

/** The current names of the entities the sample names by token (V58). */
export const sampleNames: Record<string, string> = {
  '00000000-0000-4000-8000-000000000001': 'Test Co A',
};
