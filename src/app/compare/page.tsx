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
import { getMeta, getSummary, getBudget } from '@/lib/data';
import { formatCurrency, formatPercent } from '@/lib/format';
import { yoyChange } from '@/lib/calculations';

const meta = getMeta();
const summary = getSummary();
const budget = getBudget();
const fyKeys = Object.keys(summary.fiscalYears);

const BAR_COLORS = ['#c8e6c9', '#4e9c3f', '#2d5a27'];

// Fixed department order: sorted by latest FY total, descending
const DEPT_ORDER = [...budget.departments]
  .sort((a, b) => {
    const lastFY = fyKeys[fyKeys.length - 1];
    return (b.amounts[lastFY]?.total ?? 0) - (a.amounts[lastFY]?.total ?? 0);
  })
  .map((d) => d.id);

export default function ComparePage() {
  const [selectedFYs, setSelectedFYs] = useState<string[]>(fyKeys);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'budget' | 'change'>('budget');

  const activeFYs = fyKeys.filter((fy) => selectedFYs.includes(fy));
  const lastFY = activeFYs[activeFYs.length - 1];
  const firstFY = activeFYs[0];

  function toggleFY(fy: string) {
    setSelectedFYs((prev) => {
      if (prev.includes(fy)) {
        if (prev.length <= 2) return prev; // minimum 2
        return prev.filter((f) => f !== fy);
      }
      return [...prev, fy];
    });
  }

  // Build department data in fixed order
  const deptData = DEPT_ORDER.map((id) => {
    const dept = budget.departments.find((d) => d.id === id)!;
    const row: Record<string, string | number> = { name: dept.name, id: dept.id };
    for (const fy of activeFYs) {
      row[fy] = dept.amounts[fy]?.total ?? 0;
    }
    if (activeFYs.length >= 2) {
      row.dollarChange =
        (dept.amounts[lastFY]?.total ?? 0) -
        (dept.amounts[firstFY]?.total ?? 0);
      row.pctChange = yoyChange(
        dept.amounts[lastFY]?.total ?? 0,
        dept.amounts[firstFY]?.total ?? 0
      );
    }
    return row;
  });

  const sortedDeptData =
    sortBy === 'change' && activeFYs.length >= 2
      ? [...deptData].sort(
          (a, b) =>
            Math.abs(b.dollarChange as number) -
            Math.abs(a.dollarChange as number)
        )
      : deptData; // 'budget' uses the fixed DEPT_ORDER

  // Revenue data in fixed order (sorted by latest FY)
  const revData = [...budget.revenueCategories]
    .sort((a, b) => ((b[lastFY] as number) ?? 0) - ((a[lastFY] as number) ?? 0))
    .map((r) => {
      const row: Record<string, string | number> = { category: r.category };
      for (const fy of activeFYs) {
        row[fy] = (r[fy] as number) ?? 0;
      }
      if (activeFYs.length >= 2) {
        row.dollarChange =
          ((r[lastFY] as number) ?? 0) - ((r[firstFY] as number) ?? 0);
        row.pctChange = yoyChange(
          (r[lastFY] as number) ?? 0,
          (r[firstFY] as number) ?? 0
        );
      }
      return row;
    });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Compare Fiscal Years</h1>
          <p className="text-gray-600 mt-1">
            Side-by-side spending and revenue comparison
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {fyKeys.map((fy) => {
            const active = selectedFYs.includes(fy);
            const m = meta.fiscalYears.find((f) => f.key === fy);
            return (
              <button
                key={fy}
                onClick={() => toggleFY(fy)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                  active
                    ? 'bg-pittsboro-green text-white border-pittsboro-green'
                    : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
                }`}
              >
                {fy}
                {m?.type === 'actual'
                  ? ' ✓'
                  : m?.type === 'recommended'
                    ? ' ◇'
                    : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary cards */}
      <div className={`grid gap-4 mb-8 ${activeFYs.length === 3 ? 'grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4'}`}>
        {activeFYs.map((fy) => (
          <div key={fy} className="bg-white rounded-xl shadow-sm border p-4">
            <p className="text-sm text-gray-500">{fy}</p>
            <p className="text-xl font-bold">
              {formatCurrency(summary.fiscalYears[fy].totalExpenditures, true)}
            </p>
          </div>
        ))}
        {activeFYs.length >= 2 && (
          <>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <p className="text-sm text-gray-500">
                {firstFY} → {lastFY}
              </p>
              <p className="text-xl font-bold">
                {formatCurrency(
                  summary.fiscalYears[lastFY].totalExpenditures -
                    summary.fiscalYears[firstFY].totalExpenditures,
                  true
                )}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <p className="text-sm text-gray-500">% Change</p>
              <p className="text-xl font-bold">
                {formatPercent(
                  yoyChange(
                    summary.fiscalYears[lastFY].totalExpenditures,
                    summary.fiscalYears[firstFY].totalExpenditures
                  )
                )}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Department comparison chart */}
      <div className="bg-white rounded-xl shadow-sm border p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Spending by Department</h2>
          <p className="text-xs text-gray-400">Click a bar for detail</p>
        </div>
        <ResponsiveContainer
          width="100%"
          height={Math.max(350, deptData.length * 44)}
        >
          <BarChart
            data={deptData}
            layout="vertical"
            margin={{ left: 10, right: 30 }}
          >
            <XAxis
              type="number"
              tickFormatter={(v) => formatCurrency(v, true)}
              fontSize={12}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={180}
              fontSize={12}
            />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            {activeFYs.map((fy, i) => (
              <Bar
                key={fy}
                dataKey={fy}
                fill={BAR_COLORS[i] ?? BAR_COLORS[BAR_COLORS.length - 1]}
                radius={[0, 4, 4, 0]}
                onClick={(entry) => {
                  const id = entry?.id as string;
                  if (id) setExpandedDept(expandedDept === id ? null : id);
                }}
                cursor="pointer"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Department detail panel */}
      {expandedDept && <DeptCompareDetail deptId={expandedDept} fiscalYears={activeFYs} onClose={() => setExpandedDept(null)} />}

      {/* Department change table */}
      <div className="bg-white rounded-xl shadow-sm border p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Department Comparison</h2>
          {activeFYs.length >= 2 && (
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setSortBy('budget')}
                className={`px-2.5 py-1 rounded-md transition ${sortBy === 'budget' ? 'bg-white shadow-sm font-medium' : ''}`}
              >
                By size
              </button>
              <button
                onClick={() => setSortBy('change')}
                className={`px-2.5 py-1 rounded-md transition ${sortBy === 'change' ? 'bg-white shadow-sm font-medium' : ''}`}
              >
                By change
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4">Department</th>
                {activeFYs.map((fy) => (
                  <th key={fy} className="py-2 px-3 text-right">{fy}</th>
                ))}
                {activeFYs.length >= 2 && (
                  <>
                    <th className="py-2 px-3 text-right">$ Change</th>
                    <th className="py-2 px-3 text-right">% Change</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedDeptData.map((d) => (
                <tr
                  key={d.id as string}
                  className={`border-b cursor-pointer transition-colors ${expandedDept === d.id ? 'bg-pittsboro-green/5' : 'hover:bg-gray-50'}`}
                  onClick={() =>
                    setExpandedDept(
                      expandedDept === (d.id as string)
                        ? null
                        : (d.id as string)
                    )
                  }
                >
                  <td className="py-2 pr-4 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className={`text-xs transition-transform ${expandedDept === d.id ? 'rotate-90' : ''}`}>
                        ▸
                      </span>
                      {d.name}
                    </span>
                  </td>
                  {activeFYs.map((fy) => (
                    <td key={fy} className="py-2 px-3 text-right">
                      {formatCurrency(d[fy] as number)}
                    </td>
                  ))}
                  {activeFYs.length >= 2 && (
                    <>
                      <td
                        className={`py-2 px-3 text-right ${
                          (d.dollarChange as number) > 0
                            ? 'text-red-600'
                            : (d.dollarChange as number) < 0
                              ? 'text-green-600'
                              : ''
                        }`}
                      >
                        {formatCurrency(d.dollarChange as number)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right ${
                          (d.pctChange as number) > 0
                            ? 'text-red-600'
                            : (d.pctChange as number) < 0
                              ? 'text-green-600'
                              : ''
                        }`}
                      >
                        {formatPercent(d.pctChange as number)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue comparison table */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <h2 className="text-lg font-semibold mb-4">Revenue by Source</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4">Source</th>
                {activeFYs.map((fy) => (
                  <th key={fy} className="py-2 px-3 text-right">{fy}</th>
                ))}
                {activeFYs.length >= 2 && (
                  <>
                    <th className="py-2 px-3 text-right">$ Change</th>
                    <th className="py-2 px-3 text-right">% Change</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {revData.map((r) => (
                <tr key={r.category as string} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium">{r.category}</td>
                  {activeFYs.map((fy) => (
                    <td key={fy} className="py-2 px-3 text-right">
                      {formatCurrency(r[fy] as number)}
                    </td>
                  ))}
                  {activeFYs.length >= 2 && (
                    <>
                      <td
                        className={`py-2 px-3 text-right ${
                          (r.dollarChange as number) > 0
                            ? 'text-green-600'
                            : (r.dollarChange as number) < 0
                              ? 'text-red-600'
                              : ''
                        }`}
                      >
                        {formatCurrency(r.dollarChange as number)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right ${
                          (r.pctChange as number) > 0
                            ? 'text-green-600'
                            : (r.pctChange as number) < 0
                              ? 'text-red-600'
                              : ''
                        }`}
                      >
                        {formatPercent(r.pctChange as number)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Inline department detail component ────────────────────────── */

function DeptCompareDetail({
  deptId,
  fiscalYears,
  onClose,
}: {
  deptId: string;
  fiscalYears: string[];
  onClose: () => void;
}) {
  const dept = budget.departments.find((d) => d.id === deptId);
  if (!dept) return null;

  const categories = ['personnel', 'operating', 'capital', 'total'] as const;
  const labels: Record<string, string> = {
    personnel: 'Personnel',
    operating: 'Operating',
    capital: 'Capital',
    total: 'Total',
  };

  const lastFY = fiscalYears[fiscalYears.length - 1];
  const firstFY = fiscalYears[0];

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">{dept.name}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      {dept.note && (
        <p className="text-sm text-gray-500 mb-4 italic">{dept.note}</p>
      )}

      {/* Breakdown table */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4">Category</th>
              {fiscalYears.map((fy) => (
                <th key={fy} className="py-2 px-3 text-right">{fy}</th>
              ))}
              {fiscalYears.length >= 2 && (
                <th className="py-2 px-3 text-right">Change</th>
              )}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const cur = dept.amounts[lastFY]?.[cat] ?? 0;
              const prev = dept.amounts[firstFY]?.[cat] ?? 0;
              const change = prev === 0 ? (cur === 0 ? 0 : 100) : ((cur - prev) / prev) * 100;

              return (
                <tr
                  key={cat}
                  className={`border-b ${cat === 'total' ? 'font-semibold bg-gray-50' : ''}`}
                >
                  <td className="py-2 pr-4">{labels[cat]}</td>
                  {fiscalYears.map((fy) => (
                    <td key={fy} className="py-2 px-3 text-right">
                      {formatCurrency(dept.amounts[fy]?.[cat] ?? 0)}
                    </td>
                  ))}
                  {fiscalYears.length >= 2 && (
                    <td
                      className={`py-2 px-3 text-right ${
                        change > 0
                          ? 'text-red-600'
                          : change < 0
                            ? 'text-green-600'
                            : ''
                      }`}
                    >
                      {formatPercent(change)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Composition bar for each FY — proportional width across years */}
      {(() => {
        const maxTotal = Math.max(...fiscalYears.map((fy) => dept.amounts[fy]?.total ?? 0));
        return (
          <div className="space-y-2">
            {fiscalYears.map((fy) => {
              const a = dept.amounts[fy];
              if (!a || a.total === 0) return null;
              const barWidth = (a.total / maxTotal) * 100;
              return (
                <div key={fy}>
                  <p className="text-xs text-gray-400 mb-0.5">{fy}</p>
                  <div className="flex h-3 rounded overflow-hidden" style={{ width: `${barWidth}%` }}>
                    {a.personnel > 0 && (
                      <div
                        className="bg-pittsboro-green"
                        style={{ width: `${(a.personnel / a.total) * 100}%` }}
                        title={`Personnel: ${formatCurrency(a.personnel)}`}
                      />
                    )}
                    {a.operating > 0 && (
                      <div
                        className="bg-pittsboro-gold"
                        style={{ width: `${(a.operating / a.total) * 100}%` }}
                        title={`Operating: ${formatCurrency(a.operating)}`}
                      />
                    )}
                    {a.capital > 0 && (
                      <div
                        className="bg-gray-400"
                        style={{ width: `${(a.capital / a.total) * 100}%` }}
                        title={`Capital: ${formatCurrency(a.capital)}`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
        <div className="flex gap-4 mt-1 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-pittsboro-green inline-block" />
            Personnel
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-pittsboro-gold inline-block" />
            Operating
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
            Capital
          </span>
        </div>
    </div>
  );
}
