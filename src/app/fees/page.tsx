'use client';

import { useState } from 'react';
import { getFees } from '@/lib/data';

const fees = getFees();

export default function FeesPage() {
  const [search, setSearch] = useState('');

  const lowerSearch = search.toLowerCase();

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Fee Schedule</h1>
      <p className="text-gray-600 mb-2">
        General Fund Fee Schedule for {fees.fiscalYear}
      </p>

      {/* Key change callout */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-yellow-800">
          <span className="font-semibold">What&apos;s new: </span>
          {fees.keyChange}
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search fees..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md border rounded-lg px-4 py-2 text-sm"
        />
      </div>

      {/* Fee categories */}
      <div className="space-y-6">
        {fees.categories.map((cat) => {
          // Check if anything in this category matches search
          const hasDirectFees =
            cat.fees?.some(
              (f) =>
                !search ||
                f.item.toLowerCase().includes(lowerSearch) ||
                cat.name.toLowerCase().includes(lowerSearch)
            ) ?? false;

          const matchingSubs =
            cat.subcategories?.filter((sub) =>
              sub.fees.some(
                (f) =>
                  !search ||
                  f.item.toLowerCase().includes(lowerSearch) ||
                  sub.name.toLowerCase().includes(lowerSearch) ||
                  cat.name.toLowerCase().includes(lowerSearch)
              )
            ) ?? [];

          if (!hasDirectFees && matchingSubs.length === 0 && search) {
            return null;
          }

          return (
            <div
              key={cat.name}
              className="bg-white rounded-xl shadow-sm border overflow-hidden"
            >
              <div className="bg-gray-50 px-5 py-3 border-b">
                <h2 className="text-lg font-semibold">{cat.name}</h2>
                {cat.description && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {cat.description}
                  </p>
                )}
              </div>

              <div className="p-5">
                {cat.note && (
                  <p className="text-sm text-gray-500 mb-3 italic">
                    {cat.note}
                  </p>
                )}

                {/* Direct fees */}
                {cat.fees && cat.fees.length > 0 && (
                  <table className="w-full text-sm mb-4" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col />
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '100px' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="py-2">Item</th>
                        <th className="py-2 text-right">Fee</th>
                        <th className="py-2 text-right">Per</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.fees
                        .filter(
                          (f) =>
                            !search ||
                            f.item.toLowerCase().includes(lowerSearch) ||
                            cat.name.toLowerCase().includes(lowerSearch)
                        )
                        .map((f) => (
                          <tr key={f.item} className="border-b">
                            <td className="py-2">{f.item}</td>
                            <td className="py-2 text-right font-semibold">
                              ${f.amount.toFixed(2)}
                            </td>
                            <td className="py-2 text-right text-gray-500">
                              {f.unit}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}

                {/* Subcategories */}
                {matchingSubs.length > 0 && (
                  <div className="space-y-4">
                    {matchingSubs.map((sub) => (
                      <div key={sub.name}>
                        <h3 className="text-sm font-semibold text-gray-700 mb-1">
                          {sub.name}
                        </h3>
                        {sub.note && (
                          <p className="text-xs text-gray-400 mb-2">
                            {sub.note}
                          </p>
                        )}
                        <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                          <colgroup>
                            <col />
                            <col style={{ width: '120px' }} />
                            <col style={{ width: '100px' }} />
                          </colgroup>
                          <tbody>
                            {sub.fees
                              .filter(
                                (f) =>
                                  !search ||
                                  f.item
                                    .toLowerCase()
                                    .includes(lowerSearch) ||
                                  sub.name
                                    .toLowerCase()
                                    .includes(lowerSearch) ||
                                  cat.name
                                    .toLowerCase()
                                    .includes(lowerSearch)
                              )
                              .map((f) => (
                                <tr key={f.item} className="border-b">
                                  <td className="py-1.5">{f.item}</td>
                                  <td className="py-1.5 text-right font-semibold">
                                    ${f.amount.toFixed(2)}
                                  </td>
                                  <td className="py-1.5 text-right text-gray-500 text-xs">
                                    {f.unit}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
