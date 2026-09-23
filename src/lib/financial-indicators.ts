export const indicatorSource = {
  title: 'Understanding and Using the LGC’s Financial Performance Indicators',
  author: 'Kara Millonzi, UNC School of Government',
  date: 'September 14, 2026',
  url: 'https://canons.sog.unc.edu/blog/2026/09/14/understanding-and-using-the-lgcs-financial-performance-indicators/',
  pdfUrl: 'https://github.com/KyleShipp/pittsboro-budget/blob/main/' +
    encodeURIComponent("Understanding and Using the LGC’s Financial Performance Indicators – Coates' Can.pdf"),
};

interface Indicator {
  name: string;
  meaning: string;
  benchmark: string;
  needed: string;
  historySection?: string;
}

interface IndicatorGroup {
  id: string;
  title: string;
  note: string;
  indicators: Indicator[];
}

export const indicatorGroups: IndicatorGroup[] = [
  {
    id: 'general-fund',
    title: 'General Fund',
    note: 'These measures assess reserves and whether ongoing operations are drawing them down.',
    indicators: [
      {
        name: 'Fund Balance Available / expenditures',
        meaning: 'Available General Fund resources divided by applicable annual expenditures, expressed as a percentage.',
        benchmark: 'Varies by size. The article lists 25% for municipalities with at least $10 million in General Fund expenditures; confirm the Town’s threshold in its LOGOS FPI report.',
        needed: 'Audited Fund Balance Available and the matching expenditure denominator, or the published LGC ratio. Total or unassigned fund balance alone is not a verified FBA numerator.',
      },
      {
        name: 'Use of fund balance for operations',
        historySection: 'general-fund-history',
        meaning: 'Distinguishes reserves spent on capital from reserves used to cover an operating shortfall.',
        benchmark: 'An increase in fund balance, or evidence that a decline is attributable to capital-related spending.',
        needed: 'Audited annual changes are shown for FY2021–FY2025. The FY2024 decline still requires reconciliation of capital-related uses and financing; neither a decline nor a budgeted appropriation alone establishes an operating loss.',
      },
      {
        name: 'Total fund balance',
        historySection: 'general-fund-history',
        meaning: 'The General Fund’s year-end balance; a deficit signals that accumulated resources have been exhausted.',
        benchmark: 'Positive total fund balance.',
        needed: 'The General Fund column of each audited governmental-fund balance sheet supplies the historical balances. All five year-end balances are positive; these are not combined governmental-fund balances.',
      },
    ],
  },
  {
    id: 'water-sewer',
    title: 'Water and sewer funds',
    note: 'Historical utility measures use FY2021–FY2024 audits. Operations transferred to Sanford July 1, 2024, so ongoing Town utility measures are not applicable for FY2025. Remaining missing inputs for earlier years are not treated as zero.',
    indicators: [
      {
        name: 'Quick ratio',
        meaning: 'Liquid assets relative to current liabilities: the resources readily available to cover short-term obligations.',
        benchmark: '≥ 1.0',
        needed: 'For FY2021–FY2024, reconcile cash restrictions and eligible receivables to the LGC calculation before assessing liquidity. FY2025: not applicable to ongoing Town utility operations following transfer to Sanford.',
      },
      {
        name: 'Adjusted operating net income',
        historySection: 'utility-history',
        meaning: 'Applicable utility revenues less operating costs excluding depreciation, with debt-service principal and interest also deducted.',
        benchmark: '> $0',
        needed: 'Historical operating adjustments use audited operating income plus depreciation less principal and interest paid. Inputs and caveats are shown; reconcile to LOGOS before assigning an official rating. FY2025 ongoing operations: not applicable after transfer.',
      },
      {
        name: 'Unrestricted cash / expenses',
        meaning: 'Unrestricted cash and investments as a percentage of applicable annual expenses.',
        benchmark: '> 16%',
        needed: 'For FY2021–FY2024, verify unrestricted cash and investments and the LGC expense denominator. FY2025 ongoing operations: not applicable after transfer.',
      },
      {
        name: 'Transfers in for operations / expenses',
        meaning: 'Operating support from other funds relative to utility expenses. Recurring subsidies warrant different consideration from one-time transfers.',
        benchmark: '< 3%',
        needed: 'For FY2021–FY2024, separate operating transfers from capital transfers, cost allocations, and reimbursements, and verify the expense denominator. FY2025 ongoing operations: not applicable after transfer.',
      },
      {
        name: 'Capital asset condition ratio',
        historySection: 'utility-history',
        meaning: 'Remaining book value of depreciable assets divided by their original cost. This is an accounting-age measure, not an engineering assessment.',
        benchmark: '≥ 50%',
        needed: 'Historical ratios use gross depreciable cost less accumulated depreciation from the detailed capital notes, excluding land and construction in progress. Source discrepancies are disclosed with the calculations. FY2025 ongoing operations: not applicable after transfer.',
      },
    ],
  },
  {
    id: 'management',
    title: 'Financial management and compliance',
    note: 'These indicators require audit findings, submission records, and other supporting evidence—not just budget totals.',
    indicators: [
      {
        name: 'Audit submission',
        meaning: 'Whether the annual audit reached the LGC on time.',
        benchmark: 'By December 31 for a June 30 fiscal year end.',
        needed: 'The LGC audit submission date for the reporting year, not simply the auditor’s report date.',
      },
      {
        name: 'Uncollected budgeted property taxes',
        meaning: 'The uncollected portion of budgeted ad valorem taxes, including motor vehicles.',
        benchmark: '< 3%',
        needed: 'Budgeted taxes and corresponding actual collections on the LGC basis. Do not substitute one minus the budget’s assumed collection rate.',
      },
      {
        name: 'Expected property value change at revaluation',
        meaning: 'Whether the next revaluation is expected to reduce the property tax base.',
        benchmark: 'No estimated decrease.',
        needed: 'A documented estimate for the next revaluation. Historical tax-base growth is not a forecast.',
      },
      {
        name: 'Budget violations',
        historySection: 'compliance-history',
        meaning: 'Expenditures beyond the amounts legally authorized at the adopted ordinance level.',
        benchmark: 'None.',
        needed: 'The history summarizes reported audit findings, including FY2024 finding 2024-001 and its correction reported in FY2025. Absence of a reported finding is not an independent assessment of all legal budget requirements.',
      },
      {
        name: 'Internal control and compliance findings',
        historySection: 'compliance-history',
        meaning: 'Material weaknesses, significant deficiencies, statutory violations, and other findings requiring a response.',
        benchmark: 'No findings requiring a response. The article notes an exception when the only findings concern segregation of duties and/or skills, knowledge, and expertise, with no other FPICs.',
        needed: 'The auditor’s findings are summarized by year; LGC response requirements are not inferred. FY2024 reported budget noncompliance even though no material weaknesses or significant deficiencies were reported.',
      },
      {
        name: 'Finance officer coverage',
        meaning: 'Whether an appointed finance officer or interim officer served throughout the fiscal year.',
        benchmark: 'Full-year coverage.',
        needed: 'Appointment and service-period records or the corresponding audited FPI response.',
      },
      {
        name: 'Finance officer bond',
        meaning: 'Whether the finance officer had the required bond.',
        benchmark: 'Properly bonded.',
        needed: 'Bond coverage documentation or the corresponding audited FPI response.',
      },
      {
        name: 'Debt payments and bond covenants',
        meaning: 'Whether debt service was paid on time and bond covenants were met.',
        benchmark: 'No late payments or covenant violations.',
        needed: 'Payment and covenant compliance records. A budgeted debt-service schedule is not proof of timely payment.',
      },
      {
        name: 'Other auditor-identified concerns',
        meaning: 'Additional issues affecting fiscal health or internal controls.',
        benchmark: 'None.',
        needed: 'The auditor’s fiscal matters, recommendations, and other reported concerns.',
      },
    ],
  },
];
