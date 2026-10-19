import type { ParcelFeature, ParcelProperties, ValuePerAcreGeoJSON } from '@/types/budget';

export function getFinishedAreaValuation(properties: ParcelProperties) {
  const area = properties.finished_area;
  const value = properties.tax_value;
  if (!area || area.status !== 'reported' || area.sq_ft === null ||
      !Number.isFinite(area.sq_ft) || area.sq_ft <= 0 ||
      value === null || !Number.isFinite(value) || value < 0) return null;
  return { assessedValue: value, sqFt: area.sq_ft, valuePerSqFt: value / area.sq_ft };
}

export function summarizeParcels(features: ParcelFeature[], data: ValuePerAcreGeoJSON) {
  const metadataTotal = data.metadata.total_tax_value;
  const totalValue =
    typeof metadataTotal === 'number' && Number.isFinite(metadataTotal) && metadataTotal > 0
      ? metadataTotal
      : data.features.reduce((sum, feature) => sum + (feature.properties.tax_value ?? 0), 0);
  const value = features.reduce((sum, feature) => sum + (feature.properties.tax_value ?? 0), 0);
  const acres = features.reduce((sum, feature) => sum + (feature.properties.acres ?? 0), 0);
  const uniqueParcels = [...new Map(features.map((feature) => [feature.properties.parcel_id, feature])).values()];
  const knownAreas = uniqueParcels.flatMap((feature) => {
    const area = feature.properties.finished_area;
    return area?.sq_ft != null ? [area] : [];
  });
  const valuations = uniqueParcels.flatMap((feature) => {
    const valuation = getFinishedAreaValuation(feature.properties);
    return valuation ? [valuation] : [];
  });
  const valuedSqFt = valuations.reduce((sum, item) => sum + item.sqFt, 0);
  const assessedValue = valuations.reduce((sum, item) => sum + item.assessedValue, 0);

  return {
    parcels: features.length,
    features,
    acres,
    value,
    valuePerAcre: acres > 0 ? value / acres : 0,
    totalValue,
    percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
    finishedAreaValuation: {
      valuePerSqFt: valuedSqFt > 0 ? assessedValue / valuedSqFt : null,
      assessedValue,
      sqFt: valuedSqFt,
      parcels: valuations.length,
    },
    finishedArea: {
      sqFt: knownAreas.length ? knownAreas.reduce((sum, area) => sum + (area.sq_ft ?? 0), 0) : null,
      knownParcels: knownAreas.length,
      completeParcels: knownAreas.filter((area) => area.status === 'reported').length,
      partialParcels: knownAreas.filter((area) => area.status === 'partial').length,
      totalParcels: uniqueParcels.length,
    },
  };
}
