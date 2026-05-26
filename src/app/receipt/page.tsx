'use client';

import { useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { getMeta, getSummary, getBudget } from '@/lib/data';
import { formatCurrency } from '@/lib/format';
import { calculateTaxBill, allocateTaxReceipt, allocateTaxReceiptWeighted } from '@/lib/calculations';
import { searchParcels, type ParcelResult } from '@/lib/parcel';

const meta = getMeta();
const summary = getSummary();
const budget = getBudget();

const COUNTY_RATE = (meta as any).countyTaxRates?.rates?.find(
  (r: any) => r.year === 'FY26-27'
)?.rate ?? 0.60;

const COLORS = [
  '#2d5a27', '#3b7a33', '#4e9c3f', '#6ab04c', '#81c784',
  '#a5d6a7', '#c8e6c9', '#c4a43c', '#d4b84e', '#e0c86a',
  '#9e9e9e', '#bdbdbd', '#e0e0e0',
];

export default function ReceiptPage() {
  const fy = 'FY26-27';
  const fyData = summary.fiscalYears[fy];
  const [homeValue, setHomeValue] = useState(meta.municipality.medianHomeValue);
  const [addressQuery, setAddressQuery] = useState('');
  const [results, setResults] = useState<ParcelResult[]>([]);
  const [selectedParcel, setSelectedParcel] = useState<ParcelResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [receiptMode, setReceiptMode] = useState<'weighted' | 'proportional'>('weighted');

  const handleSearch = useCallback(async () => {
    if (!addressQuery.trim()) return;
    setSearching(true);
    setError('');
    setSearched(true);
    try {
      const parcels = await searchParcels(addressQuery);
      setResults(parcels);
      if (parcels.length === 1) {
        setSelectedParcel(parcels[0]);
        setHomeValue(parcels[0].assessedValue);
      } else {
        setSelectedParcel(null);
      }
    } catch (e) {
      setError('Could not reach Chatham County GIS. Try the manual slider below.');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [addressQuery]);

  function selectParcel(p: ParcelResult) {
    setSelectedParcel(p);
    setHomeValue(p.assessedValue);
  }

  // Tax calculations
  const townTax = calculateTaxBill(homeValue, fyData.taxRate, fyData.collectionRate);
  const countyTax = calculateTaxBill(homeValue, COUNTY_RATE, fyData.collectionRate);
  const totalTax = townTax + countyTax;
  const garbageFee = 250; // Flat fee on tax bill, not based on assessed value
  const totalTaxBill = totalTax + garbageFee; // Full amount on your tax bill

  // Town service allocations
  const serviceDepts = budget.departments
    .filter((d) => d.id !== 'debt-service' && (d.amounts[fy]?.total ?? 0) > 0)
    .map((d) => ({ id: d.id, name: d.name, total: d.amounts[fy]?.total ?? 0 }));
  const serviceTotal = serviceDepts.reduce((sum, d) => sum + d.total, 0);
  const debtTotal =
    budget.departments.find((d) => d.id === 'debt-service')?.amounts[fy]?.total ?? 0;
  const totalBudget = serviceTotal + debtTotal;

  // Dedicated revenue data
  const dedicatedRevenue: Record<string, { total: number }> =
    (budget as any).dedicatedRevenue?.['FY26-27'] ?? {};

  // Proportional mode (simple)
  const proportionalAllocations = allocateTaxReceipt(townTax, serviceDepts, totalBudget);
  const proportionalDebt = Math.round(townTax * (debtTotal / totalBudget) * 100) / 100;

  // Weighted mode (accurate — accounts for dedicated revenue)
  const allDeptsWithDebt = [...serviceDepts, { id: 'debt-service', name: 'Debt Service', total: debtTotal }];
  const weightedAllocations = allocateTaxReceiptWeighted(townTax, allDeptsWithDebt, dedicatedRevenue);

  // Pick based on mode
  const allocations = receiptMode === 'weighted'
    ? weightedAllocations.filter((a) => a.name !== 'Debt Service')
    : proportionalAllocations;
  const debtAllocation = receiptMode === 'weighted'
    ? weightedAllocations.find((a) => a.name === 'Debt Service')?.amount ?? 0
    : proportionalDebt;

  const chartData = [
    ...allocations.map((a) => ({ name: a.name, amount: a.amount })),
    { name: 'Debt Service', amount: debtAllocation },
  ].sort((a, b) => b.amount - a.amount);

  // County vs Town vs Garbage pie
  const splitData = [
    { name: `Town of Pittsboro ($${fyData.taxRate.toFixed(2)})`, value: townTax },
    { name: `Chatham County ($${COUNTY_RATE.toFixed(2)})`, value: countyTax },
    { name: `Solid Waste Fee`, value: garbageFee },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Your Property Tax Receipt</h1>
      <p className="text-gray-600 mb-8">
        Look up your property to see exactly how your tax bill breaks down
        between the Town and the County.
      </p>

      {/* Address Lookup */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">Look Up Your Property</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter your street address (e.g., 160 Hillsboro St)"
            value={addressQuery}
            onChange={(e) => setAddressQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 border rounded-lg px-4 py-2 text-sm"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="bg-pittsboro-green text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-pittsboro-dark disabled:opacity-50 transition"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Searches Chatham County GIS parcel records in real time
        </p>

        {error && (
          <p className="text-sm text-red-600 mt-3">{error}</p>
        )}

        {/* Search results */}
        {results.length > 1 && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">
              {results.length} properties found — select yours:
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p.parcelNumber}
                  onClick={() => selectParcel(p)}
                  className={`w-full text-left border rounded-lg p-3 text-sm transition ${
                    selectedParcel?.parcelNumber === p.parcelNumber
                      ? 'border-pittsboro-green bg-pittsboro-green/5'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium">{p.address}</div>
                  <div className="text-gray-500 text-xs mt-0.5">
                    {p.owner} · {formatCurrency(p.assessedValue)} assessed
                    {p.inPittsboro ? (
                      <span className="ml-2 text-pittsboro-green font-medium">
                        ✓ In Pittsboro
                      </span>
                    ) : (
                      <span className="ml-2 text-gray-400">
                        Outside Pittsboro
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {searched && results.length === 0 && !searching && !error && (
          <p className="text-sm text-gray-500 mt-3">
            No properties found. Try a shorter search (e.g., just the street
            number and name).
          </p>
        )}
      </div>

      {/* Selected property info */}
      {selectedParcel && (
        <div
          className={`rounded-xl p-5 mb-6 border ${
            selectedParcel.inPittsboro
              ? 'bg-pittsboro-green/5 border-pittsboro-green/20'
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-lg">{selectedParcel.address}</p>
              <p className="text-sm text-gray-600">{selectedParcel.owner}</p>
              <p className="text-xs text-gray-400 mt-1">
                Parcel #{selectedParcel.parcelNumber} · {selectedParcel.taxDistrict} ·{' '}
                {selectedParcel.landUse}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">
                {formatCurrency(selectedParcel.assessedValue)}
              </p>
              <p className="text-xs text-gray-500">
                Land: {formatCurrency(selectedParcel.landValue)} · Building:{' '}
                {formatCurrency(selectedParcel.buildingValue)}
              </p>
            </div>
          </div>
          {!selectedParcel.inPittsboro && (
            <div className="mt-3 text-sm text-amber-800">
              ⚠ This property is <strong>outside Pittsboro town limits</strong>.
              Your tax district is &ldquo;{selectedParcel.taxDistrict}&rdquo; — while
              parts of this district overlap with Pittsboro, your parcel is not
              within the municipal boundary. You pay the Chatham County rate
              (${COUNTY_RATE.toFixed(2)}/$100) but <strong>not</strong> the
              Town of Pittsboro rate ($0.44/$100). Properties inside town limits
              show as &ldquo;PITTSBORO CITY&rdquo; district.
            </div>
          )}
        </div>
      )}

      {/* Manual slider fallback */}
      {!selectedParcel && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Or enter your home&apos;s assessed value manually
          </label>
          <input
            type="range"
            min={50000}
            max={1500000}
            step={5000}
            value={homeValue}
            onChange={(e) => setHomeValue(Number(e.target.value))}
            className="w-full mb-2"
          />
          <div className="flex justify-between items-center">
            <input
              type="text"
              value={formatCurrency(homeValue)}
              onChange={(e) => {
                const num = Number(e.target.value.replace(/[^0-9]/g, ''));
                if (!isNaN(num)) setHomeValue(num);
              }}
              className="border rounded px-3 py-1.5 text-lg font-semibold w-44"
            />
            <p className="text-sm text-gray-500">
              Median: {formatCurrency(meta.municipality.medianHomeValue)}
            </p>
          </div>
        </div>
      )}

      {/* County vs Town split */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-1">Your Annual Tax Bill</h2>
          <p className="text-3xl font-bold text-gray-900">
            {formatCurrency(Math.round(totalTaxBill))}
            <span className="text-base font-normal text-gray-400 ml-2">/ year</span>
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Ad valorem rate: ${(fyData.taxRate + COUNTY_RATE).toFixed(2)} per $100 + ${garbageFee} solid waste fee
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-pittsboro-green" />
                <span className="text-sm font-medium">Town of Pittsboro</span>
              </div>
              <div className="text-right">
                <span className="font-semibold">
                  {formatCurrency(Math.round(townTax))}
                </span>
                <span className="text-xs text-gray-400 ml-2">
                  ${fyData.taxRate.toFixed(2)}/100
                </span>
              </div>
            </div>
            <div className="flex h-3 rounded overflow-hidden">
              <div
                className="bg-pittsboro-green"
                style={{ width: `${(townTax / totalTaxBill) * 100}%` }}
              />
              <div
                className="bg-blue-400"
                style={{ width: `${(countyTax / totalTaxBill) * 100}%` }}
              />
              <div
                className="bg-amber-400"
                style={{ width: `${(garbageFee / totalTaxBill) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-400" />
                <span className="text-sm font-medium">Chatham County</span>
              </div>
              <div className="text-right">
                <span className="font-semibold">
                  {formatCurrency(Math.round(countyTax))}
                </span>
                <span className="text-xs text-gray-400 ml-2">
                  ${COUNTY_RATE.toFixed(2)}/100
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="text-sm font-medium">Solid Waste Fee</span>
              </div>
              <div className="text-right">
                <span className="font-semibold">
                  ${garbageFee}
                </span>
                <span className="text-xs text-gray-400 ml-2">
                  flat fee
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t text-xs text-gray-400">
            <p>
              Monthly: {formatCurrency(Math.round(totalTaxBill / 12))} total
              ({formatCurrency(Math.round(townTax / 12))} town +{' '}
              {formatCurrency(Math.round(countyTax / 12))} county +{' '}
              ${Math.round(garbageFee / 12)} solid waste)
            </p>
            <p className="mt-1">
              The solid waste fee is a flat ${garbageFee}/yr charge on your tax bill
              — it does not vary with property value and directly funds the GFL
              collection contract.
            </p>
          </div>
        </div>

        {/* Pie chart */}
        <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col items-center justify-center">
          <h2 className="text-lg font-semibold mb-2">
            Where Your Tax Bill Goes
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={splitData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={40}
                paddingAngle={3}
                label={false}
              >
                <Cell fill="#2d5a27" />
                <Cell fill="#60a5fa" />
                <Cell fill="#fbbf24" />
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(Math.round(v))} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex gap-4 text-sm flex-wrap justify-center">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-pittsboro-green" />
              Town {((townTax / totalTaxBill) * 100).toFixed(0)}%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-400" />
              County {((countyTax / totalTaxBill) * 100).toFixed(0)}%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              Solid Waste {((garbageFee / totalTaxBill) * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Town services breakdown */}
      {(!selectedParcel || selectedParcel.inPittsboro) && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold">
              Your Town Tax: {formatCurrency(Math.round(townTax))} Breakdown
            </h2>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setReceiptMode('weighted')}
                className={`px-3 py-1.5 rounded-md transition ${receiptMode === 'weighted' ? 'bg-white shadow-sm font-medium' : ''}`}
              >
                Revenue-weighted
              </button>
              <button
                onClick={() => setReceiptMode('proportional')}
                className={`px-3 py-1.5 rounded-md transition ${receiptMode === 'proportional' ? 'bg-white shadow-sm font-medium' : ''}`}
              >
                Proportional
              </button>
            </div>
          </div>

          {receiptMode === 'weighted' && (
            <p className="text-xs text-gray-500 mb-4">
              Revenue-weighted mode subtracts dedicated revenue (garbage fees, development fees, Powell Bill, etc.)
              from each department before allocating your property tax. Departments funded by fees show a smaller
              share of your tax bill because those fees already cover their costs.
            </p>
          )}

          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h3 className="text-sm font-semibold text-gray-500 mb-3">
                Town Services
              </h3>
              <ResponsiveContainer
                width="100%"
                height={Math.max(300, chartData.length * 36)}
              >
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ left: 10, right: 30 }}
                >
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `$${v.toFixed(0)}`}
                    fontSize={12}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={170}
                    fontSize={12}
                  />
                  <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h3 className="text-sm font-semibold text-gray-500 mb-3">
                Detailed Breakdown
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2">Service</th>
                    <th className="py-2 text-right">Annual</th>
                    <th className="py-2 text-right">Monthly</th>
                    <th className="py-2 text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((a) => {
                    const w = 'dedicated' in a ? a as any : null;
                    return (
                      <tr key={a.name} className="border-b">
                        <td className="py-2">
                          {a.name}
                          {receiptMode === 'weighted' && w && w.dedicated > 0 && (
                            <span className="block text-xs text-gray-400">
                              {formatCurrency(w.dedicated, true)} from fees
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          ${a.amount.toFixed(2)}
                          {receiptMode === 'weighted' && w && w.dedicated > 0 && a.amount === 0 && (
                            <span className="block text-xs text-green-600">Fee-funded</span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          ${(a.amount / 12).toFixed(2)}
                        </td>
                        <td className="py-2 text-right text-gray-500">
                          {a.share.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-b">
                    <td className="py-2">Debt Service</td>
                    <td className="py-2 text-right">
                      ${debtAllocation.toFixed(2)}
                    </td>
                    <td className="py-2 text-right">
                      ${(debtAllocation / 12).toFixed(2)}
                    </td>
                    <td className="py-2 text-right text-gray-500">
                      {receiptMode === 'weighted'
                        ? (weightedAllocations.find((a) => a.name === 'Debt Service')?.share ?? 0).toFixed(1)
                        : ((debtTotal / totalBudget) * 100).toFixed(1)
                      }%
                    </td>
                  </tr>
                  <tr className="font-semibold bg-gray-50">
                    <td className="py-2">Town Total</td>
                    <td className="py-2 text-right">
                      {formatCurrency(Math.round(townTax))}
                    </td>
                    <td className="py-2 text-right">
                      {formatCurrency(Math.round(townTax / 12))}
                    </td>
                    <td className="py-2 text-right">100%</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-3">
                This is an explanatory estimate, not your official tax bill.
                Property taxes fund about{' '}
                {Math.round(
                  ((budget.revenueCategories.find(
                    (r) => r.category === 'Property Tax'
                  )?.['FY26-27'] as number ?? 0) /
                    fyData.totalRevenue) *
                    100
                )}
                % of the General Fund — the rest comes from sales tax,
                development fees, grants, and other sources. The allocations
                above show each department&apos;s proportional share of the
                total budget applied to your tax bill, which is the standard
                approach used by municipal transparency tools. County tax
                funds county services (schools, sheriff, social services, etc.)
                and is not broken down here.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
