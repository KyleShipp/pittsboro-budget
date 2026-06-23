'use client';

/**
 * /value-per-acre/anomalies — Data-quality review table.
 *
 * Displays every parcel flagged during the data-prep step
 * (pittsboro_value_per_acre.py), with sortable columns and
 * filter controls for action (exclude / review) and anomaly type.
 */

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import type { AnomalyRecord, ValuePerAcreAnomalies } from '@/types/budget';

// ── Data URL (handles Next.js basePath) ─────────────────────────────────────
const BASE_PATH = process.env.NODE_ENV === 'production' ? '/pittsboro-budget' : '';
const DATA_URL = `${BASE_PATH}/data/value_per_acre_anomalies.json`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(v: number | null) {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtAcres(v: number | null) {
  if (v === null || v === undefined) return '—';
  return v.toFixed(2);
}

const ACTION_STYLES: Record<string, string> = {
  exclude: 'bg-red-100 text-red-700',
  review:  'bg-amber-100 text-amber-700',
  include: 'bg-green-100 text-green-700',
};

const FLAG_LABELS: Record<string, string> = {
  no_geometry:         'No geometry',
  missing_acres:       'Missing acres',
  zero_acres:          'Zero acres',
  missing_value:       'Missing value',
  zero_value_taxable:  'Zero value (taxable)',
  duplicate_parcel_id: 'Duplicate parcel ID',
  extreme_high_vpa:    'Extreme high value/acre',
  extreme_low_vpa:     'Extreme low value/acre',
};

type SortKey = keyof AnomalyRecord | 'none';
type SortDir = 'asc' | 'desc';

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AnomaliesPage() {
  const [data, setData] = useState<ValuePerAcreAnomalies | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [actionFilter, setActionFilter] = useState<'all' | 'exclude' | 'review'>('all');
  const [flagFilter, setFlagFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>('none');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Load data
  useEffect(() => {
    fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ValuePerAcreAnomalies>;
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, []);

  // Unique flag list for filter dropdown
  const allFlags = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.records.forEach((r) => r.anomaly_flags.forEach((f) => set.add(f)));
    return Array.from(set).sort();
  }, [data]);

  // Filtered + sorted rows
  const rows = useMemo(() => {
    if (!data) return [];
    let filtered = data.records;

    if (actionFilter !== 'all') {
      filtered = filtered.filter((r) => r.action === actionFilter);
    }
    if (flagFilter !== 'all') {
      filtered = filtered.filter((r) => r.anomaly_flags.includes(flagFilter));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.parcel_id.toLowerCase().includes(q) ||
          r.owner.toLowerCase().includes(q) ||
          r.address.toLowerCase().includes(q)
      );
    }

    if (sortKey !== 'none') {
      filtered = [...filtered].sort((a, b) => {
        const av = a[sortKey as keyof AnomalyRecord];
        const bv = b[sortKey as keyof AnomalyRecord];
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return filtered;
  }, [data, actionFilter, flagFilter, search, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-pittsboro-green ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  // ── Loading / Error states ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading anomaly data…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <p className="text-red-700 font-medium">Failed to load anomaly data</p>
        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
        <p className="text-sm text-gray-500 mt-2">
          Run <code className="bg-gray-100 px-1 rounded">python pittsboro_value_per_acre.py</code> first
          to generate the data files, then rebuild the site.
        </p>
      </div>
    );
  }

  const byCounts = {
    exclude: data.records.filter((r) => r.action === 'exclude').length,
    review:  data.records.filter((r) => r.action === 'review').length,
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <Link
            href="/value-per-acre"
            className="text-sm text-pittsboro-green hover:underline"
          >
            ← Back to Map
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Anomaly Review</h1>
        <p className="text-lg text-gray-600 mt-1">
          Parcels flagged during value-per-acre data quality checks
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Flagged</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.total_anomalies.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-red-500 uppercase tracking-wide">Excluded from Map</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{byCounts.exclude.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Can&apos;t compute value/acre
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-amber-600 uppercase tracking-wide">Flagged on Map</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{byCounts.review.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">Shown in orange</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">IQR Multiplier</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.iqr_multiplier}×</p>
          <p className="text-xs text-gray-400 mt-0.5">Log-scale outlier threshold</p>
        </div>
      </div>

      {/* IQR thresholds info */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
        <p>
          <strong>Outlier thresholds (IQR method, log scale):</strong>{' '}
          Parcels with value/acre below{' '}
          <strong>{fmtCurrency(data.iqr_low_threshold)}/ac</strong> or above{' '}
          <strong>{fmtCurrency(data.iqr_high_threshold)}/ac</strong> are flagged for review
          (action = &quot;review&quot;) and shown on the map in orange. They are not automatically excluded
          because the value may be genuine (e.g. downtown commercial land or large rural tracts).
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as typeof actionFilter)}
          >
            <option value="all">All actions</option>
            <option value="exclude">Exclude ({byCounts.exclude})</option>
            <option value="review">Review ({byCounts.review})</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Anomaly Type</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={flagFilter}
            onChange={(e) => setFlagFilter(e.target.value)}
          >
            <option value="all">All types</option>
            {allFlags.map((f) => (
              <option key={f} value={f}>{FLAG_LABELS[f] ?? f}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Search (ID / owner / address)</label>
          <input
            type="search"
            className="border rounded px-2 py-1 text-sm w-full"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-sm text-gray-500">
          Showing <span className="font-medium text-gray-700">{rows.length.toLocaleString()}</span> of{' '}
          {data.total_anomalies.toLocaleString()}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500 text-xs uppercase tracking-wide">
              <th
                className="py-3 px-4 cursor-pointer select-none hover:text-gray-800"
                onClick={() => handleSort('parcel_id')}
              >
                Parcel ID <SortIcon col="parcel_id" />
              </th>
              <th
                className="py-3 px-4 cursor-pointer select-none hover:text-gray-800"
                onClick={() => handleSort('owner')}
              >
                Owner <SortIcon col="owner" />
              </th>
              <th
                className="py-3 px-4 cursor-pointer select-none hover:text-gray-800"
                onClick={() => handleSort('address')}
              >
                Address <SortIcon col="address" />
              </th>
              <th
                className="py-3 px-4 text-right cursor-pointer select-none hover:text-gray-800"
                onClick={() => handleSort('acres')}
              >
                Acres <SortIcon col="acres" />
              </th>
              <th
                className="py-3 px-4 text-right cursor-pointer select-none hover:text-gray-800"
                onClick={() => handleSort('tax_value')}
              >
                Tax Value <SortIcon col="tax_value" />
              </th>
              <th
                className="py-3 px-4 text-right cursor-pointer select-none hover:text-gray-800"
                onClick={() => handleSort('value_per_acre')}
              >
                Value/Acre <SortIcon col="value_per_acre" />
              </th>
              <th className="py-3 px-4">Anomaly Reason</th>
              <th
                className="py-3 px-4 cursor-pointer select-none hover:text-gray-800"
                onClick={() => handleSort('action')}
              >
                Action <SortIcon col="action" />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.parcel_id}-${i}`} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-2 px-4 font-mono text-xs text-gray-700">{r.parcel_id || '—'}</td>
                <td className="py-2 px-4 text-gray-800 max-w-[180px] truncate" title={r.owner}>
                  {r.owner || '—'}
                </td>
                <td className="py-2 px-4 text-gray-600 max-w-[200px] truncate" title={r.address}>
                  {r.address || '—'}
                </td>
                <td className="py-2 px-4 text-right tabular-nums text-gray-700">
                  {fmtAcres(r.acres)}
                </td>
                <td className="py-2 px-4 text-right tabular-nums text-gray-700">
                  {fmtCurrency(r.tax_value)}
                </td>
                <td className="py-2 px-4 text-right tabular-nums font-medium text-gray-800">
                  {r.value_per_acre !== null ? fmtCurrency(r.value_per_acre) : '—'}
                </td>
                <td className="py-2 px-4 text-xs text-gray-600">
                  {r.anomaly_flags.map((f) => (
                    <span
                      key={f}
                      className="inline-block bg-gray-100 text-gray-700 rounded px-1.5 py-0.5 mr-1 mb-0.5 whitespace-nowrap"
                    >
                      {FLAG_LABELS[f] ?? f}
                    </span>
                  ))}
                </td>
                <td className="py-2 px-4">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                      ACTION_STYLES[r.action] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {r.action}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-gray-400">
                  No records match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <p className="mt-4 text-xs text-gray-400">
        Generated {data.generated} &middot; IQR outlier detection (×{data.iqr_multiplier}, log scale)
        &middot; Low threshold: {fmtCurrency(data.iqr_low_threshold)}/ac
        &middot; High threshold: {fmtCurrency(data.iqr_high_threshold)}/ac
      </p>
    </div>
  );
}
