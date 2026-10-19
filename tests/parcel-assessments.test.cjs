const assert = require('node:assert/strict');
const test = require('node:test');
const { applyCondominiumAssessment } = require('../scripts/apply-parcel-assessments.cjs');
const supplement = require('../public/data/parcel_assessment_supplement.json');
const fs = require('node:fs');
const path = require('node:path');

function fixture() {
  const other = structuredClone(supplement.parent_feature);
  other.properties.parcel_id = '0000001';
  other.properties.tax_value = 100;
  other.properties.action = 'include';
  return {
    data: {
      type: 'FeatureCollection',
      features: [other],
      metadata: { generated: supplement.base_map_generated, total_tax_value: 100 },
    },
    anomalies: {
      generated: supplement.base_map_generated,
      records: [{ ...supplement.parent_feature.properties, anomaly_flags: ['zero_value_taxable'] }],
    },
  };
}

test('unit assessments restore one selectable polygon, counting land and values exactly once', () => {
  const { data, anomalies } = fixture();
  const original = structuredClone({ data, anomalies });
  const result = applyCondominiumAssessment(data, anomalies, supplement);
  const restored = result.data.features.find((feature) => feature.properties.parcel_id === '0094073');
  assert.equal(result.data.features.length, 2);
  assert.equal(restored.properties.tax_value, 9818932);
  assert.equal(restored.properties.acres, 1.6825008125297818);
  assert.equal(restored.properties.value_per_acre, 9818932 / restored.properties.acres);
  assert.deepEqual(restored.geometry, supplement.parent_feature.geometry);
  assert.equal(restored.properties.assessment_rollup.accounts.length, 14);
  assert.equal(restored.properties.assessment_rollup.tax_year, 2026);
  assert.equal(restored.properties.assessment_rollup.verified, '2026-10-18');
  assert.equal(result.data.metadata.total_tax_value, 9819032);
  assert.equal(result.data.metadata.review, 1);
  assert.equal(result.anomalies.records[0].action, 'review');
  assert.deepEqual(result.anomalies.records[0].anomaly_flags, ['condo_assessment_rollup']);
  assert.deepEqual({ data, anomalies }, original);
});

test('reapplying the supplement does not add another polygon, acreage, or Town value', () => {
  const { data, anomalies } = fixture();
  const first = applyCondominiumAssessment(data, anomalies, supplement);
  assert.deepEqual(applyCondominiumAssessment(first.data, first.anomalies, supplement), first);
});

test('a refreshed map or newly assessed parent requires explicit source review', () => {
  const { data, anomalies } = fixture();
  assert.throws(() => applyCondominiumAssessment(
    { ...data, metadata: { ...data.metadata, generated: '2027-01-01' } }, anomalies, supplement,
  ), /reverify the tax accounts/);
  const parent = structuredClone(supplement.parent_feature);
  parent.properties.tax_value = 500000;
  assert.throws(() => applyCondominiumAssessment(
    { ...data, features: [...data.features, parent] }, anomalies, supplement,
  ), /parent now has its own assessment/);
});

test('invalid, duplicate, and wrong-year unit accounts fail instead of producing partial totals', () => {
  const { data, anomalies } = fixture();
  for (const invalid of [
    { ...supplement, accounts: [] },
    { ...supplement, accounts: [...supplement.accounts, supplement.accounts[0]] },
    { ...supplement, accounts: [{ ...supplement.accounts[0], tax_value: -1 }] },
    { ...supplement, tax_year: 2027 },
  ]) {
    assert.throws(() => applyCondominiumAssessment(data, anomalies, invalid), /supplement 0094073:/);
  }
});

test('existing unit features or allocated common land block double-counting', () => {
  const { data, anomalies } = fixture();
  for (const properties of [
    { parcel_id: supplement.accounts[0].parcel_id },
    { parcel_id: '0000002', shared_land_parcels: ['0094073'] },
  ]) {
    assert.throws(() => applyCondominiumAssessment(
      { ...data, features: [...data.features, { properties }] }, anomalies, supplement,
    ), /resolve double-counting/);
  }
});

test('checked-in map and anomaly report contain the same audited condominium rollup', () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'value_per_acre.geojson'), 'utf8'));
  const report = require('../public/data/value_per_acre_anomalies.json');
  const features = data.features.filter((feature) => feature.properties.parcel_id === '0094073');
  assert.equal(features.length, 1);
  assert.equal(features[0].properties.tax_value, 9818932);
  assert.deepEqual(
    report.records.find((record) => record.parcel_id === '0094073').assessment_rollup,
    features[0].properties.assessment_rollup,
  );
  assert.deepEqual(applyCondominiumAssessment(data, report, supplement), { data, anomalies: report });
});
