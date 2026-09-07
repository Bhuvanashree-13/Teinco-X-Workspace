type VendorSpend = { vendorId: number | null; expenseType: string; _sum: { baseCurrencyAmount: unknown }; _count: number }
export function vendorBreakdownFor(rows: VendorSpend[], vendors: { id: number; name: string }[]) {
  const lookup = new Map(vendors.map(vendor => [vendor.id, vendor.name]))
  const totals = new Map<string, { key: string; vendor: string; kind: 'vendor' | 'internal' | 'unassigned'; amount: number; transactions: number }>()
  for (const row of rows) {
    const kind = row.vendorId !== null ? 'vendor' : row.expenseType === 'salary' ? 'internal' : 'unassigned'
    const key = kind === 'vendor' ? `vendor-${row.vendorId}` : kind
    const vendor = kind === 'vendor' ? lookup.get(row.vendorId!) || `Unavailable vendor #${row.vendorId}` : kind === 'internal' ? 'Payroll / salaries' : 'No vendor assigned'
    const total = totals.get(key) || { key, vendor, kind, amount: 0, transactions: 0 }
    total.amount += Number(row._sum.baseCurrencyAmount) || 0
    total.transactions += row._count
    totals.set(key, total)
  }
  return [...totals.values()].sort((a, b) => b.amount - a.amount)
}
