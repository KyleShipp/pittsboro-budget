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
import dynamic from 'next/dynamic';
import booleanWithin from '@turf/boolean-within';
import { calculateTaxBill } from '@/lib/calculations';
import { getTaxBase } from '@/lib/data';
import { getFinishedAreaValuation, summarizeParcels } from '@/lib/parcel-analysis';
import { resolveNeighborhood } from '@/lib/neighborhoods';
import neighborhoodDefinitions from '../../public/data/neighborhoods.json';
import type { ValuePerAcreGeoJSON, ParcelFeature, ParcelProperties, NeighborhoodPreset } from '@/types/budget';

const { fiscalYear, townRate, countyRate } = getTaxBase();
const neighborhoods: NeighborhoodPreset[] = neighborhoodDefinitions;
const NeighborhoodSetupPanel = process.env.NODE_ENV === 'development'
  ? dynamic(() => import('@/components/NeighborhoodSetupPanel'))
  : null;

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

function formatCurrency(v: number | null, fractionDigits = 0): string {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
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
  const analysisLayerRef = useRef<L.LayerGroup | null>(null);
  const guideLayerRef = useRef<L.Polyline | null>(null);
  const hasFitBoundsRef = useRef(false);
  const drawPointsRef = useRef<Array<[number, number]>>([]);

  const [geojson, setGeojson] = useState<ValuePerAcreGeoJSON | null>(null);
  const [breaks, setBreaks] = useState<number[]>([]);
  const [filters, setFilters] = useState<MapFilters>({
    minVpa: 0,
    maxVpa: 0,
    showReview: true,
  });
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ min: number; max: number; median: number; q1: number; q3: number } | null>(null);
  const [sortedVpa, setSortedVpa] = useState<number[]>([]);
  const [rangePos, setRangePos] = useState<{ min: number; max: number }>({ min: 250, max: 750 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<Array<[number, number]>>([]);
  const updateDrawPoints = useCallback((points: Array<[number, number]>) => {
    drawPointsRef.current = points;
    setDrawPoints(points);
  }, []);
  const [analysis, setAnalysis] = useState<ReturnType<typeof summarizeParcels> | null>(null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<NeighborhoodPreset | null>(null);
  const [selectionMethod, setSelectionMethod] = useState<'polygon' | 'preset' | 'manual'>('polygon');
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [neighborhoodName, setNeighborhoodName] = useState('');
  const resolvedNeighborhoods = useMemo(() => {
    if (!geojson) return [];
    return neighborhoods.map((preset) => {
      const resolved = resolveNeighborhood(preset, geojson.features);
      if (neighborhoods.filter((item) => item.id === preset.id).length > 1) {
        resolved.issues.push(`Duplicate neighborhood ID: ${preset.id}.`);
        resolved.features = [];
      }
      return { preset, ...resolved };
    });
  }, [geojson]);

  const toggleSetupParcel = useCallback((feature: ParcelFeature) => {
    if (!geojson) return;
    setAnalysis((current) => {
      const features = current?.features ?? [];
      const id = feature.properties.parcel_id;
      const selected = features.some((item) => item.properties.parcel_id === id);
      return summarizeParcels(
        selected ? features.filter((item) => item.properties.parcel_id !== id) : [...features, feature],
        geojson,
      );
    });
    setSelectedNeighborhood(null);
    setSelectionMethod('manual');
  }, [geojson]);

  const removeSetupParcel = useCallback((id: string) => {
    if (!geojson) return;
    setAnalysis((current) => summarizeParcels(
      (current?.features ?? []).filter((item) => item.properties.parcel_id !== id),
      geojson,
    ));
    setSelectedNeighborhood(null);
    setSelectionMethod('manual');
  }, [geojson]);

  const townTax = analysis ? calculateTaxBill(analysis.value, townRate, 1) : 0;
  const countyTax = analysis ? calculateTaxBill(analysis.value, countyRate, 1) : 0;

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
      const analysisPane = map.createPane('analysis');
      analysisPane.style.zIndex = '450';
      analysisPane.style.pointerEvents = 'none';

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      leafletMapRef.current = map;
      setMapReady(true);
    });

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        hasFitBoundsRef.current = false;
        setMapReady(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geojson]);

  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !mapReady || (!analysis && drawPoints.length === 0)) return;

    let disposed = false;
    let group: L.LayerGroup | null = null;
    import('leaflet').then((L) => {
      if (disposed) return;
      const layerGroup = L.layerGroup().addTo(map);
      group = layerGroup;
      analysisLayerRef.current = layerGroup;
      if (analysis && !isDrawing) {
        const selectedParcels: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: analysis.features,
        };
        L.geoJSON(selectedParcels, {
          pane: 'analysis',
          interactive: false,
          style: {
            color: '#7c3aed',
            fillColor: '#8b5cf6',
            fillOpacity: 0.65,
            weight: 2,
          },
        }).addTo(layerGroup);
        return;
      }
      if (drawPoints.length >= 3) {
        L.polygon(drawPoints, {
          pane: 'analysis',
          color: '#7c3aed',
          fillColor: '#8b5cf6',
          fillOpacity: 0.14,
          weight: 3,
          interactive: false,
        }).addTo(layerGroup);
      } else if (drawPoints.length === 2) {
        L.polyline(drawPoints, {
          pane: 'analysis',
          color: '#7c3aed',
          weight: 3,
          interactive: false,
        }).addTo(layerGroup);
      }
      drawPoints.forEach((point) => {
        L.circleMarker(point, {
          pane: 'analysis',
          radius: 6,
          color: '#ffffff',
          weight: 2,
          fillColor: '#7c3aed',
          fillOpacity: 1,
          interactive: false,
        }).addTo(layerGroup);
      });
    });

    return () => {
      disposed = true;
      group?.remove();
      if (analysisLayerRef.current === group) analysisLayerRef.current = null;
    };
  }, [drawPoints, analysis, isDrawing, mapReady]);

  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !isDrawing || drawPoints.length === 0) {
      guideLayerRef.current?.remove();
      guideLayerRef.current = null;
      return;
    }

    let disposed = false;
    let updateGuide: ((event: L.LeafletMouseEvent) => void) | null = null;
    let resetGuide: (() => void) | null = null;
    const lastPoint = drawPoints[drawPoints.length - 1];
    import('leaflet').then((L) => {
      if (disposed || !leafletMapRef.current) return;
      const guide = L.polyline([lastPoint, lastPoint], {
              color: '#7c3aed',
              weight: 2,
              dashArray: '6 5',
              interactive: false,
            }).addTo(leafletMapRef.current);
      guideLayerRef.current = guide;

      updateGuide = (event: L.LeafletMouseEvent) => {
        guide.setLatLngs([lastPoint, event.latlng]);
      };
      resetGuide = () => guide.setLatLngs([lastPoint, lastPoint]);
      map.on('mousemove', updateGuide);
      map.on('mouseout', resetGuide);

      if (disposed) {
        map.off('mousemove', updateGuide);
        map.off('mouseout', resetGuide);
        guide.remove();
      }
    });

    return () => {
      disposed = true;
      if (updateGuide) map.off('mousemove', updateGuide);
      if (resetGuide) map.off('mouseout', resetGuide);
      guideLayerRef.current?.remove();
      guideLayerRef.current = null;
    };
  }, [drawPoints, isDrawing]);

  const clearAnalysis = useCallback(() => {
    setIsDrawing(false);
    updateDrawPoints([]);
    setAnalysis(null);
    setSelectedNeighborhood(null);
    setSelectionMethod('polygon');
    if (analysisLayerRef.current) {
      analysisLayerRef.current.remove();
      analysisLayerRef.current = null;
    }
    guideLayerRef.current?.remove();
    guideLayerRef.current = null;
  }, [updateDrawPoints]);

  const selectNeighborhood = useCallback((preset: NeighborhoodPreset, features: ParcelFeature[]) => {
    if (!geojson) return;
    clearAnalysis();
    setAnalysis(summarizeParcels(features, geojson));
    setSelectedNeighborhood(preset);
    setSelectionMethod('preset');
    setNeighborhoodName(preset.name);
    leafletMapRef.current?.closePopup();
    import('leaflet').then((L) => {
      const parcels: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
      const bounds = L.geoJSON(parcels).getBounds();
      if (bounds.isValid()) leafletMapRef.current?.fitBounds(bounds, { padding: [24, 24] });
    });
  }, [geojson, clearAnalysis]);

  const analyzeDrawnArea = useCallback(() => {
    const points = drawPointsRef.current;
    if (!geojson || points.length < 3) return;

    const ring = points.map(([lat, lng]) => [lng, lat]);
    ring.push(ring[0]);
    const analysisArea: GeoJSON.Feature<GeoJSON.Polygon> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [ring] },
    };
    const encompassed = geojson.features.filter((feature) =>
      booleanWithin(feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>, analysisArea)
    );
    setAnalysis(summarizeParcels(encompassed, geojson));
    setSelectedNeighborhood(null);
    setSelectionMethod('polygon');
    setIsDrawing(false);
  }, [geojson]);

  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !isDrawing) return;

    const handleMapClick = (event: L.LeafletMouseEvent) => {
      // A double-click's first click supplies the final vertex; ignore its second click.
      if (event.originalEvent.detail > 1) return;
      map.closePopup();
      const points = drawPointsRef.current;
      const last = points[points.length - 1];
      if (last?.[0] === event.latlng.lat && last?.[1] === event.latlng.lng) return;
      updateDrawPoints([...points, [event.latlng.lat, event.latlng.lng]]);
    };
    const handleDoubleClick = () => analyzeDrawnArea();
    const doubleClickZoomEnabled = map.doubleClickZoom.enabled();

    map.doubleClickZoom.disable();
    map.getContainer().style.cursor = 'crosshair';
    map.on('click', handleMapClick);
    map.on('dblclick', handleDoubleClick);
    return () => {
      map.off('click', handleMapClick);
      map.off('dblclick', handleDoubleClick);
      if (doubleClickZoomEnabled) map.doubleClickZoom.enable();
      map.getContainer().style.cursor = '';
    };
  }, [isDrawing, mapReady, analyzeDrawnArea, updateDrawPoints]);

  // ── Render / re-render GeoJSON layer when data or filters change ────────
  const renderLayer = useCallback(async () => {
    if (!geojson || !mapReady || !leafletMapRef.current || breaks.length === 0) return;
    const L = await import('leaflet');

    if (geoLayerRef.current) {
      geoLayerRef.current.remove();
      geoLayerRef.current = null;
    }

    const minVpa = filters.minVpa;
    const maxVpa = filters.maxVpa;

    const filtered = geojson.features.filter((f) => {
      if (isSettingUp) return true;
      const { value_per_acre, action } = f.properties;
      if (!filters.showReview && action === 'review') return false;
      if (value_per_acre === null || value_per_acre < minVpa || value_per_acre > maxVpa) return false;
      return true;
    });

    const layer = L.geoJSON(
      { type: 'FeatureCollection', features: filtered } as GeoJSON.FeatureCollection,
      {
        interactive: !isDrawing,
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
          if (isSettingUp && !isDrawing) {
            lyr.bindTooltip(() => {
              const label = document.createElement('span');
              label.textContent = `${p.parcel_id} ${p.address || 'No address'} - Click to add or remove`;
              return label;
            });
            lyr.on('click', (event: L.LeafletMouseEvent) => {
              L.DomEvent.stopPropagation(event.originalEvent);
              toggleSetupParcel(feature as ParcelFeature);
            });
            return;
          }
          const anomalyBadge =
            p.anomaly_reason
              ? `<div class="mt-1 text-xs font-semibold text-orange-600">
                   ⚠ ${p.anomaly_reason.replace(/;/g, '<br>⚠ ')}
                 </div>`
              : '';
          const valuation = getFinishedAreaValuation(p);
          lyr.bindPopup(
            `<div class="text-sm leading-snug min-w-[220px]">
               <div class="font-semibold text-gray-900 mb-1">${p.parcel_id}</div>
               <div class="text-gray-700">${p.owner || '—'}</div>
               <div class="text-gray-500 mb-1">${p.address || '—'}</div>
               <table class="w-full text-xs border-t pt-1">
                 <tr><td class="text-gray-500 pr-2">Acres</td>
                     <td class="text-right font-medium">${formatAcres(p.acres)}</td></tr>
                 ${p.allocated_shared_acres
                   ? `<tr><td class="text-gray-500 pr-2">Shared acres</td>
                        <td class="text-right font-medium">+${formatAcres(p.allocated_shared_acres)}</td></tr>`
                   : ''}
                 <tr><td class="text-gray-500 pr-2">Tax Value</td>
                     <td class="text-right font-medium">${formatCurrency(p.tax_value)}</td></tr>
                 <tr><td class="text-gray-500 pr-2">Finished area (sq ft)</td>
                     <td class="text-right font-medium">${p.finished_area?.sq_ft == null
                       ? 'Not available'
                       : p.finished_area.sq_ft.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td></tr>
                 <tr><td class="text-gray-500 pr-2">Value per finished sq ft</td>
                     <td class="text-right font-medium">${valuation
                       ? formatCurrency(valuation.valuePerSqFt, 2) : 'Not available'}</td></tr>
                 <tr><td class="text-gray-500 pr-2 font-semibold">Value/Acre</td>
                     <td class="text-right font-bold text-pittsboro-green">${formatCurrency(p.value_per_acre)}</td></tr>
               </table>
               <div class="mt-2 text-xs text-gray-600">
                 ${geojson.metadata.finished_area ? `${geojson.metadata.finished_area.tax_year} County structures data. ` : ''}
                 ${p.finished_area?.status === 'partial'
                   ? 'Known subtotal; source coverage is incomplete.'
                   : p.finished_area?.status === 'reported'
                     ? 'Reported finished/living area, not building footprint.'
                     : 'No reported finished area; this is not a confirmed zero.'}
               </div>
               <div class="mt-1 text-xs text-gray-600">
                 ${valuation
                   ? 'Value per sq ft includes assessed land and buildings, not a sale price or construction cost.'
                   : 'Value per sq ft requires complete, positive finished area and a known assessed value.'}
               </div>
               ${p.assessment_rollup
                 ? `<div class="mt-2 text-xs text-gray-600">
                      ${p.assessment_rollup.accounts.length} condominium tax accounts,
                      ${p.assessment_rollup.tax_year} assessments; parent land counted once.
                    </div>`
                 : ''}
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
    if (!hasFitBoundsRef.current && layer.getBounds().isValid()) {
      leafletMapRef.current.fitBounds(layer.getBounds(), { padding: [20, 20] });
      hasFitBoundsRef.current = true;
    }
  }, [geojson, mapReady, breaks, filters, isDrawing, isSettingUp, toggleSetupParcel]);

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
          cursor: default;
          pointer-events: none;
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
          pointer-events: auto;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        input[type="range"]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #2d5a27;
          cursor: pointer;
          pointer-events: auto;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        @media (pointer: coarse) {
          input[type="range"]::-webkit-slider-thumb {
            width: 30px;
            height: 30px;
            border-width: 3px;
            box-shadow: 0 0 0 8px rgba(45, 90, 39, 0.18), 0 2px 6px rgba(0,0,0,0.25);
          }
          input[type="range"]::-moz-range-thumb {
            width: 30px;
            height: 30px;
            border-width: 3px;
            box-shadow: 0 0 0 8px rgba(45, 90, 39, 0.18), 0 2px 6px rgba(0,0,0,0.25);
          }
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
                    pointerEvents: 'none',
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
                <button
                  onClick={() => {
                    setRangePos({ min: 750, max: 1000 });
                    setFilters((f) => ({ ...f, minVpa: stats.q3, maxVpa: stats.max }));
                  }}
                  className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Top 25%
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

        <div className="mt-4 pt-4 border-t">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Neighborhoods</h2>
            <p className="mt-1 text-xs text-gray-500">
              Choose a curated parcel selection to zoom to its boundaries and view its value and tax analysis.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {resolvedNeighborhoods.map(({ preset, features, issues }, index) => (
                <button
                  key={`${preset.id}-${index}`}
                  type="button"
                  disabled={!mapReady || issues.length > 0}
                  aria-pressed={selectedNeighborhood?.id === preset.id}
                  onClick={() => selectNeighborhood(preset, features)}
                  className="rounded-lg border border-violet-300 px-3 py-2 text-sm font-medium text-violet-800 aria-pressed:bg-violet-100 enabled:hover:bg-violet-50 disabled:opacity-40"
                >
                  {preset.name}
                </button>
              ))}
              {NeighborhoodSetupPanel && (
                <button
                  type="button"
                  aria-pressed={isSettingUp}
                  disabled={!mapReady || isDrawing}
                  onClick={() => setIsSettingUp((current) => !current)}
                  className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 disabled:opacity-40"
                >
                  Neighborhood setup (local only)
                </button>
              )}
            </div>
            {resolvedNeighborhoods.filter(({ issues }) => issues.length > 0).map(({ preset, issues }, index) => (
              <div key={`${preset.id}-${index}`} role="alert" className="mt-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">{preset.name} is unavailable until its parcel definition is reviewed.</p>
                <ul className="list-disc pl-5">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isDrawing && !analysis && drawPoints.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  setAnalysis(null);
                  setIsDrawing(true);
                }}
                className="px-3 py-2 rounded-lg bg-violet-700 text-white text-sm font-medium hover:bg-violet-800 transition-colors"
              >
                Draw value analysis area
              </button>
            )}
            {isDrawing && (
              <>
                <button
                  type="button"
                  onClick={analyzeDrawnArea}
                  disabled={drawPoints.length < 3}
                  className="px-3 py-2 rounded-lg bg-violet-700 text-white text-sm font-medium enabled:hover:bg-violet-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Analyze polygon
                </button>
                <button
                  type="button"
                  onClick={() => updateDrawPoints(drawPointsRef.current.slice(0, -1))}
                  disabled={drawPoints.length === 0}
                  className="px-3 py-2 rounded-lg border text-sm font-medium text-gray-700 enabled:hover:bg-gray-50 disabled:opacity-40"
                >
                  Undo point
                </button>
                <button
                  type="button"
                  onClick={clearAnalysis}
                  className="px-3 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <span className="text-sm text-gray-500">
                  Click to add points; double-click the final point to close and analyze
                  (at least 3 points; {drawPoints.length} placed).
                </span>
              </>
            )}
            {!isDrawing && (analysis || drawPoints.length > 0) && (
              <button
                type="button"
                onClick={clearAnalysis}
                className="px-3 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear analysis
              </button>
            )}
          </div>

          {NeighborhoodSetupPanel && isSettingUp && geojson && (
            <NeighborhoodSetupPanel
              name={neighborhoodName}
              onNameChange={setNeighborhoodName}
              features={analysis?.features ?? []}
              parcels={geojson.features}
              generated={geojson.metadata.generated}
              selectedPreset={selectedNeighborhood}
              onSelect={selectNeighborhood}
              onStartNew={() => {
                clearAnalysis();
                setSelectionMethod('manual');
              }}
              onShowMap={() => mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              onRemove={removeSetupParcel}
              onExit={() => setIsSettingUp(false)}
            />
          )}

          {analysis && (
            <>
            <div className="mt-4">
              <h2 className="font-semibold text-gray-900">
                {isSettingUp ? neighborhoodName.trim() || 'Neighborhood setup selection' : selectedNeighborhood?.name || 'Custom area analysis'}
              </h2>
              {selectedNeighborhood && (
                <>
                  <p className="mt-1 text-sm text-gray-600">{selectedNeighborhood.description}</p>
                  <p className="mt-1 break-words text-xs text-gray-500">Selection source: {selectedNeighborhood.source}</p>
                </>
              )}
            </div>
            <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 rounded-lg border border-violet-200 bg-violet-50 p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
                  {selectionMethod === 'polygon' ? 'Fully encompassed parcels' : 'Selected parcels'}
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {analysis.parcels.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
                  Total acres
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {formatAcres(analysis.acres)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
                  Total assessed value
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(analysis.value)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
                  Value per acre
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(analysis.valuePerAcre)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
                  Share of Town parcel value
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {analysis.percent.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
                  Finished area (sq ft)
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {analysis.finishedArea.sqFt === null
                    ? 'Not available'
                    : analysis.finishedArea.sqFt.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-600">
                  {analysis.finishedArea.completeParcels < analysis.finishedArea.totalParcels && 'Known subtotal. '}
                  {analysis.finishedArea.knownParcels.toLocaleString()} of{' '}
                  {analysis.finishedArea.totalParcels.toLocaleString()} unique parcels have reported area.
                  {analysis.finishedArea.partialParcels > 0 &&
                    ` ${analysis.finishedArea.partialParcels.toLocaleString()} have only partial coverage.`}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
                  Value per finished sq ft
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {analysis.finishedAreaValuation.valuePerSqFt === null
                    ? 'Not available'
                    : formatCurrency(analysis.finishedAreaValuation.valuePerSqFt, 2)}
                </p>
                <p className="text-xs text-gray-600">
                  {analysis.finishedAreaValuation.parcels.toLocaleString()} of{' '}
                  {analysis.finishedArea.totalParcels.toLocaleString()} unique parcels qualify.
                  {analysis.finishedAreaValuation.parcels > 0
                    ? <> Uses {formatCurrency(analysis.finishedAreaValuation.assessedValue)} assessed value
                      {' '}&divide; {analysis.finishedAreaValuation.sqFt.toLocaleString('en-US', { maximumFractionDigits: 2 })} sq ft.</>
                    : ' Complete, positive finished area and a known assessed value are required.'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
                  Estimated annual Town tax
                </p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(townTax)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
                  Estimated annual County tax
                </p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(countyTax)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
                  Estimated annual combined tax
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(townTax + countyTax)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
                  Estimated annual Town tax / acre
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {analysis.acres > 0 ? formatCurrency(townTax / analysis.acres) : '—'}
                </p>
              </div>
              <p className="sm:col-span-2 lg:col-span-5 text-xs text-gray-600">
                {selectionMethod === 'polygon'
                  ? 'Only parcels whose complete geometry falls inside the polygon are counted. '
                  : 'This analysis uses an explicit list of selected parcels, not a boundary polygon. '}
                Counted parcels are shaded purple, including those hidden by the map filters;
                the drawn selection outline is removed.
                Percentage compares {formatCurrency(analysis.value)} with{' '}
                {formatCurrency(analysis.totalValue)} across the full Town parcel dataset.
              </p>
              <p className="sm:col-span-2 lg:col-span-5 text-xs text-gray-600">
                {fiscalYear} estimated annual property tax = selected assessed value &divide; 100
                &times; tax rate: Town ${townRate.toFixed(2)}, County ${countyRate.toFixed(2)} per
                $100. Combined tax includes both jurisdictions; only Town tax goes to Pittsboro.
                These are rate-based estimates, not actual bills or collections; parcel-specific
                exemptions, relief, special districts, fees, and collection losses are not modeled.
              </p>
              {analysis.features.map((feature) => {
                const rollup = feature.properties.assessment_rollup;
                if (!rollup) return null;
                return (
                  <p key={feature.properties.parcel_id} className="sm:col-span-2 lg:col-span-5 text-xs text-gray-600">
                    Parcel {feature.properties.parcel_id} includes {rollup.accounts.length} separately
                    assessed condominium accounts from tax year {rollup.tax_year}, verified {rollup.verified}.
                    Their assessed values are combined; the parent&apos;s land acreage is counted once.
                    The base GIS parent assessment is {formatCurrency(rollup.parent_tax_value)}.{' '}
                    <a href={rollup.source} target="_blank" rel="noopener noreferrer" className="underline">
                      View unit tax records
                    </a>.
                  </p>
                );
              })}
              <p className="sm:col-span-2 lg:col-span-5 text-xs text-gray-600">
                {geojson?.metadata.finished_area ? <>
                  Finished area comes from{' '}
                  <a href={geojson.metadata.finished_area.source} target="_blank" rel="noopener noreferrer" className="underline">
                    County DEVNET Structures
                  </a>, tax year {geojson.metadata.finished_area.tax_year}, downloaded {geojson.metadata.finished_area.retrieved}.
                  {' '}The <code>gross_living_area</code> field matches tax-record Total Finished Area.
                  This is reported finished/living floor area, not land area or building footprint;
                  garages, porches, unfinished spaces, and outbuildings may not be represented.
                  Missing records are unknown, not zero or proof of vacant land, and are excluded
                  from the known subtotal. This snapshot may lag newer development.
                  Condominium unit areas are counted once on their mapped parent.
                  {' '}Value per finished sq ft divides the combined assessed value of qualifying
                  parcels (land and buildings) by their combined finished area, not an average of
                  parcel ratios. Missing, partial, and zero-area records are excluded from both
                  sides of that calculation. It is not a sale price or construction cost.
                </> : 'No finished-area source snapshot is attached to these map data.'}
              </p>
            </div>
            </>
          )}
        </div>
      </div>

      {/* ── Map + Legend layout ─────────────────────────────────────────── */}
      <div className="relative">
        {/* Leaflet map container */}
        <div ref={mapRef} style={{ height: '720px' }} className="rounded-xl border overflow-hidden z-0" />

        {isSettingUp && (
          <div className="absolute top-3 right-3 z-[400] max-w-[70%] rounded-lg border border-amber-300 bg-white/95 p-3 text-sm shadow">
            <p className="font-medium">{neighborhoodName.trim() || 'Neighborhood setup'}</p>
            <p>{(analysis?.parcels ?? 0).toLocaleString()} parcels selected. Click parcels to add or remove.</p>
            <a href="#neighborhood-setup-heading" className="mt-1 inline-block font-medium text-violet-800 underline">
              Back to setup and export
            </a>
          </div>
        )}

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
            {analysis && (
              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t">
                <span
                  className="inline-block w-4 h-4 rounded-sm border border-violet-700 flex-shrink-0 bg-violet-500"
                />
                <span className="text-gray-700 whitespace-nowrap">Parcels counted in analysis</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
