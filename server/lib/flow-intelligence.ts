export type EvidenceExpense = { id: number; expenseId: string; description: string; expenseDate: Date; baseCurrencyAmount: unknown; vendorId: number | null; invoiceNumber: string | null }
export type Signal = { id: string; title: string; severity: 'review' | 'information'; explanation: string; method: string; action: string; evidence: { label: string; href: string; amount: number; date: string }[]; evidenceCount: number }
const evidence = (row: EvidenceExpense) => ({ label: `${row.expenseId} · ${row.description}`, href: `/expenses?search=${encodeURIComponent(row.expenseId)}`, amount: Number(row.baseCurrencyAmount), date: row.expenseDate.toISOString() })

export function buildLedgerSignals(rows: EvidenceExpense[], now: Date): Signal[] {
  const signals: Signal[] = []
  const groups = new Map<string, EvidenceExpense[]>()
  for (const row of rows) {
    const invoice = row.invoiceNumber?.trim().toLowerCase()
    if (!invoice || row.vendorId === null) continue
    const key = JSON.stringify([row.vendorId, invoice, Number(row.baseCurrencyAmount)])
    groups.set(key, [...(groups.get(key) || []), row])
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue
    signals.push({ id: `duplicate-${group[0].id}`, title: 'Possible duplicate invoice', severity: 'review', explanation: `${group.length} active expenses share a vendor, invoice number, and base-currency amount. These may be legitimate split or repeated entries.`, method: 'Exact vendor + normalized invoice number + INR amount match within the 90-day review window.', action: 'Open the records and compare invoices before making any changes.', evidence: group.slice(0, 10).map(evidence), evidenceCount: group.length })
  }
  const recentStart = new Date(now.getTime() - 30 * 86400000)
  const history = rows.filter(row => row.expenseDate < recentStart && Number(row.baseCurrencyAmount) > 0).map(row => Number(row.baseCurrencyAmount)).sort((a, b) => a - b)
  if (history.length >= 10) {
    const middle = Math.floor(history.length / 2)
    const median = history.length % 2 ? history[middle] : (history[middle - 1] + history[middle]) / 2
    const outliers = rows.filter(row => row.expenseDate >= recentStart && Number(row.baseCurrencyAmount) >= Math.max(10000, median * 3)).sort((a, b) => Number(b.baseCurrencyAmount) - Number(a.baseCurrencyAmount))
    if (outliers.length) signals.push({ id: 'large-expenses', title: 'Large expenses to review', severity: 'review', explanation: `${outliers.length} recent expenses exceed the size threshold. A large amount is not proof of an error or fraud.`, method: `Recent 30 days compared with ${history.length} positive expenses from the preceding 60 days. Threshold: at least INR 10,000 and 3× the historical median (INR ${median.toFixed(2)}).`, action: 'Check the purpose and supporting invoice for each expense.', evidence: outliers.slice(0, 10).map(evidence), evidenceCount: outliers.length })
  }
  return signals
}
