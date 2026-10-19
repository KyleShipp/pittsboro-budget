const fs = require('node:fs');
const path = require('node:path');

function applyCondominiumAssessment(data, anomalies, supplement) {
  const parent = supplement.parent_feature;
  const id = parent.properties.parcel_id;
  const fail = (message) => { throw new Error(`Condominium supplement ${id}: ${message}`); };
  if (data.metadata.generated !== supplement.base_map_generated ||
      anomalies.generated !== supplement.base_map_generated) {
    fail('the base map was refreshed; reverify the tax accounts and update the supplement before proceeding.');
  }
  if (!/^\d{7}$/.test(id) || parent.properties.tax_value !== 0 ||
      !Number.isFinite(parent.properties.acres) || parent.properties.acres <= 0 ||
      !['Polygon', 'MultiPolygon'].includes(parent.geometry?.type) ||
      !Array.isArray(parent.geometry?.coordinates) || !parent.geometry.coordinates.length) {
    fail('a zero-assessed parent with valid acreage and polygon geometry is required.');
  }
  if (!Number.isInteger(supplement.tax_year) || !/^\d{4}-\d{2}-\d{2}$/.test(supplement.verified)) {
    fail('an explicit tax year and verification date are required.');
  }
  if (!Array.isArray(supplement.accounts) || !supplement.accounts.length) fail('no tax accounts supplied.');
  const accountIds = new Set();
  for (const account of supplement.accounts) {
    const suffix = account.parcel_id?.slice(id.length + 1);
    if (!account.parcel_id?.startsWith(`${id}-`) || !/^[A-Z0-9]+$/.test(suffix) ||
        accountIds.has(account.parcel_id) ||
        !Number.isFinite(account.tax_value) || account.tax_value < 0 ||
        account.source !== `https://chathamnc.devnetwedge.com/parcel/view/${account.parcel_id}/${supplement.tax_year}`) {
      fail(`invalid, duplicate, or wrong-year tax account: ${account.parcel_id}.`);
    }
    accountIds.add(account.parcel_id);
  }
  if (data.features.some((feature) =>
    accountIds.has(feature.properties.parcel_id) ||
    feature.properties.shared_land_parcels?.includes(id))) {
    fail('unit accounts or allocated parent land already exist in the map; resolve double-counting first.');
  }
  const matches = data.features.filter((feature) => feature.properties.parcel_id === id);
  const records = anomalies.records.filter((record) => record.parcel_id === id);
  if (matches.length > 1 || records.length !== 1) fail('ambiguous or missing parent anomaly record.');
  const current = matches[0];
  if (current && (!Number.isFinite(current.properties.acres) || current.properties.acres <= 0)) {
    fail('the mapped parent has invalid acreage.');
  }
  if ((current && current.properties.tax_value !== 0 && !current.properties.assessment_rollup) ||
      (records[0].tax_value !== 0 && !records[0].assessment_rollup)) {
    fail('the parent now has its own assessment; reverify the rollup instead of replacing it.');
  }
  const value = supplement.accounts.reduce((sum, account) => sum + account.tax_value, 0);
  if (!Number.isFinite(value) || value <= 0 ||
      !Number.isFinite(data.metadata.total_tax_value) || data.metadata.total_tax_value <= 0) {
    fail('positive account and Town assessment totals are required.');
  }
  const assessment_rollup = {
    tax_year: supplement.tax_year,
    verified: supplement.verified,
    parent_tax_value: parent.properties.tax_value,
    accounts: structuredClone(supplement.accounts),
    source: supplement.coverage_source,
  };
  const feature = structuredClone(current ?? parent);
  feature.properties = {
    ...feature.properties,
    tax_value: value,
    value_per_acre: value / feature.properties.acres,
    action: 'review',
    anomaly_reason: 'condo_assessment_rollup',
    assessment_rollup,
  };
  const features = current
    ? data.features.map((item) => item === current ? feature : item)
    : [...data.features, feature];
  const metadata = {
    ...data.metadata,
    total_features: features.length,
    included: features.filter((item) => item.properties.action === 'include').length,
    review: features.filter((item) => item.properties.action === 'review').length,
    total_tax_value: data.metadata.total_tax_value + value - (current?.properties.tax_value ?? 0),
  };
  const updatedRecords = anomalies.records.map((record) => record.parcel_id === id ? {
    ...record,
    tax_value: value,
    value_per_acre: feature.properties.value_per_acre,
    anomaly_flags: ['condo_assessment_rollup'],
    anomaly_reason: 'condo_assessment_rollup',
    action: 'review',
    assessment_rollup,
  } : record);
  return {
    data: { ...data, features, metadata },
    anomalies: { ...anomalies, records: updatedRecords },
  };
}

if (require.main === module) {
  const directory = path.join(__dirname, '..', 'public', 'data');
  const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
  const result = applyCondominiumAssessment(
    read('value_per_acre.geojson'),
    read('value_per_acre_anomalies.json'),
    read('parcel_assessment_supplement.json'),
  );
  for (const [name, value, indent] of [
    ['value_per_acre.geojson', result.data, undefined],
    ['value_per_acre_anomalies.json', result.anomalies, 2],
  ]) {
    const output = JSON.stringify(value, null, indent) + '\n';
    const target = path.join(directory, name);
    if (fs.readFileSync(target, 'utf8') !== output) fs.writeFileSync(target, output);
  }
  console.log('Verified condominium assessment supplement; parent land and unit values are counted once.');
}

module.exports = { applyCondominiumAssessment };
