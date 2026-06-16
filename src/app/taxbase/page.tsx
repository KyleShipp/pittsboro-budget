import { getTaxBase } from '@/lib/data';
import { formatCurrency, formatPercentPlain } from '@/lib/format';

const taxBase = getTaxBase();

// Colors for each property-type group (matches the app's green/gold palette).
const GROUP_COLORS: Record<string, string> = {
  Residential: '#2d5a27',
  Commercial: '#4e9c3f',
  Industrial: '#81c784',
  'Exempt / Partial Exempt': '#c4a43c',
  Other: '#9e9e9e',
};

export default function TaxBasePage() {
  const { groups, total, townRate, countyRate, fiscalYear, source, generated } =
    taxBase;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Property Tax Base Mix</h1>
        <p className="text-lg text-gray-600 mt-1">
          Town of Pittsboro &middot; {fiscalYear} &middot;{' '}
          <span className="font-semibold">
            {formatCurrency(total.assessedValue, true)}
          </span>{' '}
          assessed value across {total.parcels.toLocaleString()} parcels
        </p>
      </div>

      {/* Composition bar */}
      <div className="bg-white rounded-xl border p-5 mb-8">
        <p className="text-sm font-medium text-gray-700 mb-3">
          Share of taxable assessed value by property type
        </p>
        <div className="flex w-full h-6 rounded-lg overflow-hidden">
          {groups
            .filter((g) => g.assessedValue > 0)
            .map((g) => (
              <div
                key={g.group}
                style={{
                  width: `${g.pctOfBase}%`,
                  backgroundColor: GROUP_COLORS[g.group] ?? '#9e9e9e',
                }}
                title={`${g.group}: ${formatPercentPlain(g.pctOfBase)}`}
              />
            ))}
        </div>
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
          {groups
            .filter((g) => g.assessedValue > 0)
            .map((g) => (
              <span key={g.group} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: GROUP_COLORS[g.group] ?? '#9e9e9e' }}
                />
                {g.group} ({formatPercentPlain(g.pctOfBase)})
              </span>
            ))}
        </div>
      </div>

      {/* Table 1: Mix by type */}
      <h2 className="text-xl font-semibold text-gray-900 mb-3">
        Tax Base by Property Type
      </h2>
      <div className="bg-white rounded-xl border overflow-hidden mb-10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="py-3 px-4">Property Type</th>
              <th className="py-3 px-4 text-right">Parcels</th>
              <th className="py-3 px-4 text-right">Assessed Value</th>
              <th className="py-3 px-4 text-right">% of Tax Base</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.group} className="border-b last:border-0">
                <td className="py-3 px-4 font-medium text-gray-800">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{
                        backgroundColor: GROUP_COLORS[g.group] ?? '#9e9e9e',
                      }}
                    />
                    {g.group}
                  </span>
                </td>
                <td className="py-3 px-4 text-right tabular-nums">
                  {g.parcels.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right tabular-nums">
                  {formatCurrency(g.assessedValue)}
                </td>
                <td className="py-3 px-4 text-right tabular-nums">
                  {formatPercentPlain(g.pctOfBase)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 bg-gray-50 font-semibold">
              <td className="py-3 px-4">Total</td>
              <td className="py-3 px-4 text-right tabular-nums">
                {total.parcels.toLocaleString()}
              </td>
              <td className="py-3 px-4 text-right tabular-nums">
                {formatCurrency(total.assessedValue)}
              </td>
              <td className="py-3 px-4 text-right tabular-nums">100.0%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Table 2: Mix by type split Town vs County */}
      <h2 className="text-xl font-semibold text-gray-900 mb-1">
        Estimated Annual Tax by Type — Town vs. County
      </h2>
      <p className="text-sm text-gray-500 mb-3">
        Parcels inside the Town pay both rates: Town of Pittsboro $
        {townRate.toFixed(2)} and Chatham County ${countyRate.toFixed(2)} per
        $100 of assessed value.
      </p>
      <div className="bg-white rounded-xl border overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="py-3 px-4">Property Type</th>
              <th className="py-3 px-4 text-right">
                Town (${townRate.toFixed(2)})
              </th>
              <th className="py-3 px-4 text-right">
                County (${countyRate.toFixed(2)})
              </th>
              <th className="py-3 px-4 text-right">Combined</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.group} className="border-b last:border-0">
                <td className="py-3 px-4 font-medium text-gray-800">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{
                        backgroundColor: GROUP_COLORS[g.group] ?? '#9e9e9e',
                      }}
                    />
                    {g.group}
                  </span>
                </td>
                <td className="py-3 px-4 text-right tabular-nums">
                  {formatCurrency(g.townTax)}
                </td>
                <td className="py-3 px-4 text-right tabular-nums">
                  {formatCurrency(g.countyTax)}
                </td>
                <td className="py-3 px-4 text-right tabular-nums">
                  {formatCurrency(g.totalTax)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 bg-gray-50 font-semibold">
              <td className="py-3 px-4">Total</td>
              <td className="py-3 px-4 text-right tabular-nums">
                {formatCurrency(total.townTax)}
              </td>
              <td className="py-3 px-4 text-right tabular-nums">
                {formatCurrency(total.countyTax)}
              </td>
              <td className="py-3 px-4 text-right tabular-nums">
                {formatCurrency(total.totalTax)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Notes */}
      <div className="text-sm text-gray-500 space-y-1">
        <p>
          <strong>Source:</strong> {source}. Generated {generated}.
        </p>
        <p>
          Property type is based on the county use code (R/C/I). Exempt and
          partial-exempt parcels are reported separately; their estimated tax is
          illustrative, since fully exempt parcels pay no tax. Figures are gross
          (collection rate not applied) and are estimates, not official levies.
        </p>
      </div>
    </div>
  );
}
