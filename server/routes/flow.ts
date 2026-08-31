import { Router } from 'express'
import { addMonths, endOfMonth, startOfMonth, subMonths } from 'date-fns'
import { prisma } from '../db.js'

const router = Router()
const toNumber = (value: unknown) => Number(value) || 0

const nextCode = async (prefix: string, count: () => Promise<number>) => {
  const year = new Date().getFullYear()
  const currentCount = await count()
  return `${prefix}-${year}-${String(currentCount + 1).padStart(6, '0')}`
}

async function getModuleSnapshot() {
  const now = new Date()
  const currentMonthStart = startOfMonth(now)
  const currentMonthEnd = endOfMonth(now)
  const previousMonthStart = startOfMonth(subMonths(now, 1))
  const previousMonthEnd = endOfMonth(subMonths(now, 1))
  const nextMonthEnd = endOfMonth(addMonths(now, 1))

  const [
    currentMonthSpend,
    previousMonthSpend,
    recurringMonthly,
    activeEmployees,
    pendingLeave,
    monthlyPeopleCost,
    activeProjects,
    openMilestones,
    urgentMilestones,
    upcomingEvents,
    activeRules,
    openInsights,
  ] = await Promise.all([
    prisma.expense.aggregate({
      where: { status: 'active', expenseDate: { gte: currentMonthStart, lte: currentMonthEnd } },
      _sum: { baseCurrencyAmount: true },
    }),
    prisma.expense.aggregate({
      where: { status: 'active', expenseDate: { gte: previousMonthStart, lte: previousMonthEnd } },
      _sum: { baseCurrencyAmount: true },
    }),
    prisma.expense.aggregate({
      where: { status: 'active', isRecurring: true, frequency: 'monthly' },
      _sum: { baseCurrencyAmount: true },
    }),
    prisma.employee.count({ where: { status: 'active', isArchived: false } }),
    prisma.leaveRequest.count({ where: { status: 'pending' } }),
    prisma.employee.aggregate({
      where: { status: 'active', isArchived: false },
      _sum: { monthlyCost: true },
    }),
    prisma.project.count({ where: { status: 'active' } }),
    prisma.scheduleMilestone.count({ where: { status: 'open' } }),
    prisma.scheduleMilestone.count({ where: { status: 'open', priority: 'urgent', dueAt: { lte: nextMonthEnd } } }),
    prisma.scheduleEvent.count({
      where: { status: 'scheduled', startsAt: { gte: now, lte: nextMonthEnd } },
    }),
    prisma.flowAutomationRule.count({ where: { status: 'active' } }),
    prisma.executiveInsight.count({ where: { status: 'open' } }),
  ])

  const currentSpend = toNumber(currentMonthSpend._sum.baseCurrencyAmount)
  const previousSpend = toNumber(previousMonthSpend._sum.baseCurrencyAmount)
  const spendDelta = previousSpend ? ((currentSpend - previousSpend) / previousSpend) * 100 : 0
  const peopleCost = toNumber(monthlyPeopleCost._sum.monthlyCost)
  const recurringCommitment = toNumber(recurringMonthly._sum.baseCurrencyAmount)
  const operatingBurn = currentSpend + peopleCost + recurringCommitment

  return {
    ledger: {
      currentMonthSpend: currentSpend,
      previousMonthSpend: previousSpend,
      spendDelta,
      recurringMonthlyCommitment: recurringCommitment,
      operatingBurn,
    },
    people: {
      activeEmployees,
      pendingLeave,
      monthlyPeopleCost: peopleCost,
      costPerEmployee: activeEmployees ? peopleCost / activeEmployees : 0,
    },
    schedule: {
      activeProjects,
      openMilestones,
      urgentMilestones,
      upcomingEvents,
    },
    flow: {
      activeRules,
      openInsights,
    },
  }
}

function buildComputedInsights(snapshot: Awaited<ReturnType<typeof getModuleSnapshot>>) {
  const insights = []

  if (snapshot.ledger.spendDelta > 25) {
    insights.push({
      insightId: 'AUTO-SPEND-DELTA',
      title: 'Expense velocity increased materially month over month',
      severity: 'urgent',
      sourceModule: 'ledger',
      rootCause: `Ledger spend is ${snapshot.ledger.spendDelta.toFixed(1)}% above the previous month while recurring commitments remain active.`,
      recommendedAction: 'Review top categories and pause non-critical vendor spend before approving new commitments.',
      status: 'open',
    })
  }

  if (snapshot.people.activeEmployees === 0 && snapshot.schedule.openMilestones > 0) {
    insights.push({
      insightId: 'AUTO-MILESTONE-STAFFING',
      title: 'Open milestones have no active workforce assigned',
      severity: 'urgent',
      sourceModule: 'people',
      rootCause: `Schedule has ${snapshot.schedule.openMilestones} open milestones, but People has no active employees.`,
      recommendedAction: 'Add responsible employees or pause delivery commitments until owners are assigned.',
      status: 'open',
    })
  }

  if (snapshot.schedule.urgentMilestones > 0 && snapshot.people.pendingLeave > 0) {
    insights.push({
      insightId: 'AUTO-LEAVE-MILESTONE-RISK',
      title: 'Pending leave may affect urgent milestone coverage',
      severity: 'standard',
      sourceModule: 'schedule',
      rootCause: `${snapshot.people.pendingLeave} leave requests are pending while ${snapshot.schedule.urgentMilestones} urgent milestones are due soon.`,
      recommendedAction: 'Approve leave with coverage notes or rebalance milestone owners before final approval.',
      status: 'open',
    })
  }

  if (snapshot.ledger.operatingBurn === 0 && snapshot.people.activeEmployees === 0 && snapshot.schedule.openMilestones === 0) {
    insights.push({
      insightId: 'AUTO-EMPTY-WORKSPACE',
      title: 'Workspace is ready for operating data',
      severity: 'informational',
      sourceModule: 'flow',
      rootCause: 'Ledger, People, and Schedule currently have no active operating records.',
      recommendedAction: 'Add real expenses, employees, calendar events, or milestones to activate executive forecasting.',
      status: 'open',
    })
  }

  return insights
}

router.get('/overview', async (_req, res) => {
  try {
    const snapshot = await getModuleSnapshot()
    const computedInsights = buildComputedInsights(snapshot)
    const riskScore = Math.min(100, computedInsights.reduce((score, insight) => {
      if (insight.severity === 'urgent') return score + 30
      if (insight.severity === 'standard') return score + 15
      return score + 5
    }, 0))

    res.json({
      generatedAt: new Date().toISOString(),
      modules: snapshot,
      riskScore,
      topInsights: computedInsights.slice(0, 4),
      executiveActions: computedInsights.map(insight => ({
        priority: insight.severity,
        action: insight.recommendedAction,
        source: insight.sourceModule,
      })),
    })
  } catch (error) {
    console.error('Flow overview error:', error)
    res.status(500).json({ error: 'Failed to load Flow overview' })
  }
})

router.get('/insights', async (_req, res) => {
  try {
    const [snapshot, storedInsights] = await Promise.all([
      getModuleSnapshot(),
      prisma.executiveInsight.findMany({ orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }] }),
    ])
    res.json([...buildComputedInsights(snapshot), ...storedInsights])
  } catch (error) {
    console.error('Flow insights error:', error)
    res.status(500).json({ error: 'Failed to load executive insights' })
  }
})

router.post('/insights', async (req, res) => {
  try {
    const data = req.body
    const year = new Date().getFullYear()
    const insightId = await nextCode('INS', () => prisma.executiveInsight.count({ where: { insightId: { startsWith: `INS-${year}` } } }))
    const insight = await prisma.executiveInsight.create({
      data: {
        insightId,
        title: data.title,
        severity: data.severity || 'standard',
        sourceModule: data.sourceModule || 'flow',
        rootCause: data.rootCause,
        recommendedAction: data.recommendedAction,
      },
    })
    res.json(insight)
  } catch (error) {
    console.error('Create insight error:', error)
    res.status(500).json({ error: 'Failed to create executive insight' })
  }
})

router.put('/insights/:id/status', async (req, res) => {
  try {
    const insight = await prisma.executiveInsight.update({
      where: { id: Number(req.params.id) },
      data: { status: req.body.status },
    })
    res.json(insight)
  } catch (error) {
    console.error('Update insight error:', error)
    res.status(500).json({ error: 'Failed to update executive insight' })
  }
})

router.get('/automation-rules', async (_req, res) => {
  try {
    const rules = await prisma.flowAutomationRule.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }] })
    res.json(rules)
  } catch (error) {
    console.error('Automation rules error:', error)
    res.status(500).json({ error: 'Failed to load automation rules' })
  }
})

router.post('/automation-rules', async (req, res) => {
  try {
    const data = req.body
    const year = new Date().getFullYear()
    const ruleId = await nextCode('AUT', () => prisma.flowAutomationRule.count({ where: { ruleId: { startsWith: `AUT-${year}` } } }))
    const rule = await prisma.flowAutomationRule.create({
      data: {
        ruleId,
        name: data.name,
        triggerModule: data.triggerModule || 'flow',
        triggerEvent: data.triggerEvent,
        actionModule: data.actionModule || 'schedule',
        actionSummary: data.actionSummary,
        priority: data.priority || 'standard',
        notes: data.notes || null,
      },
    })
    res.json(rule)
  } catch (error) {
    console.error('Create automation rule error:', error)
    res.status(500).json({ error: 'Failed to create automation rule' })
  }
})

router.put('/automation-rules/:id/status', async (req, res) => {
  try {
    const data: any = { status: req.body.status }
    if (req.body.status === 'active') data.lastRunAt = new Date()
    const rule = await prisma.flowAutomationRule.update({
      where: { id: Number(req.params.id) },
      data,
    })
    res.json(rule)
  } catch (error) {
    console.error('Update automation rule error:', error)
    res.status(500).json({ error: 'Failed to update automation rule' })
  }
})

router.get('/forecast', async (_req, res) => {
  try {
    const snapshot = await getModuleSnapshot()
    const scenarios = await prisma.forecastScenario.findMany({ orderBy: { createdAt: 'desc' } })
    const baselineBurn = snapshot.ledger.operatingBurn || snapshot.people.monthlyPeopleCost || snapshot.ledger.currentMonthSpend
    const horizonMonths = 6
    const projectedBurn = baselineBurn * horizonMonths
    const projectedHeadcount = snapshot.people.activeEmployees
    const staffingPressure = snapshot.schedule.openMilestones > 0 && projectedHeadcount === 0
      ? 'high'
      : snapshot.schedule.openMilestones > projectedHeadcount * 3
        ? 'medium'
        : 'low'

    res.json({
      baseline: {
        horizonMonths,
        monthlyBurn: baselineBurn,
        projectedBurn,
        projectedHeadcount,
        staffingPressure,
        confidence: baselineBurn > 0 || projectedHeadcount > 0 ? 'medium' : 'low',
      },
      scenarios: scenarios.map(scenario => {
        const monthlyBurn = toNumber(scenario.assumedMonthlyBurn) || baselineBurn
        const monthlyRevenue = toNumber(scenario.assumedMonthlyRevenue)
        const netBurn = Math.max(monthlyBurn - monthlyRevenue, 0)
        return {
          ...scenario,
          assumedMonthlyRevenue: monthlyRevenue,
          assumedMonthlyBurn: monthlyBurn,
          projectedNetBurn: netBurn * scenario.horizonMonths,
          projectedHeadcount: Math.max(projectedHeadcount + scenario.plannedHeadcountChange, 0),
        }
      }),
    })
  } catch (error) {
    console.error('Flow forecast error:', error)
    res.status(500).json({ error: 'Failed to load forecast' })
  }
})

router.post('/forecast-scenarios', async (req, res) => {
  try {
    const data = req.body
    const year = new Date().getFullYear()
    const scenarioId = await nextCode('FRC', () => prisma.forecastScenario.count({ where: { scenarioId: { startsWith: `FRC-${year}` } } }))
    const scenario = await prisma.forecastScenario.create({
      data: {
        scenarioId,
        name: data.name,
        horizonMonths: Number(data.horizonMonths) || 6,
        assumedMonthlyRevenue: Number(data.assumedMonthlyRevenue) || 0,
        assumedMonthlyBurn: Number(data.assumedMonthlyBurn) || 0,
        plannedHeadcountChange: Number(data.plannedHeadcountChange) || 0,
        confidence: data.confidence || 'medium',
        notes: data.notes || null,
      },
    })
    res.json(scenario)
  } catch (error) {
    console.error('Create forecast scenario error:', error)
    res.status(500).json({ error: 'Failed to create forecast scenario' })
  }
})

export default router
