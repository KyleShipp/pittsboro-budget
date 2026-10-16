# Pittsboro, NC Budget

An interactive budget transparency tool for the Town of Pittsboro, NC. Explore the General Fund budget by department, revenue source, and line item. Compare fiscal years, see how your property tax bill breaks down, and browse the 5-year Capital Improvement Plan.

**Live:** https://kyleshipp.github.io/pittsboro-budget/

## Features

- **Overview Dashboard** — Total budget, per-capita spending, revenue breakdown by source, expenditures by department with drilldown
- **Compare Years** — Side-by-side comparison across all three fiscal years with biggest changes highlighted
- **Tax Base** — Property tax base mix by type (Residential, Commercial, Industrial, Exempt, Other) with each type's share of assessed value and estimated annual tax split between Town and County
- **Value per Acre Map** — Choropleth map of assessed value per acre for every Town parcel. Includes a data-quality/anomaly review step: parcels with zero acres, missing geometry, missing value, duplicate IDs, or extreme statistical outliers (IQR method on log scale) are flagged before mapping. An *Anomaly Review* sub-page lists every flagged parcel with parcel ID, owner, address, acres, tax value, value/acre, anomaly reason, and suggested action (exclude / review / include). Only clean parcels and explicitly flagged-but-reviewable ones appear on the map.
- **Your Receipt** — Look up your property by address (live Chatham County GIS lookup) to see your tax bill split between Town and County, with a per-department breakdown
- **Tax Base** — Review ten years of taxable property, one-penny value, and tax rates, with County revaluation years highlighted
- **Value per Acre** — Draw an analysis polygon and total parcels completely encompassed by it, with estimated annual Town, County, and combined property taxes and Town tax per acre
- **Capital Plan** — 5-year Capital Improvement Plan ($37.2M in projects + $3.5M in vehicles) with department filtering
- **Fee Schedule** — Searchable General Fund fee schedule including facility rentals, athletic fees, and admin charges
- **Mobile Navigation** — Responsive Menu/Close toggle in the header so all pages are reachable on phones and small tablets
- **About & Methodology** — Data sources, limitations, and links to official documents

## Data Coverage

| Fiscal Year | Type | Source |
|---|---|---|
| FY 2024-2025 | Actual | From FY 26-27 adopted budget document |
| FY 2025-2026 | Adopted | Adopted Budget document (June 2025) |
| FY 2026-2027 | Adopted | Adopted Budget document (June 8, 2026) |

## Tech Stack

- **Next.js 14** with App Router and static export
- **React 18** + **TypeScript**
- **Recharts** for interactive charts (bar, pie)
- **Leaflet** + **react-leaflet** for the Value per Acre choropleth map
- **Tailwind CSS** for styling
- **Chatham County GIS API** for real-time property lookups and parcel geometry
- No backend — all budget data from JSON files in `public/data/`

## Running Locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # Static export to out/
```

## Testing Access

All pages use a bypassable convenience gate, matching the Cost of Service site's
public testing passcode: `pittsboro-test`. Change `testingPasscode` in
`src/components/AccessGate.tsx` to update it. Access is remembered in session
storage for the current tab; if storage is unavailable, unlocking still works
until the page is reloaded.

This is **not authentication or security**. The passcode is shipped in the public
JavaScript, and exported pages and data files remain publicly accessible. Do not
use it to protect sensitive information; use authenticated hosting for that.

## Project Structure

```
public/data/       JSON data files (budget, CIP, fees, debt, metadata)
src/app/           Next.js App Router pages
src/components/    Reusable chart and UI components
src/lib/           Data loading, formatting, GIS queries
src/types/         TypeScript interfaces
```

## Updating Data

Budget data is extracted from published PDF budget documents and structured into JSON.

The **Tax Base** page reads `public/data/taxbase.json`, which is generated from
live Chatham County parcel data by the script in `../PittsboroTaxBase`:

```bash
cd ../PittsboroTaxBase
python pittsboro_tax_base.py   # writes ../BudgetExplorer/public/data/taxbase.json
```

The **Value per Acre Map** reads two generated files:
- `public/data/value_per_acre.geojson` — map-ready parcel polygons
- `public/data/value_per_acre_anomalies.json` — anomaly review table

Generate or refresh them with:

```bash
cd ../PittsboroTaxBase
python pittsboro_value_per_acre.py
# Requires: requests, pandas, shapely
```

The script fetches Pittsboro parcels (with geometry) from the Chatham County
ArcGIS CAMA Parcels service, allocates taxable-zero condominium common land
equally among units linked by mapped-parcel or declaration references, and
calculates `value_per_acre = jan1_total_ASV / effective_acres`. Allocated units
remain flagged for review. It also flags zero acres, missing geometry, IQR
outliers on a log scale, duplicate parcel IDs, and other data-quality issues.

The anomaly review table supports user-resizable columns and exports the current
filtered and sorted rows as an Excel-compatible CSV.

The map's polygon analysis uses complete parcel geometry rather than parcel
centroids. Starting, completing, or clearing an analysis preserves the current
map view. Click to place vertices, then double-click the final point to close
and analyze the polygon, or click **Analyze polygon** after placing at least
three points. Normal double-click zoom is disabled only while drawing.
Its percentage compares the selected assessed value with the total
assessed value of all parcels included in the map dataset.
Analysis includes all encompassed parcels, even those hidden by map filters.
After analysis, the drawn polygon and its vertices are removed and the exact
parcel geometries counted in the results are shaded purple above the base map.
This highlight includes counted parcels hidden by filters, remains visible
when filters change, and is removed by **Clear analysis**.
Estimated annual taxes use the fiscal year and Town/County rates in
`public/data/taxbase.json`: selected assessed value divided by 100, multiplied
by each rate. These estimates do not apply a collection-rate discount and are
not actual tax bills or collections; parcel-specific exemptions, relief,
special districts, and fees are not modeled. Only the Town portion goes to
Pittsboro.

Built floor area is shown as unavailable: neither the generated map dataset
nor the source CAMA parcel service supplies building square footage. Parcel
acreage (or its square-foot equivalent) measures land, not building footprint
or total floor area. Supporting built square feet requires an additional
building-level source linked to parcel IDs.

To update for a new fiscal year:
1. Add the new fiscal year's line items to `public/data/budget.json`
2. Update `public/data/summary.json` and `public/data/meta.json`
3. Push to `main` — GitHub Actions auto-deploys

## Not An Official Publication

This site is not an official Town of Pittsboro publication. It is an independent civic data tool built from published budget materials. For official budget documents and financial reports, visit [pittsboronc.gov](https://www.pittsboronc.gov).
