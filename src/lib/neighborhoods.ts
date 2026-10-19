import type { NeighborhoodPreset, ParcelFeature } from '@/types/budget';

export function resolveNeighborhood(preset: NeighborhoodPreset, parcels: ParcelFeature[]) {
  const issues: string[] = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(preset.id)) issues.push('Use a lowercase, hyphenated neighborhood ID.');
  if (!preset.name.trim()) issues.push('Enter a neighborhood name.');
  if (!preset.description.trim() || !preset.source.trim()) issues.push('Provide a description and selection source.');
  if (preset.parcelIds.length === 0) issues.push('Select at least one parcel.');

  const byId = new Map<string, ParcelFeature[]>();
  for (const parcel of parcels) {
    const id = parcel.properties.parcel_id;
    const matches = byId.get(id);
    if (matches) matches.push(parcel);
    else byId.set(id, [parcel]);
  }

  const seen = new Set<string>();
  const features: ParcelFeature[] = [];
  for (const id of preset.parcelIds) {
    if (!/^\d{7}$/.test(id)) {
      issues.push(`Invalid parcel ID "${id}": use seven digits, including leading zeros.`);
    } else if (seen.has(id)) {
      issues.push(`Duplicate parcel ID: ${id}.`);
    } else {
      const matches = byId.get(id);
      if (!matches) issues.push(`Parcel ${id} is missing from the map dataset; review for a split, combination, or exclusion.`);
      else if (matches.length !== 1) issues.push(`Parcel ${id} has multiple map records; resolve the ambiguity before publishing.`);
      else features.push(matches[0]);
    }
    seen.add(id);
  }

  // Invalid presets must never produce a success-shaped partial neighborhood.
  return { features: issues.length ? [] : features, issues: [...new Set(issues)] };
}

export function createNeighborhoodDefinition(
  name: string,
  features: ParcelFeature[],
  generated: string,
): NeighborhoodPreset {
  const trimmed = name.trim();
  return {
    id: trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name: trimmed,
    description: `Curated parcel selection for ${trimmed}.`,
    source: `Maintainer selection from the parcel map generated ${generated}.`,
    parcelIds: [...new Set(features.map((feature) => feature.properties.parcel_id))].sort(),
  };
}
