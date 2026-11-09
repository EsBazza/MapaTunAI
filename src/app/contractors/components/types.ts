export type ContractorRisk = 'clean' | 'delayed' | 'high';
export type RiskFilter = 'all' | ContractorRisk;
export type ContractorSortField = 'totalValuePHP' | 'totalContracts' | 'overdueCount' | 'avgProgress';

export interface Contractor {
  id: string;
  name: string;
  totalContracts: number;
  totalValuePHP: number;
  avgProgress: number;
  overdueCount: number;
  terminatedCount: number;
}

export interface ContractorCounts {
  all: number;
  clean: number;
  delayed: number;
  high: number;
}

export interface ContractorListResponse {
  contractors: Contractor[];
  counts: ContractorCounts;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ContractorProject {
  id: string;
  name: string;
  budgetPHP: number;
  progress: number;
  status: string;
  province?: { name: string; region?: { name: string } | null } | null;
}

/** Must mirror RISK_WHERE in src/app/api/contractors/route.ts. */
const HIGH_DELAY_THRESHOLD = 3;

export function getContractorRisk(c: Pick<Contractor, 'overdueCount' | 'terminatedCount'>): ContractorRisk {
  if (c.overdueCount > HIGH_DELAY_THRESHOLD || c.terminatedCount > 0) return 'high';
  if (c.overdueCount > 0) return 'delayed';
  return 'clean';
}

export const RISK_LABELS: Record<ContractorRisk, string> = {
  clean: 'No delays on record',
  delayed: 'Some late projects',
  high: 'Many late or cancelled',
};
