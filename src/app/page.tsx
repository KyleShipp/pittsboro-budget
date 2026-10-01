'use client';

import { useState } from 'react';
import { getMeta, getSummary, getBudget } from '@/lib/data';
import { formatCurrency, formatPercent, formatRate } from '@/lib/format';
import { perCapita, yoyChange } from '@/lib/calculations';
import StatCard from '@/components/StatCard';
import DepartmentBar from '@/components/DepartmentBar';
import RevenueBreakdown from '@/components/RevenueBreakdown';
import DeptDetail from '@/components/DeptDetail';

const meta = getMeta();
const summary = getSummary();
const budget = getBudget();

const fyKeys = Object.keys(summary.fiscalYears);

export default function HomePage() {
  const [selectedFY, setSelectedFY] = useState(meta.defaultFiscalYear);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  const fy = summary.fiscalYears[selectedFY];
  const prevFYKey = fyKeys[fyKeys.indexOf(selectedFY) - 1];
  const prevFY = prevFYKey ? summary.fiscalYears[prevFYKey] : null;

  const deptData = budget.departments
    .map((d) => ({
      id: d.id,
      name: d.name,
      total: d.amounts[selectedFY]?.total ?? 0,
    }))
    .filter((d) => d.total > 0);

  const revData = budget.revenueCategories.map((r) => ({
    category: r.category,
    amount: (r[selectedFY] as number) ?? 0,
  }));

  const selectedDeptObj = selectedDept
    ? budget.departments.find((d) => d.id === selectedDept)
    : null;

  const totalChange = prevFY
    ? yoyChange(fy.totalExpenditures, prevFY.totalExpenditures)
    : null;

  const fyMeta = meta.fiscalYears.find((f) => f.key === selectedFY);
  const fyTypeLabel =
    fyMeta?.type === 'actual'
      ? 'Actual'
      : fyMeta?.type === 'adopted'
        ? 'Adopted'
        : 'Recommended';

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Town of Pittsboro
          </h1>
          <p className="text-lg text-gray-600 mt-1">
            General Fund Budget &middot;{' '}
            <span className="font-semibold">
              {formatCurrency(fy.totalExpenditures, true)}
            </span>
            <span className="text-sm text-gray-400 ml-2">
              {fyTypeLabel}
            </span>
          </p>
        </div>
        <select
          value={selectedFY}
          onChange={(e) => {
            setSelectedFY(e.target.value);
            setSelectedDept(null);
          }}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          {fyKeys.map((fy) => {
            const m = meta.fiscalYears.find((f) => f.key === fy);
            return (
              <option key={fy} value={fy}>
                {m?.label ?? fy}
                {m?.type === 'actual'
                  ? ' (Actual)'
                  : m?.type === 'recommended'
                    ? ' (Recommended)'
                    : ''}
              </option>
            );
          })}
        </select>
      </div>

      {/* Status banner */}
      {fy.statusLabel && (
        <div
          className={`border rounded-xl p-5 mb-8 ${
            fy.status === 'adopted'
              ? 'bg-green-50 border-green-300'
              : 'bg-amber-50 border-amber-300'
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`text-xl mt-0.5 ${
                fy.status === 'adopted' ? 'text-green-600' : 'text-amber-500'
              }`}
            >
              {fy.status === 'adopted' ? '✓' : '⚠'}
            </span>
            <div>
              <p
                className={`font-semibold ${
                  fy.status === 'adopted' ? 'text-green-800' : 'text-amber-800'
                }`}
              >
                {fy.statusLabel}
              </p>
              <p
                className={`text-sm mt-1 ${
                  fy.status === 'adopted' ? 'text-green-700' : 'text-amber-700'
                }`}
              >
                {fy.statusDetail}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Budget"
          value={formatCurrency(fy.totalExpenditures, true)}
          sub={`${formatCurrency(perCapita(fy.totalExpenditures, meta.municipality.population))} per resident`}
          trend={
            totalChange !== null ? formatPercent(totalChange) + ' from prior year' : undefined
          }
          trendDirection={
            totalChange !== null
              ? totalChange > 0
                ? 'up'
                : totalChange < 0
                  ? 'down'
                  : 'neutral'
              : 'neutral'
          }
        />
        <StatCard
          label="Property Tax Rate"
          value={`${formatRate(fy.taxRate)} / $100`}
          sub={`1¢ = ${formatCurrency(fy.valueOfPenny)}`}
        />
        <StatCard
          label="Personnel"
          value={formatCurrency(
            budget.expenditureTotals[selectedFY]?.personnel ?? 0,
            true
          )}
          sub={`${(
            ((budget.expenditureTotals[selectedFY]?.personnel ?? 0) /
              fy.totalExpenditures) *
            100
          ).toFixed(0)}% of budget`}
        />
        <StatCard
          label="Debt Service"
          value={formatCurrency(
            budget.expenditureTotals[selectedFY]?.debtService ?? 0,
            true
          )}
          sub={`${(
            ((budget.expenditureTotals[selectedFY]?.debtService ?? 0) /
              fy.totalExpenditures) *
            100
          ).toFixed(1)}% of budget`}
        />
      </div>

      {/* Highlights */}
      {fy.highlights && fy.highlights.length > 0 && (
        <div className="bg-pittsboro-green/5 border border-pittsboro-green/20 rounded-xl p-5 mb-8">
          <h2 className="text-sm font-semibold text-pittsboro-green mb-2">
            Budget Highlights
          </h2>
          <ul className="text-sm text-gray-700 space-y-1">
            {fy.highlights.map((h, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-pittsboro-green mt-0.5">•</span>
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        {/* Revenue */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="text-lg font-semibold mb-4">
            Revenue by Source
          </h2>
          <RevenueBreakdown data={revData} />
        </div>

        {/* Expenditures */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="text-lg font-semibold mb-4">
            Spending by Department
          </h2>
          <p className="text-xs text-gray-400 mb-2">
            Click a department for details
          </p>
          <DepartmentBar
            data={deptData}
            onDeptClick={(id) =>
              setSelectedDept(selectedDept === id ? null : id)
            }
          />
        </div>
      </div>

      {/* Department Detail */}
      {selectedDeptObj && (
        <div className="mb-8">
          <DeptDetail
            dept={selectedDeptObj}
            fiscalYears={fyKeys}
            onClose={() => setSelectedDept(null)}
          />
        </div>
      )}

      {/* Spending Composition */}
      <div className="bg-white rounded-xl shadow-sm border p-5 mb-8">
        <h2 className="text-lg font-semibold mb-4">
          Spending Composition
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Personnel', key: 'personnel' as const, color: 'bg-pittsboro-green' },
            { label: 'Operating', key: 'operating' as const, color: 'bg-pittsboro-gold' },
            { label: 'Capital', key: 'capital' as const, color: 'bg-gray-400' },
            { label: 'Debt Service', key: 'debtService' as const, color: 'bg-gray-600' },
          ].map(({ label, key, color }) => {
            const val = budget.expenditureTotals[selectedFY]?.[key] ?? 0;
            const pct = ((val / fy.totalExpenditures) * 100).toFixed(1);
            return (
              <div key={key} className="text-center">
                <div className={`w-4 h-4 rounded-full ${color} mx-auto mb-1`} />
                <p className="text-xl font-bold">{formatCurrency(val, true)}</p>
                <p className="text-sm text-gray-500">
                  {label} ({pct}%)
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Budget Adoption Timeline */}
      {fy.timeline && fy.timeline.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-5 mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Budget Adoption Timeline
          </h2>
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />
            <div className="space-y-3">
              {fy.timeline.map((step, i) => {
                const isComplete = step.status === 'complete';
                const isNext = step.status === 'upcoming' && (i === 0 || fy.timeline![i - 1].status === 'complete');
                return (
                  <div key={i} className="flex items-start gap-3 relative">
                    <div
                      className={`w-4 h-4 rounded-full flex-shrink-0 mt-0.5 border-2 z-10 ${
                        isComplete
                          ? 'bg-pittsboro-green border-pittsboro-green'
                          : isNext
                            ? 'bg-white border-amber-400 ring-2 ring-amber-100'
                            : 'bg-white border-gray-300'
                      }`}
                    >
                      {isComplete && (
                        <svg className="w-3 h-3 text-white mx-auto mt-[-1px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${isComplete ? 'text-gray-700' : isNext ? 'text-amber-800 font-semibold' : 'text-gray-400'}`}>
                        {step.event}
                        {isNext && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                            Next
                          </span>
                        )}
                      </p>
                      <p className={`text-xs ${isComplete ? 'text-gray-400' : isNext ? 'text-amber-600' : 'text-gray-300'}`}>
                        {new Date(step.date + 'T12:00:00').toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
