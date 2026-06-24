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

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const SLIDER_STEPS = 1000;

function valueAtPercentile(sortedValues: number[], pct: number): number {
  if (!sortedValues.length) return 0;
  const p = clamp(pct, 0, 1);
  const index = Math.floor(p * (sortedValues.length - 1));
  return sortedValues[index];
}

function buildLogHistogram(values: number[], min: number, max: number, bins = 40): number[] {
  const counts = new Array(bins).fill(0);
  if (!values.length || max <= min) return counts;

  const logMin = Math.log(min);
  const logMax = Math.log(max);
  const span = logMax - logMin;
  if (span <= 0) return counts;

  for (const v of values) {
    if (v <= 0) continue;
    const pct = (Math.log(v) - logMin) / span;
    const idx = clamp(Math.floor(pct * bins), 0, bins - 1);
    counts[idx] += 1;
  }
  return counts;
}

// ── Filter state ────────────────────────────────────────────────────────────

export interface MapFilters {
  minVpa: number;
  maxVpa: number;
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
    minVpa: 0,
    maxVpa: 0,
    showReview: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ min: number; max: number; median: number; q1: number; q3: number } | null>(null);
  const [sortedVpa, setSortedVpa] = useState<number[]>([]);
  const [rangePos, setRangePos] = useState<{ min: number; max: number }>({ min: 250, max: 750 });

  const distribution = useMemo(() => {
    if (!geojson || !stats) return [] as number[];
    const values = geojson.features
      .filter((f) => (filters.showReview ? true : f.properties.action !== 'review'))
      .map((f) => f.properties.value_per_acre)
      .filter((v): v is number => typeof v === 'number' && isFinite(v));
    return buildLogHistogram(values, stats.min, stats.max, 42);
  }, [geojson, stats, filters.showReview]);

  const sliderPositions = useMemo(() => {
    const minPos = rangePos.min;
    const maxPos = rangePos.max;
    const leftPct = (minPos / SLIDER_STEPS) * 100;
    const rightPct = 100 - (maxPos / SLIDER_STEPS) * 100;
    return {
      minPos,
      maxPos,
      leftPct: clamp(leftPct, 0, 100),
      rightPct: clamp(rightPct, 0, 100),
    };
  }, [rangePos.min, rangePos.max]);

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
        setSortedVpa(sorted);
        setBreaks(computeQuantileBreaks(vpas));
        
        const min = sorted[0] ?? 0;
        const max = sorted[sorted.length - 1] ?? 0;
        const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
        const q1 = sorted[Math.floor(sorted.length * 0.25)] ?? min;
        const q3 = sorted[Math.floor(sorted.length * 0.75)] ?? max;
        
        setStats({ min, max, median, q1, q3 });
        // Set default range: show middle 50% so map is populated on first load.
        setFilters((f) => ({ ...f, minVpa: q1, maxVpa: q3 }));
        setRangePos({ min: 250, max: 750 });
        
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

    const minVpa = filters.minVpa;
    const maxVpa = filters.maxVpa;

    const filtered = geojson.features.filter((f) => {
      const { value_per_acre, action } = f.properties;
      if (!filters.showReview && action === 'review') return false;
      if (value_per_acre === null || value_per_acre < minVpa || value_per_acre > maxVpa) return false;
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
      <style>{`
        input[type="range"] {
          -webkit-appearance: slider-horizontal;
          width: 100%;
          cursor: pointer;
        }
        input[type="range"]::-webkit-slider-runnable-track {
          height: 8px;
          background: transparent;
        }
        input[type="range"]::-moz-range-track {
          height: 8px;
          background: transparent;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #2d5a27;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        input[type="range"]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #2d5a27;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
      `}</style>
      {/* ── Controls ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border p-5 mb-4">
        <div className="mb-4">
          <div className="flex items-end justify-between mb-2">
            <div>
              <label className="block text-sm font-semibold text-gray-900">Value per Acre Range</label>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatCurrency(filters.minVpa)} – {formatCurrency(filters.maxVpa)}
              </p>
            </div>
            {stats && (
              <div className="text-right text-xs text-gray-500 space-y-0.5">
                <div>Q1: <span className="font-medium text-gray-700">{formatCurrency(stats.q1)}/ac</span></div>
                <div>Median: <span className="font-medium text-gray-700">{formatCurrency(stats.median)}/ac</span></div>
                <div>Q3: <span className="font-medium text-gray-700">{formatCurrency(stats.q3)}/ac</span></div>
              </div>
            )}
          </div>

          {/* Dual range slider */}
          {stats && (
            <div className="space-y-2">
              <div className="relative pt-2 pb-8">
                {/* Distribution bars (where parcels fall along the range) */}
                <div className="h-12 mb-2 flex items-end gap-[1px]">
                  {distribution.map((count, i) => {
                    const maxCount = Math.max(...distribution, 1);
                    const h = Math.max(2, Math.round((count / maxCount) * 100));
                    const isInside = i >= Math.floor((sliderPositions.leftPct / 100) * distribution.length)
                      && i <= Math.ceil(((100 - sliderPositions.rightPct) / 100) * distribution.length);
                    return (
                      <div
                        key={`${i}-${count}`}
                        title={`${count.toLocaleString()} parcels`}
                        className={isInside ? 'bg-pittsboro-green/80' : 'bg-gray-300'}
                        style={{ height: `${h}%`, width: `${100 / distribution.length}%` }}
                      />
                    );
                  })}
                </div>

                {/* Background bar */}
                <div className="absolute top-6 left-0 right-0 h-2 bg-gradient-to-r from-blue-100 to-blue-400 rounded-full" />
                
                {/* Min slider */}
                <input
                  type="range"
                  min={0}
                  max={SLIDER_STEPS}
                  step={1}
                  value={sliderPositions.minPos}
                  onChange={(e) => {
                    const newMinPos = Math.min(Number(e.target.value), rangePos.max - 1);
                    const newMin = valueAtPercentile(sortedVpa, newMinPos / SLIDER_STEPS);
                    setRangePos((p) => ({ ...p, min: newMinPos }));
                    setFilters((f) => ({ ...f, minVpa: Math.min(newMin, f.maxVpa) }));
                  }}
                  className="absolute w-full h-2 top-6 left-0 right-0 appearance-none bg-transparent rounded-full accent-pittsboro-green"
                  style={{
                    zIndex: sliderPositions.minPos > SLIDER_STEPS / 2 ? 5 : 3,
                  }}
                />
                
                {/* Max slider */}
                <input
                  type="range"
                  min={0}
                  max={SLIDER_STEPS}
                  step={1}
                  value={sliderPositions.maxPos}
                  onChange={(e) => {
                    const newMaxPos = Math.max(Number(e.target.value), rangePos.min + 1);
                    const newMax = valueAtPercentile(sortedVpa, newMaxPos / SLIDER_STEPS);
                    setRangePos((p) => ({ ...p, max: newMaxPos }));
                    setFilters((f) => ({ ...f, maxVpa: Math.max(newMax, f.minVpa) }));
                  }}
                  className="absolute w-full h-2 top-6 left-0 right-0 appearance-none bg-transparent rounded-full accent-pittsboro-green"
                  style={{
                    zIndex: sliderPositions.maxPos < SLIDER_STEPS / 2 ? 3 : 5,
                  }}
                />

                {/* Range fill */}
                <div
                  className="absolute h-2 bg-pittsboro-green rounded-full top-6"
                  style={{
                    left: `${sliderPositions.leftPct}%`,
                    right: `${sliderPositions.rightPct}%`,
                  }}
                />

                {/* Labels below */}
                <div className="absolute -bottom-5 left-0 text-xs text-gray-500 pointer-events-none">
                  {formatCurrency(stats.min)}/ac
                </div>
                <div className="absolute -bottom-5 right-0 text-xs text-gray-500 pointer-events-none">
                  {formatCurrency(stats.max)}/ac
                </div>
              </div>

              {/* Quick presets */}
              <div className="flex flex-wrap gap-2 mt-8 pt-2">
                <button
                  onClick={() => {
                    setRangePos({ min: 0, max: SLIDER_STEPS });
                    setFilters((f) => ({ ...f, minVpa: stats.min, maxVpa: stats.max }));
                  }}
                  className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Show All
                </button>
                <button
                  onClick={() => {
                    setRangePos({ min: 250, max: 750 });
                    setFilters((f) => ({ ...f, minVpa: stats.q1, maxVpa: stats.q3 }));
                  }}
                  className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Q1–Q3 (Middle 50%)
                </button>
                <button
                  onClick={() => {
                    setRangePos({ min: 500, max: 750 });
                    setFilters((f) => ({ ...f, minVpa: stats.median, maxVpa: stats.q3 }));
                  }}
                  className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Above Median
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t">
          <input
            type="checkbox"
            id="showReview"
            checked={filters.showReview}
            onChange={(e) => setFilters((f) => ({ ...f, showReview: e.target.checked }))}
            className="accent-pittsboro-green"
          />
          <label htmlFor="showReview" className="text-sm text-gray-700">
            Show flagged parcels (orange on map)
          </label>
        </div>
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
