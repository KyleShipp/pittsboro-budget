export interface FiscalYearMeta {
  key: string;
  label: string;
  type: 'actual' | 'adopted' | 'recommended';
  startDate: string;
  endDate: string;
}

export interface TaxRateEntry {
  year: string;
  rate: number;
}

export interface ValueOfPennyEntry {
  year: string;
  value: number;
}

export interface MetaData {
  municipality: {
    name: string;
    state: string;
    county: string;
    type: string;
    founded: number;
    population: number;
    medianHomeValue: number;
    medianHouseholdIncome: number;
    website: string;
  };
  fiscalYears: FiscalYearMeta[];
  defaultFiscalYear: string;
  taxRateHistory: TaxRateEntry[];
  valueOfPenny: ValueOfPennyEntry[];
  collectionRate: number;
  fundBalancePolicy: number;
  lgcMinimum: number;
  fundBalance: {
    endingFY2425: number;
    assigned: number;
    unassigned: number;
  };
  sources: Array<{
    title: string;
    date: string;
    type: string;
  }>;
}

export interface TimelineEntry {
  date: string;
  event: string;
  status: 'complete' | 'upcoming';
}

export interface FYSummary {
  totalRevenue: number;
  totalExpenditures: number;
  taxRate: number;
  valueOfPenny: number;
  collectionRate: number;
  fundBalanceAppropriated: number;
  revenueNeutralRate?: number;
  status?: 'recommended' | 'adopted' | 'actual';
  statusLabel?: string;
  statusDetail?: string;
  timeline?: TimelineEntry[];
  highlights?: string[];
}

export interface SummaryData {
  fiscalYears: Record<string, FYSummary>;
}

export interface RevenueLineItem {
  code: string;
  description: string;
  category: string;
  [key: string]: string | number; // FY amounts
}

export interface DepartmentAmounts {
  personnel: number;
  operating: number;
  capital: number;
  total: number;
}

export interface Department {
  id: string;
  name: string;
  deptCode: string;
  amounts: Record<string, DepartmentAmounts>;
  note?: string;
}

export interface RevenueCategory {
  category: string;
  [key: string]: string | number;
}

export interface ExpenditureTotals {
  personnel: number;
  operating: number;
  capital: number;
  debtService: number;
  total: number;
}

export interface BudgetData {
  revenues: RevenueLineItem[];
  revenueCategories: RevenueCategory[];
  departments: Department[];
  expenditureTotals: Record<string, ExpenditureTotals>;
}

export interface CIPProject {
  id: number;
  category: string;
  fundingSource: string;
  department: string;
  name: string;
  FY27: number;
  FY28: number;
  FY29: number;
  FY30: number;
  FY31: number;
  total: number;
}

export interface CIPData {
  capitalProjects: CIPProject[];
  capitalProjectTotals: Record<string, number>;
  vehicles: CIPProject[];
  vehicleTotals: Record<string, number>;
  fundingSourceKey: Record<string, string>;
  categoryKey: Record<string, string>;
}

export interface Fee {
  item: string;
  amount: number;
  unit: string;
}

export interface FeeSubcategory {
  name: string;
  note?: string;
  fees: Fee[];
}

export interface FeeCategory {
  name: string;
  description?: string;
  note?: string;
  fees?: Fee[];
  subcategories?: FeeSubcategory[];
}

export interface FeesData {
  fiscalYear: string;
  adoptionDate: string;
  keyChange: string;
  categories: FeeCategory[];
}

export interface DebtScheduleEntry {
  year: string;
  principalBalance: number;
  principalPayment: number;
  interestPayment: number;
}

export interface Loan {
  lender: string;
  originalAmount: number;
  rate: number;
  purpose: string;
  schedule: DebtScheduleEntry[];
}

export interface DebtData {
  loans: Loan[];
  totalDebtService: Record<string, { principal: number; interest: number; total: number }>;
  totalOutstandingDebt: number;
}

export interface TaxBaseGroup {
  group: string;
  parcels: number;
  assessedValue: number;
  pctOfBase: number;
  townTax: number;
  countyTax: number;
  totalTax: number;
}

export interface TaxBaseData {
  fiscalYear: string;
  generated: string;
  townRate: number;
  countyRate: number;
  source: string;
  groups: TaxBaseGroup[];
  total: TaxBaseGroup;
}

// ── Value-per-Acre types ──────────────────────────────────────────────────

export type AnomalyAction = 'include' | 'review' | 'exclude';

export interface ParcelProperties {
  parcel_id: string;
  owner: string;
  address: string;
  acres: number | null;
  tax_value: number | null;
  value_per_acre: number | null;
  use_code: string;
  tax_status: string;
  action: AnomalyAction;
  anomaly_reason: string;
}

export interface ParcelFeature {
  type: 'Feature';
  geometry: GeoJsonPolygon | GeoJsonMultiPolygon;
  properties: ParcelProperties;
}

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface GeoJsonMultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

export interface ValuePerAcreGeoJSON {
  type: 'FeatureCollection';
  features: ParcelFeature[];
  metadata: {
    generated: string;
    source: string;
    filter: string;
    total_features: number;
    included: number;
    review: number;
  };
}

export interface AnomalyRecord {
  parcel_id: string;
  owner: string;
  address: string;
  acres: number | null;
  tax_value: number | null;
  value_per_acre: number | null;
  anomaly_flags: string[];
  anomaly_reason: string;
  action: AnomalyAction;
}

export interface ValuePerAcreAnomalies {
  generated: string;
  source: string;
  total_anomalies: number;
  iqr_low_threshold: number;
  iqr_high_threshold: number;
  iqr_multiplier: number;
  records: AnomalyRecord[];
}
