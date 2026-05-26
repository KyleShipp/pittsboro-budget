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
