import { getMeta } from '@/lib/data';

const meta = getMeta();

export default function AboutPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">About This Project</h1>

      <div className="prose prose-gray">
        <h2 className="text-xl font-semibold mt-6 mb-3">
          What is Pittsboro, NC Budget?
        </h2>
        <p className="text-gray-700 mb-4">
          Pittsboro, NC Budget is an independent civic data tool that
          turns published Town of Pittsboro budget documents into searchable
          tables, interactive charts, department drilldowns, year-over-year
          comparisons, and a property tax receipt view.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-3">What you can do</h2>
        <ul className="list-disc pl-6 text-gray-700 space-y-1 mb-4">
          <li>Compare budgeted spending across fiscal years</li>
          <li>Explore spending by department and line item</li>
          <li>See which departments drive changes over time</li>
          <li>
            Estimate how your property tax bill is distributed across services
          </li>
          <li>Browse the 5-year Capital Improvement Plan</li>
          <li>Search the General Fund Fee Schedule</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6 mb-3">Data Sources</h2>
        <div className="bg-white rounded-xl border p-4 mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">Document</th>
                <th className="py-2">Date</th>
                <th className="py-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {meta.sources.map((s) => (
                <tr key={s.title} className="border-b">
                  <td className="py-2">{s.title}</td>
                  <td className="py-2 text-gray-500">{s.date}</td>
                  <td className="py-2 text-gray-500 capitalize">{s.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-semibold mt-6 mb-3">Methodology</h2>
        <p className="text-gray-700 mb-2">
          Budget data is extracted from published PDF budget documents and
          organized into a consistent multi-year dataset. Revenue and
          expenditure line items are mapped to categories and departments
          following the Town&apos;s chart of accounts.
        </p>
        <p className="text-gray-700 mb-2">
          The property tax receipt estimates how a property tax bill maps to
          General Fund services. It uses the entered property value, the
          applicable town tax rate ($0.44/$100), and the relative share of
          General Fund spending by department. Enterprise-funded services are
          excluded.
        </p>
        <p className="text-gray-700 mb-4">
          FY 2024-2025 figures represent actual spending. FY 2025-2026 and
          FY 2026-2027 figures are from the adopted budgets. The FY 2026-2027
          budget was adopted by ordinance on June 8, 2026.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-3">Limitations</h2>
        <ul className="list-disc pl-6 text-gray-700 space-y-1 mb-4">
          <li>
            This is not an official Town of Pittsboro publication and should not
            replace adopted budget documents or annual financial reports
          </li>
          <li>
            The explorer is only as accurate as the source documents
          </li>
          <li>
            Budget categories may change over time, so some comparisons require
            judgment
          </li>
          <li>
            Receipt estimates are explanatory allocations, not official tax bills
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-6 mb-3">Official Resources</h2>
        <p className="text-gray-700">
          For official budget documents and financial reports, visit{' '}
          <a
            href="https://www.pittsboronc.gov"
            className="text-pittsboro-green underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            pittsboronc.gov
          </a>
          .
        </p>
      </div>
    </div>
  );
}
