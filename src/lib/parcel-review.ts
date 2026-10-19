import type { ParcelProperties, ValuePerAcreGeoJSON } from '@/types/budget';

export function parcelReviewAction(parcel: Pick<ParcelProperties,
  'action' | 'anomaly_reason' | 'allocated_shared_acres' | 'shared_land_parcels'>) {
  const reasons = parcel.anomaly_reason.split(';').map((reason) => reason.trim()).filter(Boolean);
  return parcel.action === 'review' && reasons.length > 0 &&
    reasons.every((reason) => reason === 'shared_land_allocated') &&
    (parcel.allocated_shared_acres ?? 0) > 0 && (parcel.shared_land_parcels?.length ?? 0) > 0
    ? 'include' : parcel.action;
}

export function normalizeMapReviews(data: ValuePerAcreGeoJSON): ValuePerAcreGeoJSON {
  const features = data.features.map((feature) => ({
    ...feature,
    properties: { ...feature.properties, action: parcelReviewAction(feature.properties) },
  }));
  return {
    ...data,
    features,
    metadata: {
      ...data.metadata,
      included: features.filter((feature) => feature.properties.action === 'include').length,
      review: features.filter((feature) => feature.properties.action === 'review').length,
    },
  };
}
