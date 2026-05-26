'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { getCIP } from '@/lib/data';
import { formatCurrency } from '@/lib/format';

const cip = getCIP();
const fyColumns = ['FY27', 'FY28', 'FY29', 'FY30', 'FY31'] as const;

const departments = Array.from(
  new Set([
    ...cip.capitalProjects.map((p) => p.department),
    ...cip.vehicles.map((v) => v.department),
  ])
).sort();

export default function CIPPage() {
  const [filterDept, setFilterDept] = useState('all');
  const [tab, setTab] = useState<'projects' | 'vehicles'>('projects');

  const items =
    tab === 'projects' ? cip.capitalProjects : cip.vehicles;
  const totals =
    tab === 'projects' ? cip.capitalProjectTotals : cip.vehicleTotals;

  const filtered =
    filterDept === 'all'
      ? items.filter((i) => i.total > 0)
      : items.filter((i) => i.department === filterDept && i.total > 0);

  // Bar chart data by fiscal year
  const yearTotals = fyColumns.map((fy) => ({
    year: fy,
    amount: filtered.reduce((sum, p) => sum + p[fy], 0),
  }));

  // Summary by department
  const deptTotals = departments
    .map((dept) => ({
      department: dept,
      total: filtered
        .filter((p) => p.department === dept)
        .reduce((sum, p) => sum + p.total, 0),
    }))
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Capital Improvement Plan</h1>
      <p className="text-gray-600 mb-2">
        FY 2027 through FY 2031 &middot; Five-year planning tool for major
        capital projects and vehicle replacements.
      </p>
      <p className="text-sm text-gray-400 mb-8">
        The CIP is not a funding document. Funding of individual projects will
        be accomplished by project ordinances presented to the Board.
      </p>

      {/* Tabs & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === 'projects' ? 'bg-white shadow-sm' : ''
            }`}
            onClick={() => setTab('projects')}
          >
            Capital Projects ({formatCurrency(cip.capitalProjectTotals.total, true)})
          </button>
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === 'vehicles' ? 'bg-white shadow-sm' : ''
            }`}
            onClick={() => setTab('vehicles')}
          >
            Vehicles ({formatCurrency(cip.vehicleTotals.total, true)})
          </button>
        </div>

        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Year chart */}
      <div className="bg-white rounded-xl shadow-sm border p-5 mb-8">
        <h2 className="text-lg font-semibold mb-4">
          Spending by Fiscal Year
        </h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={yearTotals}>
            <XAxis dataKey="year" fontSize={12} />
            <YAxis
              tickFormatter={(v) => formatCurrency(v, true)}
              fontSize={12}
            />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Bar dataKey="amount" fill="#2d5a27" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Project table */}
      <div className="bg-white rounded-xl shadow-sm border p-5 mb-8">
        <h2 className="text-lg font-semibold mb-4">
          {tab === 'projects' ? 'Capital Projects' : 'Vehicle & Equipment Plan'}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4">Project</th>
                <th className="py-2 px-2">Dept</th>
                <th className="py-2 px-2">Funding</th>
                {fyColumns.map((fy) => (
                  <th key={fy} className="py-2 px-2 text-right">
                    {fy}
                  </th>
                ))}
                <th className="py-2 px-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium">{p.name}</td>
                  <td className="py-2 px-2 text-gray-500 text-xs">
                    {p.department}
                  </td>
                  <td className="py-2 px-2 text-gray-500 text-xs">
                    {p.fundingSource}
                  </td>
                  {fyColumns.map((fy) => (
                    <td key={fy} className="py-2 px-2 text-right">
                      {p[fy] > 0 ? formatCurrency(p[fy], true) : '—'}
                    </td>
                  ))}
                  <td className="py-2 px-2 text-right font-semibold">
                    {formatCurrency(p.total, true)}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td className="py-2 pr-4" colSpan={3}>
                  Total
                </td>
                {fyColumns.map((fy) => (
                  <td key={fy} className="py-2 px-2 text-right">
                    {formatCurrency(
                      filtered.reduce((sum, p) => sum + p[fy], 0),
                      true
                    )}
                  </td>
                ))}
                <td className="py-2 px-2 text-right">
                  {formatCurrency(
                    filtered.reduce((sum, p) => sum + p.total, 0),
                    true
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Funding source key */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">
          Funding Source Key
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          {Object.entries(cip.fundingSourceKey).map(([code, label]) => (
            <div key={code}>
              <span className="font-mono font-semibold">{code}</span>
              <span className="text-gray-500"> — {label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
