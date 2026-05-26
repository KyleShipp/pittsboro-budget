const BASE_URL =
  'https://gisservices.chathamcountync.gov/opendataagol/rest/services/Cadastral/Chatham_CamaParcels/MapServer/0';

const FIELDS = [
  'parcel_number',
  'physical_street_address',
  'current_owners',
  'jan1_total_ASV',
  'jan1_land_ASV',
  'jan1_bldg_ASV',
  'tax_district_desc',
  'community_name',
  'land_use',
].join(',');

export interface ParcelResult {
  parcelNumber: string;
  address: string;
  owner: string;
  assessedValue: number;
  landValue: number;
  buildingValue: number;
  taxDistrict: string;
  community: string;
  landUse: string;
  inPittsboro: boolean;
}

interface ArcGISFeature {
  attributes: Record<string, string | number | null>;
}

interface ArcGISResponse {
  features: ArcGISFeature[];
  error?: { message: string };
}

function toParcel(f: ArcGISFeature): ParcelResult {
  const a = f.attributes;
  const district = String(a.tax_district_desc ?? '').toUpperCase();
  return {
    parcelNumber: String(a.parcel_number ?? ''),
    address: String(a.physical_street_address ?? ''),
    owner: String(a.current_owners ?? ''),
    assessedValue: Number(a.jan1_total_ASV ?? 0),
    landValue: Number(a.jan1_land_ASV ?? 0),
    buildingValue: Number(a.jan1_bldg_ASV ?? 0),
    taxDistrict: String(a.tax_district_desc ?? ''),
    community: String(a.community_name ?? ''),
    landUse: String(a.land_use ?? ''),
    inPittsboro: district.includes('PITTSBORO'),
  };
}

export async function searchParcels(address: string): Promise<ParcelResult[]> {
  // Strip city/state/zip — keep only the street portion (before first comma)
  let street = address.split(',')[0].trim();
  street = street
    .replace(/'/g, "''")
    .toUpperCase()
    .replace(/[.#\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!street) return [];

  // Normalize directional words to their abbreviations (GIS uses abbreviated forms)
  const directionMap: Record<string, string> = {
    NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W',
    NORTHEAST: 'NE', NORTHWEST: 'NW', SOUTHEAST: 'SE', SOUTHWEST: 'SW',
  };
  // Normalize street type words to abbreviations
  const suffixMap: Record<string, string> = {
    STREET: 'ST', AVENUE: 'AVE', ROAD: 'RD', DRIVE: 'DR',
    BOULEVARD: 'BLVD', LANE: 'LN', COURT: 'CT', CIRCLE: 'CIR',
    PLACE: 'PL', TERRACE: 'TER', TRAIL: 'TRL', WAY: 'WAY',
    HIGHWAY: 'HWY', PARKWAY: 'PKWY',
  };

  const words = street.split(' ');
  const normalized = words.map((w) => directionMap[w] ?? suffixMap[w] ?? w);
  const normalizedStreet = normalized.join(' ');

  // Build a flexible LIKE pattern: replace spaces with % wildcards
  const pattern = normalizedStreet.replace(/\s+/g, '%');

  // If the user typed the full word and we abbreviated it, also try the original
  // as a fallback in case the GIS data uses the full word
  const origPattern = street.replace(/\s+/g, '%');
  const where =
    normalizedStreet !== street
      ? `(UPPER(physical_street_address) LIKE '%${pattern}%' OR UPPER(physical_street_address) LIKE '%${origPattern}%')`
      : `UPPER(physical_street_address) LIKE '%${pattern}%'`;

  const body = new URLSearchParams({
    where,
    outFields: FIELDS,
    returnGeometry: 'false',
    f: 'json',
    resultRecordCount: '20',
  }).toString();

  const res = await fetch(`${BASE_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) throw new Error(`GIS query failed: ${res.status}`);

  const data: ArcGISResponse = await res.json();
  if (data.error) throw new Error(data.error.message);

  return data.features.map(toParcel);
}
