const fs = require('node:fs');
const path = require('node:path');

const SOURCE = 'https://gisservices.chathamcountync.gov/opendataagol/rest/services/Cadastral/Chatham_PropertyImprovements/MapServer/0';
const TAX_YEAR = 2026;
const FIELDS = 'OBJECTID,parcel_Number,parcel_Year,property_use,building_id,structure_name,gross_living_area,source';

function accountIds(data) {
  return [...new Set(data.features.flatMap(({ properties: p }) =>
    [p.parcel_id, ...(p.assessment_rollup?.accounts.map((account) => account.parcel_id) ?? [])],
  ))].sort();
}

function applyFinishedArea(data, snapshot) {
  const fail = (message) => { throw new Error(`Finished-area snapshot: ${message}`); };
  const expectedIds = accountIds(data);
  if (snapshot.base_map_generated !== data.metadata.generated ||
      JSON.stringify(snapshot.queried_accounts) !== JSON.stringify(expectedIds)) {
    fail('map dates or tax accounts changed; run npm run refresh:finished-area and review coverage.');
  }
  if (snapshot.source !== SOURCE || snapshot.field !== 'gross_living_area' ||
      !Number.isInteger(snapshot.tax_year) || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.retrieved) ||
      !Array.isArray(snapshot.records)) {
    fail('invalid source, field, year, retrieval date, or records.');
  }
  const scope = new Set(expectedIds);
  const objects = new Set();
  const buildings = new Set();
  const byAccount = new Map();
  for (const row of snapshot.records) {
    // Building IDs are reused across property classes on mixed-use parcels.
    const key = `${row.parcel_Number}:${row.property_use}:${row.building_id}`;
    if (!scope.has(row.parcel_Number) || row.parcel_Year !== snapshot.tax_year || row.source !== 'RE' ||
        !Number.isInteger(row.OBJECTID) || row.OBJECTID <= 0 || objects.has(row.OBJECTID) ||
        typeof row.property_use !== 'string' || !row.property_use.trim() ||
        !Number.isInteger(row.building_id) || row.building_id < 0 || buildings.has(key) ||
        (row.gross_living_area !== null &&
          (!Number.isFinite(row.gross_living_area) || row.gross_living_area < 0))) {
      fail(`invalid, duplicate, or wrong-year structure record ${row.OBJECTID} (${key}).`);
    }
    objects.add(row.OBJECTID);
    buildings.add(key);
    const rows = byAccount.get(row.parcel_Number) ?? [];
    rows.push(row);
    byAccount.set(row.parcel_Number, rows);
  }
  const unitOwners = new Map();
  for (const { properties: p } of data.features) {
    if (!p.assessment_rollup) continue;
    const units = p.assessment_rollup.accounts.map((account) => account.parcel_id);
    if (!units.length || new Set(units).size !== units.length ||
        units.some((id) => !id.startsWith(`${p.parcel_id}-`))) {
      fail(`invalid or duplicate condominium accounts for ${p.parcel_id}.`);
    }
    if (p.assessment_rollup.tax_year !== snapshot.tax_year) {
      fail(`condominium accounts for ${p.parcel_id} need verification for the structures tax year.`);
    }
    for (const account of p.assessment_rollup.accounts) {
      if (data.features.some((feature) => feature.properties.parcel_id === account.parcel_id) ||
          (unitOwners.has(account.parcel_id) && unitOwners.get(account.parcel_id) !== p.parcel_id)) {
        fail(`unit ${account.parcel_id} would be counted on multiple mapped parcels.`);
      }
      unitOwners.set(account.parcel_id, p.parcel_id);
    }
    if ((byAccount.get(p.parcel_id) ?? []).some((row) => row.gross_living_area > 0)) {
      fail(`parent ${p.parcel_id} and its units both report area; review possible double-counting.`);
    }
  }
  const features = data.features.map((feature) => {
    const p = feature.properties;
    const ids = p.assessment_rollup
      ? p.assessment_rollup.accounts.map((account) => account.parcel_id)
      : [p.parcel_id];
    let matchedAccounts = 0;
    let knownRows = 0;
    let missingRows = 0;
    let sqFt = 0;
    for (const id of ids) {
      const rows = byAccount.get(id) ?? [];
      if (rows.length) matchedAccounts++;
      for (const row of rows) {
        if (row.gross_living_area === null) missingRows++;
        else {
          knownRows++;
          sqFt += row.gross_living_area;
        }
      }
    }
    if (!Number.isFinite(sqFt)) fail(`area overflow for ${p.parcel_id}.`);
    return {
      ...feature,
      properties: {
        ...p,
        finished_area: {
          sq_ft: knownRows ? sqFt : null,
          status: !knownRows ? 'unavailable'
            : matchedAccounts < ids.length || missingRows > 0 ? 'partial' : 'reported',
          structures: knownRows + missingRows,
          accounts: ids.length,
          matched_accounts: matchedAccounts,
          missing_area_records: missingRows,
        },
      },
    };
  });
  return {
    ...data,
    features,
    metadata: {
      ...data.metadata,
      finished_area: {
        source: snapshot.source,
        field: snapshot.field,
        tax_year: snapshot.tax_year,
        retrieved: snapshot.retrieved,
      },
    },
  };
}

async function refreshFinishedArea(data, request = fetch) {
  const ids = accountIds(data);
  if (ids.some((id) => !/^\d{7}(?:-[A-Z0-9]+)?$/.test(id))) {
    throw new Error('Finished-area refresh: invalid tax account ID in map.');
  }
  const query = async (parameters) => {
    const url = `${SOURCE}/query?${new URLSearchParams({ f: 'json', ...parameters })}`;
    const response = await request(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Finished-area source returned HTTP ${response.status}.`);
    const body = await response.json();
    if (body.error) throw new Error(`Finished-area source: ${JSON.stringify(body.error)}`);
    return body;
  };
  const records = [];
  for (let start = 0; start < ids.length; start += 150) {
    const chunk = ids.slice(start, start + 150);
    const where = `parcel_Year=${TAX_YEAR} AND source='RE' AND parcel_Number IN (${chunk.map((id) => `'${id}'`).join(',')})`;
    const { count } = await query({ where, returnCountOnly: 'true' });
    if (!Number.isInteger(count) || count < 0) throw new Error('Finished-area source returned an invalid record count.');
    let offset = 0;
    while (offset < count) {
      const page = await query({
        where, outFields: FIELDS, returnGeometry: 'false',
        orderByFields: 'OBJECTID', resultOffset: String(offset), resultRecordCount: '2000',
      });
      if (!Array.isArray(page.features) || !page.features.length) {
        throw new Error('Finished-area source returned an incomplete page; no snapshot was saved.');
      }
      records.push(...page.features.map((feature) => feature.attributes));
      offset += page.features.length;
      if (offset > count || (offset < count && !page.exceededTransferLimit)) {
        throw new Error('Finished-area source changed or truncated its results; no snapshot was saved.');
      }
    }
    console.log(`Finished-area records: queried ${Math.min(start + 150, ids.length)}/${ids.length} tax accounts.`);
  }
  const snapshot = {
    base_map_generated: data.metadata.generated,
    source: SOURCE,
    field: 'gross_living_area',
    tax_year: TAX_YEAR,
    retrieved: new Date().toISOString().slice(0, 10),
    queried_accounts: ids,
    records,
  };
  applyFinishedArea(data, snapshot);
  return snapshot;
}

if (require.main === module) {
  (async () => {
    const directory = path.join(__dirname, '..', 'public', 'data');
    const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
    const data = read('value_per_acre.geojson');
    const refreshing = process.argv.includes('--refresh');
    const snapshot = refreshing
      ? await refreshFinishedArea(data)
      : read('parcel_improvements.json');
    const enriched = applyFinishedArea(data, snapshot);
    for (const [name, value] of [
      ...(refreshing ? [['parcel_improvements.json', snapshot]] : []),
      ['value_per_acre.geojson', enriched],
    ]) {
      const target = path.join(directory, name);
      const output = JSON.stringify(value) + '\n';
      if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) fs.writeFileSync(target, output);
    }
    const unique = new Map(enriched.features.map((feature) => [feature.properties.parcel_id, feature.properties.finished_area]));
    const complete = [...unique.values()].filter((area) => area.status === 'reported').length;
    console.log(`Verified finished-area data: ${complete}/${unique.size} unique mapped parcels have complete reported area.`);
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { applyFinishedArea, refreshFinishedArea };
