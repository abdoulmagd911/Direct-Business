import type { Bi, Cell, Column, ReportDoc } from '@/core/print/report/model';

/**
 * A made-up monthly report (rule 7: every name, figure and ID here is invented — V101's shapes) that exercises what
 * the Arabic spike must prove (plan P3-10): Arabic lines holding English names, IDs and Latin digits, a line opening
 * with an English name, money and percentages, a negative figure, a "not measured" tile, a KPI table long enough to
 * flow onto a second page (its header repeats), and page numbers.
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
  kpi('K-REV', b('Department revenue (SAR)', 'إيرادات الإدارة (ريال)'), 100000, 11500, 11500, { status: 'behind' }),
  kpi('K-NEW', b('New clients', 'عملاء جدد'), 3, 1, 1, { status: 'at_risk' }),
  kpi('K-TND', b('Tenders submitted', 'المنافسات المقدمة'), 2, 1, 2, { status: 'on_track' }),
  kpi('K-AWD', b('Awarded value (SAR)', 'قيمة الترسية (ريال)'), 500000, 0, 250000, { status: 'at_risk' }),
  kpi('K-CTR', b('Contracts improved', 'العقود المحسّنة'), 6, 2, 5, { status: 'on_track' }),
  kpi('K-SUP', b('New suppliers', 'موردون جدد'), 4, 1, 4, { status: 'done' }),
  kpi('K-INT', b('Integrations handed to Product', 'التكاملات المسلّمة لفريق المنتج'), 2, 0, 0, { status: 'behind' }),
  kpi('K-MOU', b('MoU signings', 'مذكرات التفاهم الموقّعة'), 1, 1, 1, { status: 'done' }),
  kpi('K-CSV', b('Cost savings (SAR, not revenue)', 'وفورات التكلفة (ريال، ليست إيرادات)'), 50000, 42000, 42000, {
    status: 'on_track',
  }),
  kpi('K-CSAT', b('Client satisfaction (%)', 'رضا العملاء (%)'), 90, null, null, { status: 'not_measured' }),
  kpi('K-EVT', b('Events and exhibitions attended', 'الفعاليات والمعارض'), 3, 1, 2, { status: 'on_track' }),
  kpi('K-TRN', b('Operations trainings delivered', 'التدريبات المقدمة للعمليات'), 2, 1, 1, { status: 'at_risk' }),
  kpi('K-PAY', b('Average days to pay', 'متوسط أيام السداد'), 30, 32, 34, { status: 'behind' }),
  kpi('K-OPS', b('Operational plan items', 'بنود الخطة التشغيلية'), 5, 1, 3, { status: 'carried_over' }),
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
          current: { kind: 'number', value: 606500, unit: 'sar' },
          previous: { kind: 'number', value: 512000, unit: 'sar' },
        },
        {
          key: 'new_clients',
          label: b('New clients', 'عملاء جدد'),
          current: { kind: 'number', value: 4, unit: 'count' },
          previous: { kind: 'number', value: 2, unit: 'count' },
        },
        {
          key: 'contracts',
          label: b('Contracts improved', 'العقود المحسّنة'),
          current: { kind: 'number', value: 3, unit: 'count' },
          previous: { kind: 'number', value: 1, unit: 'count' },
        },
        {
          key: 'suppliers',
          label: b('Hotel and airline suppliers', 'مزودو الفنادق والطيران'),
          current: { kind: 'number', value: 30, unit: 'count' },
          previous: { kind: 'number', value: 19, unit: 'count' },
        },
        {
          key: 'airlines',
          label: b('Airlines', 'شركات الطيران'),
          current: { kind: 'number', value: 82, unit: 'count' },
          previous: { kind: 'number', value: 79, unit: 'count' },
        },
        {
          key: 'payment_methods',
          label: b('Payment methods', 'طرق الدفع'),
          current: { kind: 'number', value: 6, unit: 'count' },
          previous: { kind: 'number', value: 4, unit: 'count' },
        },
        {
          key: 'car_countries',
          label: b('Countries with car and driver', 'الدول المغطاة بخدمة سيارة مع سائق'),
          current: { kind: 'number', value: 36, unit: 'count' },
          previous: { kind: 'number', value: 12, unit: 'count' },
        },
        {
          key: 'on_time',
          label: b('Payments on time', 'السداد في الموعد'),
          current: { kind: 'number', value: 87.5, unit: 'percent' },
          previous: { kind: 'number', value: 91, unit: 'percent' },
        },
        {
          key: 'complaints',
          label: b('Complaints', 'الشكاوى'),
          current: { kind: 'number', value: 7, unit: 'count' },
          previous: { kind: 'number', value: 12, unit: 'count' },
          better: 'down',
        },
        {
          key: 'tenders',
          label: b('Tenders submitted', 'المنافسات المقدمة'),
          current: { kind: 'number', value: 2, unit: 'count' },
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
                'Signed a cooperation agreement with Sample Travel LLC giving a 5% discount on package prices.',
                'توقيع اتفاقية تعاون مع Sample Travel LLC بخصم 5% على أسعار الباقات.',
              ),
            },
            {
              text: b(
                'Renewed the {{partner:00000000-0000-4000-8000-000000000001}} contract (DK-P-0001) and raised its credit line to 50,000 SAR.',
                'تجديد عقد {{partner:00000000-0000-4000-8000-000000000001}} (DK-P-0001) ورفع الحد الائتماني إلى 50,000 ريال.',
              ),
            },
            {
              text: b(
                'Madeup Airlines agreed to a fixed net fare for groups of 10 or more, reviewed on 14/08/2026.',
                'Madeup Airlines وافقت على سعر صافٍ ثابت للمجموعات من 10 أشخاص فأكثر (مراجعة في 14/08/2026).',
              ),
            },
          ],
        },
        {
          title: b('Revenue and collections', 'الإيرادات والتحصيل'),
          lines: [
            {
              text: b(
                'Invoice INV-T-0001 for Test Co A was paid in full; bookings rose from 1,200 to 3,450 in Q1–Q2, up 187.5%.',
                'سداد الفاتورة INV-T-0001 لعميل Test Co A بالكامل، وارتفعت الحجوزات من 1,200 إلى 3,450 خلال Q1–Q2 بنسبة 187.5%.',
              ),
              amount: { value: 11500, unit: 'sar', label: null },
            },
            {
              text: b(
                'Received a commission from Fake Institute for 2025, recorded under DPIN-T-0001.',
                'استلام عمولة من Fake Institute عن عام 2025، مسجلة برقم DPIN-T-0001.',
              ),
              amount: { value: 26231, unit: 'sar', label: null },
            },
          ],
        },
        {
          title: b('Problem solving', 'حل المشكلات'),
          lines: [
            {
              text: b(
                'Resolved late ticket delivery for Madeup Airlines bookings: exposure 50,000, actual loss -8,000 avoided.',
                'حل مشكلة تأخر إصدار التذاكر لحجوزات Madeup Airlines: التعرض 50,000 والخسارة الفعلية -8,000.',
              ),
              amount: { value: 42000, unit: 'sar', label: b('avoided · not revenue', 'تم تجنبها · ليست إيرادات') },
            },
            {
              text: b(
                'Arabic digits typed by a person print as Latin digits: ٣ contracts, ١٢٫٥٪ saving.',
                'الأرقام العربية المكتوبة تُطبع بأرقام لاتينية: ٣ عقود ووفر ١٢٫٥٪.',
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
                'No reply yet from Fake University on the renewal, open since 3 August 2026 (57 days).',
                'لم يصل رد من Fake University بشأن التجديد، مفتوح منذ 3 أغسطس 2026 (57 يوماً).',
              ),
            },
            {
              text: b(
                'Payment through the Sample Pay gateway is still pending the provider’s review.',
                'الدفع عبر بوابة Sample Pay ما زال بانتظار مراجعة المزود.',
              ),
            },
            { text: arOnly('تأخر رد السفارة على طلب التأشيرة لمجموعة الطلاب (المرجع T-0042).') },
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
            { text: b('Receive the commission from Sample Travel LLC.', 'استلام العمولة من Sample Travel LLC.') },
            {
              text: b(
                'Meet the five largest airlines to agree 2027 targets and discount codes.',
                'الاجتماع مع أكبر 5 شركات طيران لتحديد مستهدفات 2027 وأكواد الخصم.',
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
