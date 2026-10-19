const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
function loadLibrary(name) {
  const source = fs.readFileSync(path.join(root, 'src', 'lib', `${name}.ts`), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  const context = { exports: {} };
  vm.runInNewContext(outputText, context);
  return context.exports;
}

const { resolveNeighborhood, createNeighborhoodDefinition } = loadLibrary('neighborhoods');
const { getFinishedAreaValuation, summarizeParcels } = loadLibrary('parcel-analysis');
const { normalizeMapReviews, parcelReviewAction } = loadLibrary('parcel-review');
const readData = (name) => JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', name), 'utf8'));
const plain = (value) => JSON.parse(JSON.stringify(value));
function parcel(id, value = 100000, acres = 1) {
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
    properties: { parcel_id: id, tax_value: value, acres },
  };
}
const definition = (parcelIds) => ({
  id: 'test-place',
  name: 'Test Place',
  description: 'Test membership.',
  source: 'Maintainer selection.',
  parcelIds,
});

test('explicit membership selects only listed parcels and preserves leading zeros', () => {
  const a = parcel('0000001');
  const b = parcel('0000002');
  const result = resolveNeighborhood(definition(['0000002']), [a, b]);
  assert.equal(result.issues.length, 0);
  assert.equal(result.features.length, 1);
  assert.equal(result.features[0], b);
});

test('shared-space allocation alone is informational; genuine review reasons are preserved', () => {
  const item = {
    ...parcel('0000001').properties, action: 'review', anomaly_reason: 'shared_land_allocated',
    allocated_shared_acres: 0.1, shared_land_parcels: ['0000002'],
  };
  assert.equal(parcelReviewAction(item), 'include');
  assert.equal(parcelReviewAction({ ...item, anomaly_reason: 'shared_land_allocated;extreme_high_vpa' }), 'review');
  assert.equal(parcelReviewAction({ ...item, action: 'exclude' }), 'exclude');
  assert.equal(parcelReviewAction({ ...item, shared_land_parcels: [] }), 'review');
  assert.equal(parcelReviewAction({ ...item, allocated_shared_acres: 0 }), 'review');
  assert.equal(parcelReviewAction({ ...item, anomaly_reason: 'condo_assessment_rollup' }), 'review');
});

test('map presentation reclassifies all 32 documented shared allocations without changing values or source data', () => {
  const data = readData('value_per_acre.geojson');
  const before = structuredClone(data);
  const normalized = normalizeMapReviews(data);
  assert.deepEqual(data, before);
  assert.equal(normalized.metadata.review, data.metadata.review - 32);
  assert.equal(normalized.metadata.included, data.metadata.included + 32);
  assert.equal(normalized.metadata.total_tax_value, data.metadata.total_tax_value);
  const cottage = normalized.features.find((feature) => feature.properties.parcel_id === '0094042');
  assert.equal(cottage.properties.action, 'include');
  for (let i = 0; i < data.features.length; i++) {
    const { action, ...properties } = plain(normalized.features[i].properties);
    const { action: previous, ...originalProperties } = data.features[i].properties;
    assert.deepEqual(properties, originalProperties);
    assert.deepEqual(plain(normalized.features[i].geometry), data.features[i].geometry);
  }
});

test('missing IDs block the entire preset instead of returning partial totals', () => {
  const result = resolveNeighborhood(definition(['0000001', '0000002']), [parcel('0000001')]);
  assert.equal(result.features.length, 0);
  assert.match(result.issues.join(' '), /0000002 is missing/);
});

test('duplicate preset IDs and ambiguous map IDs are explicit errors', () => {
  const a = parcel('0000001');
  const duplicate = resolveNeighborhood(definition(['0000001', '0000001']), [a]);
  assert.match(duplicate.issues.join(' '), /Duplicate parcel ID/);
  assert.equal(duplicate.features.length, 0);
  const ambiguous = resolveNeighborhood(definition(['0000001']), [a, a]);
  assert.match(ambiguous.issues.join(' '), /multiple map records/);
  assert.equal(ambiguous.features.length, 0);
});

test('empty selections and malformed IDs cannot be published', () => {
  assert.match(resolveNeighborhood(definition([]), []).issues.join(' '), /at least one parcel/);
  assert.match(resolveNeighborhood(definition(['1']), []).issues.join(' '), /seven digits/);
  const invalid = { ...definition(['0000001']), id: '', name: '', source: '' };
  assert.equal(resolveNeighborhood(invalid, [parcel('0000001')]).features.length, 0);
});

test('export produces a reusable, sorted definition with unique string IDs', () => {
  const exported = createNeighborhoodDefinition(
    '  Powell Place  ',
    [parcel('0000002'), parcel('0000001'), parcel('0000002')],
    '2026-10-12',
  );
  assert.equal(exported.id, 'powell-place');
  assert.equal(exported.name, 'Powell Place');
  assert.deepEqual(plain(exported.parcelIds), ['0000001', '0000002']);
  assert.match(exported.source, /2026-10-12/);
  assert.equal(resolveNeighborhood(exported, [parcel('0000001'), parcel('0000002')]).issues.length, 0);
});

test('all selection paths use the same assessed value, acreage and Town-share calculation', () => {
  const a = parcel('0000001', 100000, 2);
  const b = parcel('0000002', 300000, 3);
  const data = { features: [a, b], metadata: { total_tax_value: 1000000 } };
  const resolved = resolveNeighborhood(definition(['0000001']), data.features);
  const analysis = summarizeParcels(resolved.features, data);
  assert.equal(analysis.parcels, 1);
  assert.equal(analysis.value, 100000);
  assert.equal(analysis.acres, 2);
  assert.equal(analysis.valuePerAcre, 50000);
  assert.equal(analysis.percent, 10);
  assert.equal(summarizeParcels([a], { ...data, metadata: {} }).totalValue, 400000);
});

test('empty and missing-value selections remain finite and zero-valued', () => {
  const data = { features: [], metadata: {} };
  const empty = summarizeParcels([], data);
  for (const key of ['parcels', 'acres', 'value', 'valuePerAcre', 'totalValue', 'percent']) {
    assert.equal(empty[key], 0);
  }
  const unknown = parcel('0000001', null, null);
  assert.equal(summarizeParcels([unknown], { features: [unknown], metadata: {} }).valuePerAcre, 0);
});

test('finished-area totals preserve unknowns and reported zeros and count each parcel ID only once', () => {
  const home = parcel('0000001');
  home.properties.finished_area = { sq_ft: 2393, status: 'reported' };
  const missing = parcel('0000002');
  const zero = parcel('0000003');
  zero.properties.finished_area = { sq_ft: 0, status: 'reported' };
  const partial = parcel('0000004');
  partial.properties.finished_area = { sq_ft: 500.25, status: 'partial' };
  const features = [home, home, missing, zero, partial];
  const result = summarizeParcels(features, { features, metadata: {} });
  assert.deepEqual(plain(result.finishedArea), {
    sqFt: 2893.25, knownParcels: 3, completeParcels: 2, partialParcels: 1, totalParcels: 4,
  });
  assert.equal(summarizeParcels([missing], { features, metadata: {} }).finishedArea.sqFt, null);
  assert.equal(summarizeParcels([zero], { features, metadata: {} }).finishedArea.sqFt, 0);
  assert.equal(summarizeParcels([], { features, metadata: {} }).finishedArea.sqFt, null);
});

test('approved neighborhood area totals disclose actual source coverage without changing value totals', () => {
  const presets = readData('neighborhoods.json');
  const data = readData('value_per_acre.geojson');
  for (const [id, sqFt, known, total, value] of [
    ['mosaic', 370955, 9, 20, 94829431],
    ['downtown-c-4', 277163, 82, 86, 32520450],
  ]) {
    const preset = presets.find((item) => item.id === id);
    const resolved = resolveNeighborhood(preset, data.features);
    const result = summarizeParcels(resolved.features, data);
    assert.equal(result.finishedArea.sqFt, sqFt);
    assert.equal(result.finishedArea.completeParcels, known);
    assert.equal(result.finishedArea.totalParcels, total);
    assert.equal(result.value, value);
  }
});

test('value per finished square foot uses matched totals, not the full value or average parcel ratio', () => {
  const a = parcel('0000001', 100000);
  a.properties.finished_area = { sq_ft: 1000, status: 'reported' };
  const b = parcel('0000002', 600000);
  b.properties.finished_area = { sq_ft: 3000, status: 'reported' };
  const missing = parcel('0000003', 1000000);
  const partial = parcel('0000004', 2000000);
  partial.properties.finished_area = { sq_ft: 500, status: 'partial' };
  const zero = parcel('0000005', 3000000);
  zero.properties.finished_area = { sq_ft: 0, status: 'reported' };
  const features = [a, a, b, missing, partial, zero];
  const result = summarizeParcels(features, { features, metadata: {} });
  assert.deepEqual(plain(result.finishedAreaValuation), {
    valuePerSqFt: 175, assessedValue: 700000, sqFt: 4000, parcels: 2,
  });
  assert.equal(getFinishedAreaValuation(a.properties).valuePerSqFt, 100);
  assert.equal(getFinishedAreaValuation(b.properties).valuePerSqFt, 200);
  for (const item of [missing, partial, zero]) {
    assert.equal(getFinishedAreaValuation(item.properties), null);
  }
});

test('unavailable assessments/areas cannot produce ratios and valid zero assessments remain zero', () => {
  for (const [value, sqFt, status] of [
    [null, 1000, 'reported'], [NaN, 1000, 'reported'], [-1, 1000, 'reported'],
    [Infinity, 1000, 'reported'], [100000, null, 'reported'], [100000, -1, 'reported'],
    [100000, Infinity, 'reported'], [100000, 1000, 'unavailable'],
  ]) {
    const item = parcel('0000001', value);
    item.properties.finished_area = { sq_ft: sqFt, status };
    assert.equal(getFinishedAreaValuation(item.properties), null);
    assert.equal(summarizeParcels([item], { features: [item], metadata: {} }).finishedAreaValuation.valuePerSqFt, null);
  }
  const zeroValue = parcel('0000001', 0);
  zeroValue.properties.finished_area = { sq_ft: 1000, status: 'reported' };
  assert.equal(getFinishedAreaValuation(zeroValue.properties).valuePerSqFt, 0);
  assert.equal(summarizeParcels([], { features: [], metadata: {} }).finishedAreaValuation.valuePerSqFt, null);
});

test('real neighborhood value per square foot excludes unmatched values and counts the condo parent once', () => {
  const presets = readData('neighborhoods.json');
  const data = readData('value_per_acre.geojson');
  for (const [id, value, sqFt, parcels] of [
    ['mosaic', 78728510, 370955, 8],
    ['downtown-c-4', 31838755, 277163, 65],
  ]) {
    const preset = presets.find((item) => item.id === id);
    const features = resolveNeighborhood(preset, data.features).features;
    const result = summarizeParcels(features, data).finishedAreaValuation;
    assert.equal(result.assessedValue, value);
    assert.equal(result.sqFt, sqFt);
    assert.equal(result.parcels, parcels);
    assert.equal(result.valuePerSqFt, value / sqFt);
  }
  const parent = data.features.find((item) => item.properties.parcel_id === '0094073');
  assert.equal(getFinishedAreaValuation(parent.properties).valuePerSqFt, 9818932 / 50270);
});

test('checked-in neighborhoods resolve completely against the current map', () => {
  const presets = readData('neighborhoods.json');
  const data = readData('value_per_acre.geojson');
  assert.equal(new Set(presets.map((preset) => preset.id)).size, presets.length);
  for (const preset of presets) {
    const result = resolveNeighborhood(preset, data.features);
    assert.deepEqual(plain(result.issues), [], `${preset.name}: ${result.issues.join(' ')}`);
    assert.equal(result.features.length, preset.parcelIds.length);
  }
});

test('Powell Place matches the maintainer-confirmed parcel list', () => {
  const presets = readData('neighborhoods.json');
  const data = readData('value_per_acre.geojson');
  const preset = presets.find((item) => item.id === 'powell-place');
  assert.ok(preset);
  assert.match(preset.source, /Maintainer selection/);
  const confirmed = ['0006600', '0082106'];
  for (const [start, end] of [
    [82111, 82124], [82646, 82713], [83000, 83002], [83469, 83472],
    [84481, 84490], [85205, 85238], [85450, 85493], [85880, 85880],
    [86219, 86252], [87030, 87065], [88008, 88008], [90049, 90052],
    [90316, 90346], [90984, 90985], [93160, 93160],
  ]) {
    for (let id = start; id <= end; id++) confirmed.push(String(id).padStart(7, '0'));
  }
  assert.deepEqual(preset.parcelIds, confirmed);
  const selected = summarizeParcels(resolveNeighborhood(preset, data.features).features, data);
  assert.ok(selected.value > 0);
  assert.ok(selected.acres > 0);
});

for (const [id, name, count] of [
  ['chatham-forest', 'Chatham Forest', 236],
  ['potterstone-village', 'Potterstone Village', 211],
  ['willow-springs', 'Willow Springs', 66],
  ['whispering-meadows', 'Whispering Meadows', 35],
  ['magnolia-trace', 'Magnolia Trace', 37],
]) {
  test(`${name} preset selects its explicit parcel membership`, () => {
    const preset = readData('neighborhoods.json').find((item) => item.id === id);
    const data = readData('value_per_acre.geojson');
    assert.ok(preset);
    assert.equal(preset.name, name);
    assert.equal(preset.parcelIds.length, count);
    const resolved = resolveNeighborhood(preset, data.features);
    assert.deepEqual(plain(resolved.issues), []);
    const result = summarizeParcels(resolved.features, data);
    assert.equal(result.parcels, count);
    assert.ok(result.value > 0);
    assert.ok(result.acres > 0);
  });
}

test('Vineyards matches the exact maintainer-submitted definition and all 649 parcel IDs', () => {
  const preset = readData('neighborhoods.json').find((item) => item.id === 'vineyards');
  assert.ok(preset);
  assert.equal(preset.name, 'Vineyards');
  assert.equal(preset.description, 'Curated parcel selection for Vineyards.');
  assert.equal(preset.source, 'Maintainer selection from the parcel map generated 2026-10-12.');
  assert.equal(preset.parcelIds.length, 649);
  assert.equal(
    createHash('sha256').update(JSON.stringify(preset.parcelIds)).digest('hex'),
    '1bc18d511aa66e28a4cdf228318f3a09441cbd24ac2526dd455c1de7633fdcb3',
  );
});

test('Encore matches the corrected 299-parcel selection, retaining 0095885 and excluding 0097368', () => {
  const preset = readData('neighborhoods.json').find((item) => item.id === 'encore');
  assert.ok(preset);
  assert.equal(preset.name, 'Encore');
  assert.equal(preset.description, 'Curated parcel selection for Encore.');
  assert.equal(preset.source, 'Maintainer selection from the parcel map generated 2026-10-12.');
  const confirmed = ['0007101'];
  for (const [start, end] of [
    [95816, 95867], [95882, 95943], [96271, 96321],
    [96878, 96886], [97227, 97318], [97480, 97509], [97592, 97593],
  ]) {
    for (let id = start; id <= end; id++) confirmed.push(String(id).padStart(7, '0'));
  }
  assert.equal(preset.parcelIds.length, 299);
  assert.ok(preset.parcelIds.includes('0095885'));
  assert.equal(preset.parcelIds.includes('0097368'), false);
  assert.deepEqual(preset.parcelIds, confirmed);
});

const reviewCandidates = JSON.parse(fs.readFileSync(
  path.join(root, 'src', 'data', 'neighborhood-review-candidates.json'), 'utf8',
));

test('Mosaic matches the approved 20-parcel browser selection including the central building', () => {
  const preset = readData('neighborhoods.json').find((item) => item.id === 'mosaic');
  assert.ok(preset);
  assert.equal(preset.name, 'Mosaic');
  assert.equal(preset.description, 'Curated parcel selection for Mosaic.');
  assert.equal(preset.source, 'Maintainer selection from the parcel map generated 2026-10-12.');
  assert.deepEqual(preset.parcelIds, [
    '0068503', '0093517', '0094072', '0094073', '0094074',
    '0094075', '0094076', '0094077', '0094078', '0094079',
    '0094080', '0094081', '0094082', '0094083', '0094084',
    '0094292', '0095585', '0095586', '0095587', '0095588',
  ]);
  const data = readData('value_per_acre.geojson');
  const resolved = resolveNeighborhood(preset, data.features);
  assert.deepEqual(plain(resolved.issues), []);
  assert.equal(summarizeParcels(resolved.features, data).value, 94829431);
  const parent = resolved.features.filter((feature) => feature.properties.parcel_id === '0094073');
  assert.equal(parent.length, 1);
  assert.equal(parent[0].properties.tax_value, 9818932);
  assert.equal(parent[0].properties.assessment_rollup.accounts.length, 14);
});

test('Downtown C-4 matches all 86 approved browser parcel IDs and metadata', () => {
  const preset = readData('neighborhoods.json').find((item) => item.id === 'downtown-c-4');
  assert.ok(preset);
  assert.equal(preset.name, 'Downtown C-4');
  assert.equal(preset.description, 'Curated parcel selection for Downtown C-4.');
  assert.equal(preset.source, 'Maintainer selection from the parcel map generated 2026-10-12.');
  assert.equal(preset.parcelIds.length, 86);
  assert.equal(
    createHash('sha256').update(JSON.stringify(preset.parcelIds)).digest('hex'),
    '020423498cd8139bf8db5f3dc4d96cabdf9bd320e15181df47b7481627cbed5b',
  );
});

test('all reviewed area starters have been promoted to public presets', () => {
  assert.deepEqual(reviewCandidates, []);
});

test('confirmed NoVi preset matches the browser selection after the two removals and never overlaps Encore', () => {
  const encore = readData('neighborhoods.json').find((candidate) => candidate.id === 'encore');
  const novi = readData('neighborhoods.json').find((candidate) => candidate.id === 'novi');
  assert.ok(novi);
  assert.ok(encore);
  assert.match(novi.source, /Maintainer-confirmed browser selection on 2026-10-18/);
  const noviIds = new Set(novi.parcelIds);
  assert.ok(encore.parcelIds.includes('0095866'), 'Include the verified 175 Prospect Place model.');
  assert.equal(encore.parcelIds.length, 299);
  const confirmed = [];
  for (const [start, end] of [[96537, 96650], [97124, 97184]]) {
    for (let id = start; id <= end; id++) confirmed.push(String(id).padStart(7, '0'));
  }
  assert.deepEqual(novi.parcelIds, confirmed);
  assert.equal(novi.parcelIds.length, 175);
  for (const id of ['0096269', '0096536', '0097991']) {
    assert.equal(noviIds.has(id), false);
    assert.ok(novi.description.includes(id));
  }
  const mapIds = new Set(readData('value_per_acre.geojson').features.map((feature) => feature.properties.parcel_id));
  assert.equal(mapIds.has('0097991'), false, 'Revisit NoVi coverage if the missing-value parcel becomes mapped.');
  assert.ok(encore.parcelIds.every((id) => !noviIds.has(id)));
  assert.ok(noviIds.has('0096629'), 'Include the official 169 Parkland Drive model.');
});
