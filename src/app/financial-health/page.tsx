import type { Metadata } from 'next';
import Link from 'next/link';
import { getMeta, getSummary } from '@/lib/data';
import { formatCurrency } from '@/lib/format';
import { indicatorGroups, indicatorSource } from '@/lib/financial-indicators';
import AuditHistory from '@/components/AuditHistory';

export const metadata: Metadata = {
  title: 'Financial Health | Pittsboro, NC Budget',
  description: 'Pittsboro’s FY2021–FY2025 audited financial history, LGC financial performance indicators, and reference thresholds.',
};

const meta = getMeta();
const summary = getSummary();

export default function FinancialHealthPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Financial Health</h1>
        <p className="text-lg text-gray-600 mt-2">
          Understanding the Local Government Commission&apos;s financial performance indicators.
        </p>
      </header>

      <section className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3" aria-labelledby="coverage-heading">
        <h2 id="coverage-heading" className="text-xl font-semibold">Audited history: FY2021–FY2025</h2>
        <p className="text-gray-700">
          Five uploaded annual audits now provide historical financial results and reported
          findings. The LGC article supplies the indicator definitions and reference thresholds.
          This is not the Town&apos;s official LOGOS Financial Performance Indicator (FPI) report.
          Indicators without sufficient evidence remain <strong>not assessed</strong>;
          missing information is neither zero nor a pass.
        </p>
        <p className="text-gray-700">
          An indicator of concern (FPIC) triggers review and a response, but does not by itself
          establish financial distress, placement on the Unit Assistance List, or State takeover.
          Thresholds are not financial targets or mandated minimum reserves. Trends can warrant
          attention even when a threshold is met.
        </p>
        <p className="text-sm text-gray-600">
          Reference guidance: September 2026. Confirm current definitions and the fail conditions
          in the Town&apos;s LOGOS report before making an official assessment.
        </p>
      </section>

      <nav aria-label="Financial health sections" className="flex flex-wrap gap-4 text-sm">
        <a href="#audit-history" className="text-pittsboro-green underline">Audited history</a>
        {indicatorGroups.map((group) => (
          <a key={group.id} href={`#${group.id}`} className="text-pittsboro-green underline">
            {group.title}
          </a>
        ))}
        <a href="#budget-context" className="text-pittsboro-green underline">Budget context</a>
        <a href="#sources" className="text-pittsboro-green underline">Sources and next data</a>
      </nav>

      <AuditHistory />

      {indicatorGroups.map((group) => (
        <section key={group.id} id={group.id} aria-labelledby={`${group.id}-heading`} className="scroll-mt-4">
          <h2 id={`${group.id}-heading`} className="text-2xl font-semibold">{group.title}</h2>
          <p className="text-gray-600 mt-2 mb-4">{group.note}</p>
          <div className="grid md:grid-cols-2 gap-4">
            {group.indicators.map((indicator) => (
              <article key={indicator.name} className="bg-white border rounded-xl p-5">
                <h3 className="text-lg font-semibold">{indicator.name}</h3>
                <p className="inline-block rounded bg-gray-100 text-gray-700 text-sm px-2 py-1 mt-2">
                  {indicator.historySection ? (
                    <a href={`#${indicator.historySection}`} className="underline">
                      Historical evidence available — see results
                    </a>
                  ) : 'Not assessed — data needed'}
                </p>
                <p className="text-gray-700 mt-3">{indicator.meaning}</p>
                <dl className="text-sm mt-4 space-y-3">
                  <div>
                    <dt className="font-semibold">Reference condition for avoiding concern</dt>
                    <dd className="text-gray-700 mt-1">{indicator.benchmark}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">
                      {indicator.historySection ? 'Assessment basis and limitations' : 'Data needed'}
                    </dt>
                    <dd className="text-gray-600 mt-1">{indicator.needed}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section id="budget-context" aria-labelledby="context-heading" className="bg-white border rounded-xl p-5 space-y-4">
        <h2 id="context-heading" className="text-2xl font-semibold">Budget context — not audited FPI results</h2>
        <p className="text-gray-700">
          The historical section above uses audited financial statements. This section retains
          the separate budget-document extracts used elsewhere on this site. These sources
          can differ in presentation and scope; budget figures are not substituted for audited
          indicator inputs. In particular, the balance other than unassigned is not all
          “assigned”: the FY2025 audited balance sheet includes restricted and nonspendable amounts.
        </p>
        <p className="text-gray-700">
          The dataset also records a local fund balance policy of{' '}
          {(meta.fundBalancePolicy * 100).toFixed(0)}%. Its basis should be checked against the
          adopted policy; it is separate from the LGC&apos;s size-based FPIC thresholds.
          The older 8% reference in the source metadata is not used here as a current LGC minimum.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <caption className="text-left text-gray-600 pb-3">
              General Fund figures from the existing budget documents; actuals and adopted budgets are not an audited trend series.
            </caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="py-2 pr-4">Fiscal year / basis</th>
                <th scope="col" className="py-2 pr-4 text-right">Expenditures</th>
                <th scope="col" className="py-2 text-right">Fund balance appropriated</th>
              </tr>
            </thead>
            <tbody>
              {meta.fiscalYears.map((year) => {
                const figures = summary.fiscalYears[year.key];
                return (
                  <tr key={year.key} className="border-b">
                    <th scope="row" className="py-3 pr-4 font-normal">
                      {year.label} <span className="capitalize text-gray-500">({year.type})</span>
                    </th>
                    <td className="py-3 pr-4 text-right whitespace-nowrap">
                      {figures?.totalExpenditures == null ? 'Not available' : formatCurrency(figures.totalExpenditures)}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      {figures?.fundBalanceAppropriated == null ? 'Not available' : formatCurrency(figures.fundBalanceAppropriated)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-600">
          Appropriating reserves does not prove an operating shortfall. Likewise, a balanced adopted
          budget does not prove that actual operations avoided one. No pass/fail ratings or audited
          trend charts are inferred from these figures.
        </p>
      </section>

      <section id="sources" aria-labelledby="sources-heading" className="space-y-3 max-w-3xl">
        <h2 id="sources-heading" className="text-2xl font-semibold">Sources and next data</h2>
        <p className="text-gray-700">
          Indicator explanations summarize{' '}
          <a href={indicatorSource.url} className="text-pittsboro-green underline">{indicatorSource.title}</a>
          {' '}by {indicatorSource.author} ({indicatorSource.date}). See the{' '}
          <a href={indicatorSource.pdfUrl} className="text-pittsboro-green underline">uploaded PDF</a>
          , pages 4–8 for the indicator list, 10–12 for General Fund thresholds, and 13–18 for utility
          measures and compliance context. The article cites the September 2026 LGC Financial
          Performance Indicators Guide.
        </p>
        <p className="text-gray-700">
          The historical results link to all five uploaded audits with source-page citations.
          To complete the remaining assessments, obtain LOGOS FPI reports for matching fiscal
          years, the applicable historical thresholds, and any required supporting compliance
          records. Missing values are not replaced with zero, and audited results are not
          combined with adopted budgets to create a trend.
        </p>
        <p className="text-gray-700">
          Budget context uses the existing FY 2026-2027 and FY 2025-2026 adopted budget extracts,
          including FY 2024-2025 actuals. See{' '}
          <Link href="/about" className="text-pittsboro-green underline">About &amp; Methodology</Link>
          {' '}for budget sources and limitations.
        </p>
      </section>
    </div>
  );
}
