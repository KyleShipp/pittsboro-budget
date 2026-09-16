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
        meaning: 'Distinguishes reserves spent on capital from reserves used to cover an operating shortfall.',
        benchmark: 'An increase in fund balance, or evidence that a decline is attributable to capital-related spending.',
        needed: 'Actual beginning and ending fund balances, appropriations, and capital-related uses. A budgeted appropriation alone does not establish an operating loss.',
      },
      {
        name: 'Total fund balance',
        meaning: 'The General Fund’s year-end balance; a deficit signals that accumulated resources have been exhausted.',
        benchmark: 'Positive total fund balance.',
        needed: 'Audited General Fund total fund balance for the reporting year. The budget-sourced balance below is context, not a verified LGC result.',
      },
    ],
  },
  {
    id: 'water-sewer',
    title: 'Water and sewer funds',
    note: 'Utility financial statements are not included in this General Fund dataset. Confirm the reporting entity and applicable funds for each year before assigning results; missing data does not mean “not applicable.”',
    indicators: [
      {
        name: 'Quick ratio',
        meaning: 'Liquid assets relative to current liabilities: the resources readily available to cover short-term obligations.',
        benchmark: '≥ 1.0',
        needed: 'Applicable audited cash, investments, receivables, and current liabilities, using the LGC calculation.',
      },
      {
        name: 'Adjusted operating net income',
        meaning: 'Applicable utility revenues less operating costs excluding depreciation, with debt-service principal and interest also deducted.',
        benchmark: '> $0',
        needed: 'Audited utility revenues, operating expenses, depreciation, and debt principal and interest; reconcile adjustments to the LGC report.',
      },
      {
        name: 'Unrestricted cash / expenses',
        meaning: 'Unrestricted cash and investments as a percentage of applicable annual expenses.',
        benchmark: '> 16%',
        needed: 'Audited unrestricted cash and investments and the LGC expense denominator.',
      },
      {
        name: 'Transfers in for operations / expenses',
        meaning: 'Operating support from other funds relative to utility expenses. Recurring subsidies warrant different consideration from one-time transfers.',
        benchmark: '< 3%',
        needed: 'Audited operating transfers in and applicable expenses. Cost allocations and reimbursements are not the same as transfers.',
      },
      {
        name: 'Capital asset condition ratio',
        meaning: 'Remaining book value of depreciable assets divided by their original cost. This is an accounting-age measure, not an engineering assessment.',
        benchmark: '≥ 50%',
        needed: 'Audited depreciable asset cost and accumulated depreciation; exclude nondepreciable assets from the comparison.',
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
        meaning: 'Expenditures beyond the amounts legally authorized at the adopted ordinance level.',
        benchmark: 'None.',
        needed: 'Audit findings and final amended budget-to-actual schedules at the legally adopted level.',
      },
      {
        name: 'Internal control and compliance findings',
        meaning: 'Material weaknesses, significant deficiencies, statutory violations, and other findings requiring a response.',
        benchmark: 'No findings requiring a response. The article notes an exception when the only findings concern segregation of duties and/or skills, knowledge, and expertise, with no other FPICs.',
        needed: 'The auditor’s findings and LGC response requirements; a clean audit opinion does not by itself establish an absence of findings.',
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
