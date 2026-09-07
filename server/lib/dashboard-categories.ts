export type SpendCategory = { id: number; parentId: number | null; name: string; color: string; code: string }
export type CategorySpend = { categoryId: number; _sum: { baseCurrencyAmount: unknown } }

export function categoryBreakdownFor(spend: CategorySpend[], categories: SpendCategory[]) {
  const lookup = new Map(categories.map(category => [category.id, category]))
  const totals = new Map<number | null, { categoryId: number | null; category: string; code: string | null; color: string; amount: number }>()
  for (const row of spend) {
    let category = lookup.get(row.categoryId)
    const visited = new Set<number>()
    while (category?.parentId != null && !visited.has(category.id)) {
      visited.add(category.id)
      const parent = lookup.get(category.parentId)
      if (!parent || visited.has(parent.id)) break
      category = parent
    }
    const key = category?.id ?? null
    const total = totals.get(key) || { categoryId: key, category: category?.name || 'Uncategorized', code: category?.code ?? null, color: category?.color || '#64748b', amount: 0 }
    total.amount += Number(row._sum.baseCurrencyAmount) || 0
    totals.set(key, total)
  }
  return [...totals.values()].sort((a, b) => b.amount - a.amount)
}
