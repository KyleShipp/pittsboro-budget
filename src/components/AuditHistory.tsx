import history from '../../public/data/audit-history.json';
import { formatCurrency } from '@/lib/format';

function sourceUrl(filename: string) {
  return `https://github.com/KyleShipp/pittsboro-budget/blob/${history.sourceRevision}/${encodeURIComponent(filename)}`;
}

export default function AuditHistory() {
  return (
    <section id="audit-history" aria-labelledby="audit-history-heading" className="space-y-6">
      <div>
        <h2 id="audit-history-heading" className="text-2xl font-semibold">Five years of audited results</h2>
        <p className="text-gray-700 mt-2">
          Fiscal years end June 30. Amounts below come from each year&apos;s basic financial
          statements, not adopted budgets or the combined governmental-funds column.
          These are audit evidence and transparent calculations, not official LOGOS FPI ratings.
          Source links are pinned to the uploaded reports; citations show printed pages and PDF pages.
        </p>
      </div>

      <div id="general-fund-history" className="bg-white border rounded-xl p-5 space-y-4">
        <h3 className="text-xl font-semibold">General Fund reserves</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <caption className="text-left text-gray-600 pb-3">
              Year-end total and unassigned balances; annual change = ending balance − beginning balance.
            </caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="py-2 pr-4">Year ended</th>
                <th scope="col" className="py-2 pr-4 text-right">Total balance</th>
                <th scope="col" className="py-2 pr-4 text-right">Annual change</th>
                <th scope="col" className="py-2 pr-4 text-right">Unassigned balance</th>
                <th scope="col" className="py-2 pr-4 text-right">Expenditures</th>
                <th scope="col" className="py-2">Audit pages</th>
              </tr>
            </thead>
            <tbody>
              {history.years.map(({ year, filename, generalFund: fund }) => (
                <tr key={year} className="border-b align-top">
                  <th scope="row" className="py-3 pr-4">June 30, {year}</th>
                  <td className="py-3 pr-4 text-right whitespace-nowrap">{formatCurrency(fund.endingBalance)}</td>
                  <td className="py-3 pr-4 text-right whitespace-nowrap">
                    {fund.endingBalance > fund.beginningBalance ? '+' : ''}
                    {formatCurrency(fund.endingBalance - fund.beginningBalance)}
                  </td>
                  <td className="py-3 pr-4 text-right whitespace-nowrap">{formatCurrency(fund.unassignedBalance)}</td>
                  <td className="py-3 pr-4 text-right whitespace-nowrap">{formatCurrency(fund.expenditures)}</td>
                  <td className="py-3">
                    <a href={sourceUrl(filename)} className="text-pittsboro-green underline">
                      FY{year}: {fund.balancePages}; {fund.changePages}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-gray-700">
          Total General Fund balance was positive in all five years. The balance declined by
          $599,666 in FY2024 and increased by $1,071,631 in FY2025. A decline alone does not
          establish an operating loss: the capital-related uses and financing must be reconciled
          before assessing the use-of-reserves indicator.
        </p>
        <p className="text-sm text-gray-600">
          Unassigned balance is shown as context, not as LGC Fund Balance Available (FBA).
          The reports&apos; narrative percentages do not consistently reconcile to General Fund
          expenditures in the basic statements, so they are not used as FBA ratios.
          FBA and its applicable historical threshold remain unverified. September 2026
          thresholds below are reference guidance, not retroactive ratings for these years.
        </p>
      </div>

      <div id="utility-history" className="bg-white border rounded-xl p-5 space-y-4">
        <h3 className="text-xl font-semibold">Water and sewer: audit-derived measures</h3>
        <p className="text-gray-700">
          Operating adjustment = operating income + depreciation − principal paid − interest paid.
          This combines accrual operating results with cash debt service; it is a transparent
          calculation, not a verified LOGOS result. Capital condition = (gross depreciable cost
          − accumulated depreciation) ÷ gross depreciable cost × 100, excluding land and construction
          in progress. It measures accounting age, not engineering condition.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <caption className="text-left text-gray-600 pb-3">
              Historical utility operations through FY2024; no ongoing Town utility ratios for FY2025.
            </caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="py-2 pr-4">Year ended</th>
                <th scope="col" className="py-2 pr-4 text-right">Operating adjustment</th>
                <th scope="col" className="py-2 pr-4 text-right">Capital condition</th>
                <th scope="col" className="py-2">Audit pages</th>
              </tr>
            </thead>
            <tbody>
              {history.years.map(({ year, filename, utility, utilityTransferPages }) => (
                <tr key={year} className="border-b align-top">
                  <th scope="row" className="py-3 pr-4">June 30, {year}</th>
                  <td className="py-3 pr-4 text-right">
                    {utility == null ? 'N/A — operations transferred' : formatCurrency(
                      utility.operatingIncome + utility.depreciation - utility.principalPaid - utility.interestPaid,
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {utility == null ? 'N/A — operations transferred' :
                      utility.grossDepreciableAssets <= 0 ? 'Not assessed — no valid denominator' :
                        `${((utility.grossDepreciableAssets - utility.accumulatedDepreciation) /
                          utility.grossDepreciableAssets * 100).toFixed(2)}%`}
                  </td>
                  <td className="py-3">
                    <a href={sourceUrl(filename)} className="text-pittsboro-green underline">
                      FY{year}: {utility == null ? utilityTransferPages :
                        `${utility.operatingPages}; ${utility.capitalPages}`}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-gray-700">
          Operations transferred to the City of Sanford on July 1, 2024. FY2025 still reports
          settlement activity, including $481,262 of cash matched by amounts due to other governments;
          these are not ongoing utility operations. FY2025 is therefore not rated as zero income,
          zero asset condition, or a healthy liquidity ratio.
        </p>
        <p className="text-sm text-gray-600">
          Quick ratio, unrestricted cash coverage, and operating-transfer dependence remain
          unassessed for FY2021–FY2024 pending verification of cash restrictions, applicable expense
          denominators, and operating versus capital transfers. Restricted net position is not
          interchangeable with restricted cash.
        </p>
        <details className="border-t pt-3">
          <summary className="cursor-pointer font-semibold">Calculation inputs and source caveats</summary>
          <ul className="space-y-4 mt-3 text-sm text-gray-700">
            {history.years.map(({ year, utility }) => utility == null ? null : (
              <li key={year}>
                <h4 className="font-semibold">FY{year}</h4>
                <p>
                  Operating income {formatCurrency(utility.operatingIncome)};
                  depreciation {formatCurrency(utility.depreciation)};
                  principal paid {formatCurrency(utility.principalPaid)};
                  interest paid {formatCurrency(utility.interestPaid)}.
                  Gross depreciable assets {formatCurrency(utility.grossDepreciableAssets)};
                  accumulated depreciation {formatCurrency(utility.accumulatedDepreciation)}.
                </p>
                <p className="mt-1">{utility.note}</p>
              </li>
            ))}
          </ul>
        </details>
      </div>

      <div id="compliance-history" className="bg-white border rounded-xl p-5 space-y-4">
        <h3 className="text-xl font-semibold">Reported audit findings</h3>
        <p className="text-gray-600">
          “None reported” describes the audit&apos;s findings, not proof of compliance with every
          LGC indicator. Submission dates, officer coverage/bonding, and debt-covenant compliance
          are not inferred from an unmodified opinion.
        </p>
        <ul className="space-y-4">
          {history.years.map(({ year, filename, findings }) => (
            <li key={year} className="border-t pt-4">
              <h4 className="font-semibold">FY{year}</h4>
              <p className="text-gray-700 mt-1">{findings.summary}</p>
              <a href={sourceUrl(filename)} className="text-sm text-pittsboro-green underline">
                FY{year} audit, pp. {findings.pages}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
