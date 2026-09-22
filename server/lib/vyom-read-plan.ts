import { z } from 'zod'

export const vyomDataset = z.enum(['expenses', 'deposits', 'assets', 'subscriptions', 'projects', 'tasks', 'people', 'vendors', 'schedule', 'milestones', 'automations', 'insights'])
export const vyomReadPlanSchema = z.object({
  datasets: z.array(vyomDataset).max(8),
  filters: z.object({
    status: z.string().trim().max(40).optional(),
    project: z.string().trim().max(120).optional(),
    vendor: z.string().trim().max(120).optional(),
    assignee: z.string().trim().max(120).optional(),
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
    minAmount: z.number().nonnegative().max(1_000_000_000_000).optional(),
    maxAmount: z.number().nonnegative().max(1_000_000_000_000).optional(),
    limit: z.number().int().min(1).max(40).default(20),
  }).strict(),
  sensitiveRequested: z.boolean(),
}).strict().superRefine((plan, ctx) => {
  if (plan.filters.startDate && plan.filters.endDate && plan.filters.startDate > plan.filters.endDate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['filters', 'endDate'], message: 'End date must not be before start date' })
  if (plan.filters.minAmount != null && plan.filters.maxAmount != null && plan.filters.minAmount > plan.filters.maxAmount) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['filters', 'maxAmount'], message: 'Maximum amount must not be below minimum amount' })
})
export type VyomReadPlan = z.infer<typeof vyomReadPlanSchema>

const datasetTerms: [z.infer<typeof vyomDataset>, RegExp][] = [
  ['expenses', /\b(expense|expenses|spend|spending|costs?|invoice|ledger)\b/i],
  ['deposits', /\b(deposit|deposits|income|revenue|receipts?)\b/i],
  ['assets', /\b(asset|assets|equipment|inventory|warrant(?:y|ies))\b/i],
  ['subscriptions', /\b(subscription|subscriptions|renewal|renewals|billing)\b/i],
  ['projects', /\b(project|projects|delivery|deliverable|sprint)\b/i],
  ['tasks', /\b(task|tasks|taskboard|issue|issues|work item)\b/i],
  ['people', /\b(employee|employees|people|staff|team|department|headcount|attendance|leave)\b/i],
  ['vendors', /\b(vendor|vendors|supplier|suppliers)\b/i],
  ['schedule', /\b(schedule|event|events|meeting|meetings|calendar)\b/i],
  ['milestones', /\b(milestone|milestones|deadline|deadlines)\b/i],
  ['automations', /\b(automation|automations|rule|rules)\b/i],
  ['insights', /\b(insight|insights|risk|risks|attention)\b/i],
]
const sensitivePattern = /\b(password|credential|secret|api\s*key|token|bank\s*(?:account|details)|pan\s*(?:number|card)?|gstin|tax\s*(?:id|identifier)|salary|compensation|payroll|phone|email\s+address|serial\s*number|private\s+leave\s+reason)\b/i
const capture = (question: string, label: string) => question.match(new RegExp(`\\b${label}\\s+(?:is\\s+|named\\s+)?["“]?([a-z0-9][a-z0-9 &._-]{1,80})`, 'i'))?.[1]?.replace(/["”].*$/, '').replace(/\s+(?:with|where|and|from|between|status|after|before|over|under)\b.*$/i, '').trim()

export function buildVyomReadPlan(question: string): VyomReadPlan {
  const datasets = datasetTerms.filter(([, pattern]) => pattern.test(question)).map(([dataset]) => dataset)
  const status = question.match(/\b(?:status\s+)?(active|inactive|pending|approved|rejected|cancelled|expired|suspended|trial|backlog|todo|in_progress|review|blocked|done|open|complete|completed|paused|assigned|in_stock|under_repair|retired|lost)\b/i)?.[1]?.toLowerCase()
  const dates = [...question.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map(match => match[1])
  const minAmount = question.match(/\b(?:over|above|at least|minimum|min)\s+(?:inr|rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)\b/i)?.[1]
  const maxAmount = question.match(/\b(?:under|below|at most|maximum|max)\s+(?:inr|rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)\b/i)?.[1]
  return vyomReadPlanSchema.parse({
    datasets: [...new Set(datasets)].slice(0, 8),
    filters: {
      ...(status ? { status } : {}),
      ...(capture(question, 'project') ? { project: capture(question, 'project') } : {}),
      ...(capture(question, 'vendor') ? { vendor: capture(question, 'vendor') } : {}),
      ...(capture(question, 'assignee|assigned to') ? { assignee: capture(question, 'assignee|assigned to') } : {}),
      ...(dates[0] ? { startDate: dates[0] } : {}),
      ...(dates[1] ? { endDate: dates[1] } : {}),
      ...(minAmount ? { minAmount: Number(minAmount.replace(/,/g, '')) } : {}),
      ...(maxAmount ? { maxAmount: Number(maxAmount.replace(/,/g, '')) } : {}),
      limit: /\b(all|complete|every)\b/i.test(question) ? 40 : 20,
    },
    sensitiveRequested: sensitivePattern.test(question),
  })
}
