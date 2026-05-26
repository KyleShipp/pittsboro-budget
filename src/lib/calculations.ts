export function yoyChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export function perCapita(amount: number, population: number): number {
  return Math.round(amount / population);
}

export function calculateTaxBill(
  assessedValue: number,
  ratePerHundred: number,
  collectionRate: number
): number {
  return assessedValue * (ratePerHundred / 100) * collectionRate;
}

export function allocateTaxReceipt(
  totalTax: number,
  departments: Array<{ name: string; total: number }>,
  totalBudget: number
): Array<{ name: string; amount: number; share: number }> {
  return departments
    .map((dept) => {
      const share = dept.total / totalBudget;
      return {
        name: dept.name,
        amount: Math.round(totalTax * share * 100) / 100,
        share: share * 100,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Revenue-weighted tax receipt: only allocates property tax across the
 * portion of each department NOT covered by dedicated/restricted revenue.
 */
export function allocateTaxReceiptWeighted(
  totalTax: number,
  departments: Array<{ id: string; name: string; total: number }>,
  dedicatedRevenue: Record<string, { total: number }>,
): Array<{ name: string; amount: number; share: number; dedicated: number; unfunded: number }> {
  // Calculate each department's unfunded gap
  const depts = departments.map((dept) => {
    const dedicated = dedicatedRevenue[dept.id]?.total ?? 0;
    const unfunded = Math.max(0, dept.total - dedicated);
    return { ...dept, dedicated, unfunded };
  });

  const totalUnfunded = depts.reduce((sum, d) => sum + d.unfunded, 0);

  return depts
    .map((dept) => {
      const share = totalUnfunded > 0 ? dept.unfunded / totalUnfunded : 0;
      return {
        name: dept.name,
        amount: Math.round(totalTax * share * 100) / 100,
        share: share * 100,
        dedicated: dept.dedicated,
        unfunded: dept.unfunded,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}
