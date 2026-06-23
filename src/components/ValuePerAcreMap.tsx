'use client';

/**
 * ValuePerAcreMap
 *
 * Leaflet choropleth map of Pittsboro parcel value-per-acre.
 * This component must ONLY be rendered client-side (no SSR) because
 * Leaflet requires browser globals (window, document).
 *
 * Import it via next/dynamic with { ssr: false }.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { ValuePerAcreGeoJSON, ParcelFeature, ParcelProperties } from '@/types/budget';

// ── Color scale (7-class Blues, low → high value/acre) ─────────────────────
const PALETTE = [
  '#eff3ff',
  '#c6dbef',
  '#9ecae1',
  '#6baed6',
  '#3182bd',
  '#08519c',
  '#08306b',
];
const REVIEW_COLOR = '#f97316'; // orange for flagged-but-mapped parcels
const NO_DATA_COLOR = '#e5e7eb'; // gray

function computeQuantileBreaks(values: number[], n = 7): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const breaks: number[] = [];
  for (let i = 1; i < n; i++) {
    const idx = Math.floor((i / n) * sorted.length);
    breaks.push(sorted[idx]);
  }
  return breaks; // length n-1 → n classes
}

function getColor(vpa: number | null, breaks: number[], isReview: boolean): string {
  if (isReview) return REVIEW_COLOR;
  if (vpa === null || vpa === undefined) return NO_DATA_COLOR;
  for (let i = 0; i < breaks.length; i++) {
    if (vpa <= breaks[i]) return PALETTE[i];
  }
  return PALETTE[PALETTE.length - 1];
}

function formatCurrency(v: number | null): string {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function formatAcres(v: number | null): string {
  if (v === null || v === undefined) return '—';
  return v.toFixed(2) + ' ac';
}

// ── Filter state ────────────────────────────────────────────────────────────

export interface MapFilters {
  minVpa: number | '';
  maxVpa: number | '';
  showReview: boolean;
}

// ── Props ───────────────────────────────────────────────────────────────────

interface Props {
  dataUrl: string;
  onLoad?: (metadata: ValuePerAcreGeoJSON['metadata']) => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ValuePerAcreMap({ dataUrl, onLoad }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);

  const [geojson, setGeojson] = useState<ValuePerAcreGeoJSON | null>(null);
  const [breaks, setBreaks] = useState<number[]>([]);
  const [filters, setFilters] = useState<MapFilters>({
    minVpa: '',
    maxVpa: '',
    showReview: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ min: number; max: number; median: number } | null>(null);

  // ── Fetch GeoJSON ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch(dataUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ValuePerAcreGeoJSON>;
      })
      .then((data) => {
        setGeojson(data);
        const vpas = data.features
          .map((f) => f.properties.value_per_acre)
          .filter((v): v is number => v !== null && v !== undefined && isFinite(v));
        const sorted = [...vpas].sort((a, b) => a - b);
        setBreaks(computeQuantileBreaks(vpas));
        setStats({
          min: sorted[0] ?? 0,
          max: sorted[sorted.length - 1] ?? 0,
          median: sorted[Math.floor(sorted.length / 2)] ?? 0,
        });
        onLoad?.(data.metadata);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, [dataUrl, onLoad]);

  // ── Initialise Leaflet map ──────────────────────────────────────────────
  useEffect(() => {
    if (!geojson || !mapRef.current || leafletMapRef.current) return;

    // Leaflet is browser-only; we import it dynamically here.
    import('leaflet').then((L) => {
      // Fix broken default icon path (common Leaflet + webpack issue).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center: [35.726, -79.174], // Pittsboro, NC
        zoom: 14,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      leafletMapRef.current = map;
    });

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geojson]);

  // ── Render / re-render GeoJSON layer when data or filters change ────────
  const renderLayer = useCallback(async () => {
    if (!geojson || !leafletMapRef.current || breaks.length === 0) return;
    const L = await import('leaflet');

    if (geoLayerRef.current) {
      geoLayerRef.current.remove();
      geoLayerRef.current = null;
    }

    const minVpa = filters.minVpa !== '' ? Number(filters.minVpa) : null;
    const maxVpa = filters.maxVpa !== '' ? Number(filters.maxVpa) : null;

    const filtered = geojson.features.filter((f) => {
      const { value_per_acre, action } = f.properties;
      if (!filters.showReview && action === 'review') return false;
      if (minVpa !== null && (value_per_acre === null || value_per_acre < minVpa)) return false;
      if (maxVpa !== null && (value_per_acre === null || value_per_acre > maxVpa)) return false;
      return true;
    });

    const layer = L.geoJSON(
      { type: 'FeatureCollection', features: filtered } as GeoJSON.FeatureCollection,
      {
        style: (feature) => {
          const p = feature?.properties as ParcelProperties | undefined;
          const isReview = p?.action === 'review';
          const color = getColor(p?.value_per_acre ?? null, breaks, isReview);
          return {
            fillColor: color,
            fillOpacity: 0.75,
            color: isReview ? '#ea580c' : '#475569',
            weight: 0.6,
            opacity: 0.8,
          };
        },
        onEachFeature: (feature, lyr) => {
          const p = feature.properties as ParcelProperties;
          const anomalyBadge =
            p.anomaly_reason
              ? `<div class="mt-1 text-xs font-semibold text-orange-600">
                   ⚠ ${p.anomaly_reason.replace(/;/g, '<br>⚠ ')}
                 </div>`
              : '';
          lyr.bindPopup(
            `<div class="text-sm leading-snug min-w-[220px]">
               <div class="font-semibold text-gray-900 mb-1">${p.parcel_id}</div>
               <div class="text-gray-700">${p.owner || '—'}</div>
               <div class="text-gray-500 mb-1">${p.address || '—'}</div>
               <table class="w-full text-xs border-t pt-1">
                 <tr><td class="text-gray-500 pr-2">Acres</td>
                     <td class="text-right font-medium">${formatAcres(p.acres)}</td></tr>
                 <tr><td class="text-gray-500 pr-2">Tax Value</td>
                     <td class="text-right font-medium">${formatCurrency(p.tax_value)}</td></tr>
                 <tr><td class="text-gray-500 pr-2 font-semibold">Value/Acre</td>
                     <td class="text-right font-bold text-pittsboro-green">${formatCurrency(p.value_per_acre)}</td></tr>
               </table>
               ${anomalyBadge}
             </div>`,
            { maxWidth: 280 }
          );
          lyr.on('mouseover', () =>
            (lyr as L.Path).setStyle({ weight: 2, color: '#1e293b', fillOpacity: 0.9 })
          );
          lyr.on('mouseout', () => layer.resetStyle(lyr as L.Path));
        },
      }
    );

    layer.addTo(leafletMapRef.current);
    geoLayerRef.current = layer;

    // Fit to bounds on first render.
    if (layer.getBounds().isValid()) {
      leafletMapRef.current.fitBounds(layer.getBounds(), { padding: [20, 20] });
    }
  }, [geojson, breaks, filters]);

  useEffect(() => {
    renderLayer();
  }, [renderLayer]);

  // ── Legend labels ────────────────────────────────────────────────────────
  const legendLabels: Array<{ color: string; label: string }> = breaks.length
    ? [
        { color: PALETTE[0], label: `< ${formatCurrency(breaks[0])}` },
        ...breaks.slice(0, -1).map((b, i) => ({
          color: PALETTE[i + 1],
          label: `${formatCurrency(b)} – ${formatCurrency(breaks[i + 1])}`,
        })),
        { color: PALETTE[PALETTE.length - 1], label: `> ${formatCurrency(breaks[breaks.length - 1])}` },
        { color: REVIEW_COLOR, label: 'Flagged (review)' },
      ]
    : [];

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-xl border">
        <p className="text-gray-500 text-sm">Loading parcel data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-red-50 rounded-xl border border-red-200">
        <div className="text-center">
          <p className="text-red-700 font-medium">Failed to load map data</p>
          <p className="text-sm text-red-500 mt-1">{error}</p>
          <p className="text-sm text-gray-500 mt-2">
            Run <code className="bg-gray-100 px-1 rounded">python pittsboro_value_per_acre.py</code> to
            generate the data file, then rebuild the site.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Controls ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border p-4 mb-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Min Value/Acre ($)
          </label>
          <input
            type="number"
            className="border rounded px-2 py-1 text-sm w-28"
            placeholder="e.g. 10000"
            value={filters.minVpa}
            onChange={(e) =>
              setFilters((f) => ({ ...f, minVpa: e.target.value === '' ? '' : Number(e.target.value) }))
            }
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Max Value/Acre ($)
          </label>
          <input
            type="number"
            className="border rounded px-2 py-1 text-sm w-28"
            placeholder="e.g. 500000"
            value={filters.maxVpa}
            onChange={(e) =>
              setFilters((f) => ({ ...f, maxVpa: e.target.value === '' ? '' : Number(e.target.value) }))
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="showReview"
            checked={filters.showReview}
            onChange={(e) => setFilters((f) => ({ ...f, showReview: e.target.checked }))}
            className="accent-pittsboro-green"
          />
          <label htmlFor="showReview" className="text-sm text-gray-700">
            Show flagged parcels
          </label>
        </div>
        {stats && (
          <div className="ml-auto text-xs text-gray-500 space-y-0.5 text-right">
            <div>Min: <span className="font-medium text-gray-700">{formatCurrency(stats.min)}/ac</span></div>
            <div>Median: <span className="font-medium text-gray-700">{formatCurrency(stats.median)}/ac</span></div>
            <div>Max: <span className="font-medium text-gray-700">{formatCurrency(stats.max)}/ac</span></div>
          </div>
        )}
      </div>

      {/* ── Map + Legend layout ─────────────────────────────────────────── */}
      <div className="relative">
        {/* Leaflet map container */}
        <div ref={mapRef} style={{ height: '560px' }} className="rounded-xl border overflow-hidden z-0" />

        {/* Legend overlay */}
        {legendLabels.length > 0 && (
          <div
            className="absolute bottom-6 right-3 bg-white/90 backdrop-blur-sm border rounded-lg p-3 text-xs shadow z-[400]"
            style={{ pointerEvents: 'none' }}
          >
            <p className="font-semibold text-gray-800 mb-2 text-center">Value / Acre</p>
            {legendLabels.map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5 mb-1 last:mb-0">
                <span
                  className="inline-block w-4 h-4 rounded-sm border border-gray-300 flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-gray-700 whitespace-nowrap">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
