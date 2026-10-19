const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { applyFinishedArea, refreshFinishedArea } = require('../scripts/parcel-finished-area.cjs');

const source = 'https://gisservices.chathamcountync.gov/opendataagol/rest/services/Cadastral/Chatham_PropertyImprovements/MapServer/0';
const feature = (id) => ({
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
  properties: { parcel_id: id, tax_value: 100000, acres: 1 },
});
const data = (features = [feature('0000001')]) => ({
  type: 'FeatureCollection', features,
  metadata: { generated: '2026-10-12', total_tax_value: 100000 },
});
const row = (objectId, area, id = '0000001', buildingId = objectId) => ({
  OBJECTID: objectId, parcel_Number: id, parcel_Year: 2026, property_use: 'RES',
  building_id: buildingId, structure_name: 'Residence', gross_living_area: area, source: 'RE',
});
const snapshot = (records, queried_accounts = ['0000001']) => ({
  base_map_generated: '2026-10-12', source, field: 'gross_living_area', tax_year: 2026,
  retrieved: '2026-10-18', queried_accounts, records,
});
const area = (result, index = 0) => result.features[index].properties.finished_area;
const condo = () => {
  const parent = feature('0094073');
  parent.properties.assessment_rollup = {
    tax_year: 2026,
    accounts: [{ parcel_id: '0094073-100' }, { parcel_id: '0094073-200' }],
  };
  return data([parent]);
};
const condoSnapshot = () => snapshot([
  row(1, 0, '0094073'), row(2, 1000, '0094073-100'), row(3, 2000, '0094073-200'),
], ['0094073', '0094073-100', '0094073-200']);

test('finished area sums structures without adding garages or outbuilding area substitutes', () => {
  const original = data();
  const before = structuredClone(original);
  const records = snapshot([row(1, 2393), row(2, 0)]);
  const result = applyFinishedArea(original, records);
  assert.deepEqual(original, before);
  assert.deepEqual(area(result), {
    sq_ft: 2393, status: 'reported', structures: 2,
    accounts: 1, matched_accounts: 1, missing_area_records: 0,
  });
  const { finished_area, ...properties } = result.features[0].properties;
  assert.deepEqual(properties, original.features[0].properties);
  assert.deepEqual(result.features[0].geometry, original.features[0].geometry);
  assert.equal(result.metadata.total_tax_value, original.metadata.total_tax_value);
  assert.deepEqual(applyFinishedArea(result, records), result);
});

test('missing records, null area, partial records, and explicit zero remain distinct', () => {
  assert.equal(area(applyFinishedArea(data(), snapshot([]))).sq_ft, null);
  assert.equal(area(applyFinishedArea(data(), snapshot([row(1, null)]))).status, 'unavailable');
  const partial = area(applyFinishedArea(data(), snapshot([row(1, 1200.25), row(2, null)])));
  assert.equal(partial.status, 'partial');
  assert.equal(partial.sq_ft, 1200.25);
  assert.equal(partial.missing_area_records, 1);
  const zero = area(applyFinishedArea(data(), snapshot([row(1, 0)])));
  assert.equal(zero.sq_ft, 0);
  assert.equal(zero.status, 'reported');
});

test('mixed-use property classes may reuse building IDs but duplicate source buildings cannot', () => {
  const residential = row(1, 1200, '0000001', 1);
  const commercial = { ...row(2, 500, '0000001', 1), property_use: 'COM' };
  assert.equal(area(applyFinishedArea(data(), snapshot([residential, commercial]))).sq_ft, 1700);
  assert.throws(() => applyFinishedArea(data(), snapshot([residential, { ...commercial, property_use: 'RES' }])), /duplicate/);
  assert.throws(() => applyFinishedArea(data(), snapshot([residential, { ...commercial, OBJECTID: 1 }])), /duplicate/);
});

test('condominium area comes from units once, with missing unit coverage disclosed', () => {
  const original = condo();
  const records = condoSnapshot();
  const result = area(applyFinishedArea(original, records));
  assert.equal(result.sq_ft, 3000);
  assert.equal(result.structures, 2);
  assert.equal(result.accounts, 2);
  assert.equal(result.matched_accounts, 2);
  const partial = area(applyFinishedArea(original, { ...records, records: records.records.slice(0, 2) }));
  assert.equal(partial.sq_ft, 1000);
  assert.equal(partial.status, 'partial');
  assert.equal(partial.matched_accounts, 1);
  const missing = area(applyFinishedArea(original, { ...records, records: records.records.slice(0, 1) }));
  assert.equal(missing.sq_ft, null);
  assert.equal(missing.status, 'unavailable');
});

test('ambiguous parent/unit area and duplicated condominium accounts fail explicitly', () => {
  const records = condoSnapshot();
  records.records[0].gross_living_area = 3000;
  assert.throws(() => applyFinishedArea(condo(), records), /possible double-counting/);
  const original = condo();
  original.features[0].properties.assessment_rollup.accounts.push({ parcel_id: '0094073-100' });
  assert.throws(() => applyFinishedArea(original, condoSnapshot()), /duplicate condominium accounts/);
  const mappedUnit = condo();
  mappedUnit.features.push(feature('0094073-100'));
  assert.throws(() => applyFinishedArea(mappedUnit, condoSnapshot()), /multiple mapped parcels/);
});

test('changed map scope, vintage, invalid source values and wrong-year records require review', () => {
  for (const change of [
    { base_map_generated: '2027-01-01' }, { queried_accounts: [] },
    { source: 'https://example.com' }, { field: 'primary_area' }, { retrieved: '' },
  ]) {
    assert.throws(() => applyFinishedArea(data(), { ...snapshot([]), ...change }), /Finished-area snapshot/);
  }
  for (const change of [
    { gross_living_area: -1 }, { gross_living_area: NaN }, { gross_living_area: undefined },
    { parcel_Year: 2027 }, { source: 'PP' }, { parcel_Number: '0000002' },
  ]) {
    assert.throws(() => applyFinishedArea(data(), snapshot([{ ...row(1, 1000), ...change }])), /invalid/);
  }
  const original = condo();
  original.features[0].properties.assessment_rollup.tax_year = 2025;
  assert.throws(() => applyFinishedArea(original, condoSnapshot()), /verification/);
});

test('refresh follows transfer-limit pagination and requests the exact tax year and account scope', async () => {
  let calls = 0;
  const result = await refreshFinishedArea(data(), async (url) => {
    const parameters = new URL(url).searchParams;
    assert.match(parameters.get('where'), /parcel_Year=2026 AND source='RE'/);
    assert.match(parameters.get('where'), /'0000001'/);
    calls++;
    const body = parameters.has('returnCountOnly') ? { count: 3 }
      : parameters.get('resultOffset') === '0'
        ? { features: [row(1, 1000), row(2, 0)].map((attributes) => ({ attributes })), exceededTransferLimit: true }
        : { features: [{ attributes: row(3, 300) }], exceededTransferLimit: false };
    return { ok: true, json: async () => body };
  });
  assert.equal(calls, 3);
  assert.equal(result.records.length, 3);
  assert.equal(area(applyFinishedArea(data(), result)).sq_ft, 1300);
});

test('HTTP/GIS errors, empty/truncated pages and invalid account IDs do not yield success', async () => {
  await assert.rejects(refreshFinishedArea(data(), async () => ({ ok: false, status: 503 })), /HTTP 503/);
  await assert.rejects(refreshFinishedArea(data(), async () => ({
    ok: true, json: async () => ({ error: { message: 'Query failed' } }),
  })), /Query failed/);
  for (const features of [[], [{ attributes: row(1, 1000) }]]) {
    await assert.rejects(refreshFinishedArea(data(), async (url) => ({
      ok: true,
      json: async () => new URL(url).searchParams.has('returnCountOnly')
        ? { count: 2 } : { features, exceededTransferLimit: false },
    })), /incomplete|truncated/);
  }
  await assert.rejects(refreshFinishedArea(data([feature("0000001'")])), /invalid tax account/);
});

test('checked-in source reproduces the map and verified residential, commercial and condo examples', () => {
  const directory = path.join(__dirname, '..', 'public', 'data');
  const current = JSON.parse(fs.readFileSync(path.join(directory, 'value_per_acre.geojson'), 'utf8'));
  const records = JSON.parse(fs.readFileSync(path.join(directory, 'parcel_improvements.json'), 'utf8'));
  assert.deepEqual(applyFinishedArea(current, records), current);
  for (const [id, sqFt] of [['0094927', 2393], ['0007880', 6140], ['0094073', 50270]]) {
    const found = current.features.find((item) => item.properties.parcel_id === id);
    assert.equal(found.properties.finished_area.sq_ft, sqFt);
    assert.equal(found.properties.finished_area.status, 'reported');
  }
  assert.equal(records.records.length, 3985);
  const unique = new Map(current.features.map((item) => [item.properties.parcel_id, item.properties.finished_area]));
  assert.equal(unique.size, 3690);
  assert.equal([...unique.values()].filter((item) => item.status === 'reported').length, 2845);
  assert.equal([...unique.values()].filter((item) => item.sq_ft === 0).length, 109);
});
