'use client';

import { useState } from 'react';
import { formatCurrency, formatPercent } from '@/lib/format';
import type { DepartmentAmounts } from '@/types/budget';

interface DeptDetailProps {
  dept: {
    id: string;
    name: string;
    amounts: Record<string, DepartmentAmounts>;
    note?: string;
  };
  fiscalYears: string[];
  onClose: () => void;
}

export default function DeptDetail({ dept, fiscalYears, onClose }: DeptDetailProps) {
  const currentFY = fiscalYears[fiscalYears.length - 1];
  const prevFY = fiscalYears.length > 1 ? fiscalYears[fiscalYears.length - 2] : null;
  const current = dept.amounts[currentFY];
  const prev = prevFY ? dept.amounts[prevFY] : null;

  function pctChange(cur: number, prv: number | undefined) {
    if (!prv || prv === 0) return '';
    return formatPercent(((cur - prv) / prv) * 100);
  }

  const breakdownRows = [
    { label: 'Personnel', key: 'personnel' as const },
    { label: 'Operating', key: 'operating' as const },
    { label: 'Capital', key: 'capital' as const },
    { label: 'Total', key: 'total' as const },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
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

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2 pr-4">Category</th>
            {fiscalYears.map((fy) => (
              <th key={fy} className="py-2 px-3 text-right">{fy}</th>
            ))}
            {prev && <th className="py-2 px-3 text-right">Change</th>}
          </tr>
        </thead>
        <tbody>
          {breakdownRows.map((row) => (
            <tr
              key={row.key}
              className={`border-b ${row.key === 'total' ? 'font-semibold bg-gray-50' : ''}`}
            >
              <td className="py-2 pr-4">{row.label}</td>
              {fiscalYears.map((fy) => (
                <td key={fy} className="py-2 px-3 text-right">
                  {formatCurrency(dept.amounts[fy]?.[row.key] ?? 0)}
                </td>
              ))}
              {prev && (
                <td className="py-2 px-3 text-right">
                  {pctChange(current[row.key], prev[row.key])}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mini bar showing composition */}
      <div className="mt-4">
        <p className="text-xs text-gray-400 mb-1 font-medium">
          {currentFY} Composition
        </p>
        <div className="flex h-4 rounded overflow-hidden">
          {current.personnel > 0 && (
            <div
              className="bg-pittsboro-green"
              style={{ width: `${(current.personnel / current.total) * 100}%` }}
              title={`Personnel: ${formatCurrency(current.personnel)}`}
            />
          )}
          {current.operating > 0 && (
            <div
              className="bg-pittsboro-gold"
              style={{ width: `${(current.operating / current.total) * 100}%` }}
              title={`Operating: ${formatCurrency(current.operating)}`}
            />
          )}
          {current.capital > 0 && (
            <div
              className="bg-gray-400"
              style={{ width: `${(current.capital / current.total) * 100}%` }}
              title={`Capital: ${formatCurrency(current.capital)}`}
            />
          )}
        </div>
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
    </div>
  );
}
