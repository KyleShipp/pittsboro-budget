# Pittsboro Budget Explorer

An interactive, citizen-facing budget transparency tool for the Town of Pittsboro, NC. Explore the General Fund budget by department, revenue source, and line item. Compare fiscal years, see how your property tax bill breaks down, and browse the 5-year Capital Improvement Plan.

**Live:** http://localhost:3002 (dev)

## Features

- **Overview Dashboard** — Total budget, per-capita spending, revenue breakdown by source, expenditures by department with drilldown
- **Compare Years** — Side-by-side comparison of any two fiscal years with biggest changes highlighted
- **Your Receipt** — Slide in your home's assessed value and see exactly how your property tax is distributed across Town services
- **Capital Plan** — 5-year Capital Improvement Plan ($37.2M in projects + $3.5M in vehicles) with department filtering
- **Fee Schedule** — Searchable General Fund fee schedule including facility rentals, athletic fees, and admin charges
- **About & Methodology** — Data sources, limitations, and links to official documents

## Data Coverage

| Fiscal Year | Type | Source |
|---|---|---|
| FY 2024-2025 | Actual | From FY 26-27 recommended budget document |
| FY 2025-2026 | Adopted | Adopted Budget document (June 2025) |
| FY 2026-2027 | Recommended | Manager's Recommended Budget (May 2026) |

## Tech Stack

- **Next.js 14** with App Router and static export (`output: 'export'`)
- **React 18** + **TypeScript**
- **Recharts** for interactive charts (bar, pie)
- **Tailwind CSS** for styling
- No backend — all data from JSON files in `public/data/`

## Running Locally

```bash
cd "Chatham Dynamics/BudgetExplorer"
npm install
npm run dev        # http://localhost:3002
npm run build      # Static export to out/
```

## Project Structure

```
public/data/       JSON data files (budget, CIP, fees, debt, metadata)
src/app/           Next.js App Router pages
src/components/    Reusable chart and UI components
src/lib/           Data loading, formatting, calculations
src/types/         TypeScript interfaces
```

## Data Pipeline

Budget data is extracted from published PDF budget documents and structured into JSON. The ingestion can be done via the LedgerTown platform (`Chatham Dynamics/LedgerTown/`) or manually curated. CIP and fee schedule data are hand-structured from the source PDFs.

To update data for a new fiscal year:
1. Add the new fiscal year's line items to `public/data/budget.json`
2. Update `public/data/summary.json` and `public/data/meta.json`
3. Rebuild: `npm run build`

## Architecture Notes

- Designed as single-town app with multi-town reuse in mind (data files are the only town-specific content)
- Fully static — deploy to Vercel, GitHub Pages, or any CDN
- No authentication or user accounts — fully public

## Not An Official Publication

This site is not an official Town of Pittsboro publication. It is an independent civic data tool built from published budget materials. For official budget documents and financial reports, visit [pittsboronc.gov](https://www.pittsboronc.gov).
