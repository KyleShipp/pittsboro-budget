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

### Finished floor area

The map starts at **Show All**. Finished-area and value-per-finished-square-foot
cards show the figures without calculation paragraphs or partial-data badges.
Parcels without reported structures are expected; floor area and acreage measure
different things. **About this map**, **Analysis notes
and sources**, parcel popup notes, and data-source footnotes are collapsed by
default. Expand them for coverage counts, calculation bases, tax assumptions,
and source provenance.

After selecting a neighborhood or analyzing an area, **Export JPEG** downloads
the current summary and parcel map at twice screen resolution, with the current
viewport, parcel shading, legend, and OpenStreetMap attribution. The VaraGov
logo appears in the upper-right corner of the JPEG only. Controls and
explanatory footnotes are omitted even if expanded. Export is unavailable during
drawing, local editing, map movement, or tile loading. Missing map tiles or
capture failures produce a visible error rather than an incomplete image.

Shared-land allocation alone is an informational adjustment, not an orange
anomaly. These parcels retain normal quantile colors and remain visible when
review parcels are hidden. Other genuine review reasons remain flagged.
The underlying source flags are preserved for auditing; the review table and
CSV classify allocation-only records as included adjustments. Analysis notes
give a brief general explanation rather than a parcel-by-parcel allocation list.
In the underlying data,
`shared_common` uses the allocated share without adding the unit footprint again;
`parcel_plus_shared_common` adds reported acreage and the allocated share.
Neither changes the assessed value or the calculation results.

Parcel popups and every analysis workflow (drawn polygons, public presets,
and local manual selections) show **Finished area (sq ft)** using the County's
[DEVNET Structures table](https://gisservices.chathamcountync.gov/opendataagol/rest/services/Cadastral/Chatham_PropertyImprovements/MapServer/0).
Its `gross_living_area` field matches **Total Finished Area** on the public tax
pages, verified for residential `0094927` (2,393 sq ft), commercial `0007880`
(6,140 sq ft), and condominium unit `0094073-100` (14,385 sq ft).

`public/data/parcel_improvements.json` preserves a 2026 real-estate (`RE`)
structures snapshot, downloaded October 18, 2026. It includes 3,985 rows for
the map's explicit parcel and supplemented condominium account IDs. Of 3,690
unique mapped parcel IDs, 2,845 have complete reported area; 109 of those
explicitly report zero. Multiple structures on one account are summed.
Building IDs are scoped by parcel and property class because mixed-use
parcels can reuse a building ID in different classes.

Coverage counts and source limitations remain in the collapsed analysis notes,
not as caveats on the metric cards. A missing structure record or null area is unknown, not zero or
proof that land is vacant. Reported zero is preserved as zero. Finished/living
area is not a building footprint, land area, or a complete measure of every
garage, porch, unfinished space, or outbuilding. This 2026 source can lag
newer development in the base parcel map. Fractional source areas are retained
and displayed to at most two decimal places.

Mosaic parent `0094073` receives 50,270 sq ft from its 14 verified unit accounts,
not an additional copy of the parent area. Duplicate map geometries with the
same parcel ID also count finished area only once. Existing assessment,
acreage, tax calculations, and neighborhood membership are unchanged.

**Value per finished sq ft** is shown in parcel popups and all analysis
workflows. It uses total assessed value (land plus buildings), not building-only
value, a sale price, or construction cost. Only parcels with complete, positive
finished area and a known nonnegative assessment qualify. Missing, partial,
and zero-area records are excluded from both numerator and denominator.
Area analyses divide the sum of qualifying assessments by the sum of their
finished square feet; they do not average parcel ratios or divide the entire
selection's value by an incomplete area subtotal. Duplicate parcel IDs count
once. The card shows qualifying parcel count and the exact value/area basis,
with the ratio displayed to two decimal places. If no parcels qualify, it
shows **Not available**, never an undefined ratio or a misleading zero.

`npm run prepare:parcels` applies the checked-in structures snapshot after the
condominium assessment supplement, automatically before development and
production builds. It does not need network access. To refresh source data,
run `npm run refresh:finished-area`; it queries every required tax account,
checks counts and pagination, validates the complete response, and only then
saves the snapshot and enriched map. HTTP/GIS errors, duplicate source records,
changed map dates/account membership, and ambiguous parent/unit area fail
explicitly rather than yielding partial success. Review coverage and run
tests/build after refreshing. To change the source tax year, update `TAX_YEAR`
in `scripts/parcel-finished-area.cjs` and reverify condominium account membership
for that year before refreshing.

### Condominium assessment supplement

The central Mosaic building at 120 Mosaic Boulevard is mapped parcel
`0094073`. The GIS parent is assessed at zero, while its 14 separately assessed
condominium accounts are absent from the GIS parcel layer. Simply restoring
that zero-valued polygon would understate the building's value and taxes.

`public/data/parcel_assessment_supplement.json` records the County parent
geometry and the 14 unit **assessed values**, verified against public DEVNET
tax records on October 18, 2026. The accounts total **$9,818,932**. They are
combined into one selectable parent polygon, with its **1.6825008125297818
acres counted once**. Unit accounts are not added as overlapping parcels.
The obsolete `0094073-300` account is historical (2024), not an additional
current account; the public tax search confirms the parent and 14 units for
2026.

These are explicitly **2026 unit assessments**, supplementing the zero-valued
2027 GIS parent record. The base map snapshot remains October 12, 2026; the
supplement's verification date and tax year are shown in the analysis. No
construction-cost values are substituted for assessed values. The parent is
marked for review as `condo_assessment_rollup`, including in the anomaly table,
and its popup explains the account aggregation. The map's Town-value
denominator includes the added unit values once.

`npm run prepare:parcels` applies the supplement to the generated GeoJSON and
anomaly report. It also runs automatically before development and production
builds. Repeated runs are idempotent. After refreshing the external parcel
generator, reverify the current tax accounts, assessments, and parent geometry,
then update the supplement's base-map date. The script stops with an explicit
error if the snapshot changes, the parent acquires its own assessment, or unit
features/shared land would be counted twice. Do not just advance the date
without reviewing the sources.

### Curated neighborhoods

Public neighborhood buttons use explicit parcel-ID lists in
`public/data/neighborhoods.json`. Clicking a button zooms to those parcels,
highlights their actual geometries in purple, and runs the same value and tax
calculations as a drawn area. Map filters do not change preset membership.
The **Powell Place** preset contains the 289 parcel IDs reviewed and confirmed
by the maintainer on October 16, 2026, using the map generated October 12.
The starting selection came from Chatham County neighborhood `PI039`
(`POWELL PLACE`), queried October 16. The checked-in parcel list, rather than
a live County classification or a drawn boundary, defines membership.

The **NoVi** preset contains the 175 parcel IDs confirmed from the maintainer's
browser selection on October 18, 2026. It started with mapped County groups
`CP004` and `CP008`, then explicitly removed `0096269` and `0096536`. Encore is
not included. Source parcel `0097991` (35 Parkland Drive) has missing assessed
value and is absent from the map and totals. The confirmed ID list, not the
broader County groups or marketing boundary, defines the public preset.

The **Vineyards** preset contains the exact 649 parcel IDs submitted and
confirmed by the maintainer on October 18, 2026, with the supplied description
and source preserved. Compared with the original 620-parcel County-derived
starter, this selection adds 32 parcels and removes `0007250`, `0007386`, and
`0094584`. The submitted list defines membership, not County classifications
`CP002` and `CP006`. Zero-assessed HOA parcel `0095424` remains absent from the
map and is not in the confirmed list.

The **Encore** preset contains 299 parcel IDs confirmed by the maintainer on
October 18, 2026, after correcting the submitted list to retain `0095885` and
exclude `0097368`. The supplied description and source are preserved. The
corrected list matches the original County-derived starter. Encore and NoVi
remain separate selections with no shared parcels.

The **Mosaic** preset contains the exact 20 parcel IDs approved from the
maintainer's browser selection on October 18, 2026. It expands the original
11-parcel owner/address starter and includes the restored central building
`0094073`. Its 14 condominium assessments are combined onto one parent polygon,
with land counted once, as documented above. The approved selection totals
$94,829,431 in assessed value.

The **Downtown C-4** preset contains the exact 86 parcel IDs approved from the
maintainer's browser selection on October 18, 2026. Its public ID is
`downtown-c-4`, matching the exported definition. The starting selection came
from whole Town-tax-district parcels intersecting or touching the County's
[Pittsboro C-4 zoning polygon](https://gisservices.chathamcountync.gov/opendataagol/rest/services/LandUsePlanning/Chatham_PittsboroZoning/MapServer/0),
queried October 18. Totals count each selected parcel's **entire** acreage and
assessed value, not a clipped or prorated C-4 portion. The checked-in ID list
defines membership, not a live zoning query.

Additional County-derived starter presets, queried October 16, 2026:

| Neighborhood | County codes | Parcels |
|---|---|---|
| Chatham Forest (including Phase II) | `PI015`, `PI043` | 236 |
| Potterstone Village | `PI035` | 211 |
| Willow Springs | `PI036` | 66 |
| Whispering Meadows | `PI048` | 35 |
| Magnolia Trace | `PI033` | 37 |

Every listed ID resolves uniquely in the current map. These five selections
are labeled as pending maintainer boundary review, unlike the confirmed
Powell Place, NoVi, Vineyards, Encore, Mosaic, and Downtown C-4 presets. Review them in local setup mode
before treating their County classifications as your intended neighborhood boundaries.

To create or revise a neighborhood:

1. Run `npm run dev` and open `/value-per-acre`.
2. Click **Neighborhood setup (local only)**. This tool is only included in
   development builds; there is no public editing, account, database, or
   browser-storage save feature.
3. Choose an existing neighborhood as a starting point, or draw and analyze
   a polygon. All available map parcels are shown during setup.
4. Click individual parcels to add or remove them. Use **Review selected
   parcels** to inspect IDs and addresses or remove specific entries.
5. Enter a name and click **Copy neighborhood definition**. If clipboard
   access fails, copy the read-only JSON manually.
6. Paste the definition into the array in `public/data/neighborhoods.json`,
   or send it in this chat for incorporation. Replace the existing entry
   when updating a neighborhood; new neighborhoods require unique IDs.
   Review the description and source to explain decisions about HOA land,
   commercial parcels, undeveloped phases, or other boundary choices.
7. Run `npm test` and `npm run build`, review the highlighted selection,
   then commit and publish through the normal repository workflow.

Keep parcel IDs as seven-digit strings, including leading zeros. Runtime
validation disables an invalid preset and displays the missing, duplicated,
or ambiguous IDs instead of showing partial totals. The tests validate all
checked-in presets against the current map dataset; run them after refreshing
parcel data to identify splits, combinations, or exclusions that need review.
Only parcels present in the map dataset can be selected. Setup exports do not
write to the repository automatically and are lost on reload unless copied.

#### Local review starters

The development-only setup panel can also offer **Preview** buttons backed by
`src/data/neighborhood-review-candidates.json`. These unapproved starters are
separate from the public preset registry and are not included in production
JavaScript. They are for visual review and manual refinement, not authoritative
neighborhood or zoning boundaries.

The review registry is currently empty: Mosaic and Downtown C-4 were approved
and promoted to public presets. Empty preview controls are hidden; the regular
local editing and export workflow remains available.

To review, enter **Neighborhood setup (local only)** and choose a **Preview**
button. Use **View highlighted parcels on map**, then click parcels to add or
remove them. The map provides **Back to setup and export**. To select an area
entirely manually, use **Start empty selection (keep name)**, then click parcels
or draw an analysis polygon. Name the neighborhood or district and copy its
definition when reviewed. Send the JSON for incorporation into the public
registry; previewing alone never publishes a preset.

To update for a new fiscal year:
1. Add the new fiscal year's line items to `public/data/budget.json`
2. Update `public/data/summary.json` and `public/data/meta.json`
3. Push to `main` — GitHub Actions auto-deploys

## Not An Official Publication

This site is not an official Town of Pittsboro publication. It is an independent civic data tool built from published budget materials. For official budget documents and financial reports, visit [pittsboronc.gov](https://www.pittsboronc.gov).
