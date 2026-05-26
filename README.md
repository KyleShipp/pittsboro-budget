# Pittsboro, NC Budget

An interactive budget transparency tool for the Town of Pittsboro, NC. Explore the General Fund budget by department, revenue source, and line item. Compare fiscal years, see how your property tax bill breaks down, and browse the 5-year Capital Improvement Plan.

**Live:** https://kyleshipp.github.io/pittsboro-budget/

## Features

- **Overview Dashboard** — Total budget, per-capita spending, revenue breakdown by source, expenditures by department with drilldown
- **Compare Years** — Side-by-side comparison across all three fiscal years with biggest changes highlighted
- **Your Receipt** — Look up your property by address (live Chatham County GIS lookup) to see your tax bill split between Town and County, with a per-department breakdown
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

- **Next.js 14** with App Router and static export
- **React 18** + **TypeScript**
- **Recharts** for interactive charts (bar, pie)
- **Tailwind CSS** for styling
- **Chatham County GIS API** for real-time property lookups
- No backend — all budget data from JSON files in `public/data/`

## Running Locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # Static export to out/
```

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

To update for a new fiscal year:
1. Add the new fiscal year's line items to `public/data/budget.json`
2. Update `public/data/summary.json` and `public/data/meta.json`
3. Push to `main` — GitHub Actions auto-deploys

## Not An Official Publication

This site is not an official Town of Pittsboro publication. It is an independent civic data tool built from published budget materials. For official budget documents and financial reports, visit [pittsboronc.gov](https://www.pittsboronc.gov).
