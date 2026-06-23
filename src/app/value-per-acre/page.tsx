'use client';

/**
 * /value-per-acre — Tax Value per Acre choropleth map.
 *
 * Loads the pre-generated GeoJSON produced by
 * PittsboroTaxBase/pittsboro_value_per_acre.py, then renders a Leaflet
 * choropleth (no SSR — Leaflet requires browser globals).
 *
 * Leaflet CSS is imported here so it is only bundled for this route.
 */

import 'leaflet/dist/leaflet.css';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState, useCallback } from 'react';
import type { ValuePerAcreGeoJSON } from '@/types/budget';

// ── Dynamically import the map so Leaflet never runs on the server ──────────
const ValuePerAcreMap = dynamic(
  () => import('@/components/ValuePerAcreMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-xl border animate-pulse">
        <p className="text-gray-400 text-sm">Initialising map…</p>
      </div>
    ),
  }
);

// ── Resolve the data URL (accounts for Next.js basePath in production) ──────
const BASE_PATH = process.env.NODE_ENV === 'production' ? '/pittsboro-budget' : '';
const DATA_URL = `${BASE_PATH}/data/value_per_acre.geojson`;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ValuePerAcrePage() {
  const [metadata, setMetadata] = useState<ValuePerAcreGeoJSON['metadata'] | null>(null);

  const handleLoad = useCallback((meta: ValuePerAcreGeoJSON['metadata']) => {
    setMetadata(meta);
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tax Value per Acre</h1>
            <p className="text-lg text-gray-600 mt-1">
              Town of Pittsboro &middot; Assessed value density by parcel
            </p>
          </div>
          <Link
            href="/value-per-acre/anomalies"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-400 bg-amber-50 text-amber-800 text-sm font-medium hover:bg-amber-100 transition-colors"
          >
            <span>⚠</span>
            Anomaly Review Table
            {metadata && metadata.review > 0 && (
              <span className="bg-amber-200 text-amber-900 rounded-full px-2 py-0.5 text-xs font-bold">
                {metadata.review}
              </span>
            )}
          </Link>
        </div>

        {metadata && (
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
            <span>
              <span className="font-medium text-gray-700">{metadata.total_features.toLocaleString()}</span>{' '}
              parcels on map
            </span>
            <span>
              <span className="font-medium text-amber-600">{metadata.review.toLocaleString()}</span>{' '}
              flagged for review
            </span>
            <span>
              Data generated: <span className="font-medium text-gray-700">{metadata.generated}</span>
            </span>
          </div>
        )}
      </div>

      {/* Explainer */}
      <div className="bg-pittsboro-green/5 border border-pittsboro-green/20 rounded-xl p-4 mb-6 text-sm text-gray-700">
        <p>
          <strong className="text-pittsboro-green">Value per Acre</strong> = Total Assessed Value ÷ Parcel Acres.
          Higher values indicate more intensively used or more expensive land.
          Parcels are colored by quantile (7 equal-count classes).
          Orange parcels passed all data checks but have an unusual value/acre and are
          flagged for review — they appear on the map but should be interpreted with
          caution.
        </p>
        <p className="mt-2">
          Parcels excluded from this map (zero acres, missing geometry, exempt with no
          assessed value, etc.) are listed in the{' '}
          <Link href="/value-per-acre/anomalies" className="underline text-pittsboro-green hover:text-pittsboro-dark">
            Anomaly Review Table
          </Link>.
        </p>
      </div>

      {/* Map */}
      <ValuePerAcreMap dataUrl={DATA_URL} onLoad={handleLoad} />

      {/* Footer note */}
      <p className="mt-4 text-xs text-gray-400">
        Source: Chatham County CAMA Parcels ArcGIS service. Calculations and
        anomaly detection performed by{' '}
        <code>PittsboroTaxBase/pittsboro_value_per_acre.py</code>.
        Re-run that script to refresh data.
      </p>
    </div>
  );
}
