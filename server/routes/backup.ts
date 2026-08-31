import { Router } from 'express'
import { prisma } from '../db.js'
import fs from 'fs-extra'
import path from 'path'
import { format } from 'date-fns'
import { requireAdmin, requireAuth } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth, requireAdmin)

router.post('/create', async (req, res) => {
  try {
    const backupSettings = await prisma.settings.findFirst()
    const backupDir = backupSettings?.backupPath || './backups'
    await fs.ensureDir(backupDir)

    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm')
    const fileName = `teincox_finance_backup_${timestamp}.json`
    const backupPath = path.join(backupDir, fileName)
    const [
      settings,
      categories,
      vendors,
      projects,
      costCenters,
      paymentMethods,
      currencies,
      exchangeRates,
      expenses,
      subscriptions,
      employees,
      scheduleEvents,
      scheduleMilestones,
      flowAutomationRules,
      forecastScenarios,
      executiveInsights,
      leaveRequests,
      attendanceLogs,
      lifecycleTasks,
      payrollBatches,
      assets,
      budgets,
    ] = await Promise.all([
      prisma.settings.findMany(),
      prisma.expenseCategory.findMany(),
      prisma.vendor.findMany(),
      prisma.project.findMany(),
      prisma.costCenter.findMany(),
      prisma.paymentMethod.findMany(),
      prisma.currency.findMany(),
      prisma.exchangeRate.findMany(),
      prisma.expense.findMany({ include: { attachments: true } }),
      prisma.subscription.findMany(),
      prisma.employee.findMany(),
      prisma.scheduleEvent.findMany(),
      prisma.scheduleMilestone.findMany(),
      prisma.flowAutomationRule.findMany(),
      prisma.forecastScenario.findMany(),
      prisma.executiveInsight.findMany(),
      prisma.leaveRequest.findMany(),
      prisma.attendanceLog.findMany(),
      prisma.lifecycleTask.findMany(),
      prisma.payrollBatch.findMany({ include: { employees: true } }),
      prisma.asset.findMany(),
      prisma.budget.findMany(),
    ])

    await fs.writeJson(
      backupPath,
      {
        createdAt: new Date().toISOString(),
        engine: 'mysql',
        data: {
          settings,
          categories,
          vendors,
          projects,
          costCenters,
          paymentMethods,
          currencies,
          exchangeRates,
          expenses,
          subscriptions,
          employees,
          scheduleEvents,
          scheduleMilestones,
          flowAutomationRules,
          forecastScenarios,
          executiveInsights,
          leaveRequests,
          attendanceLogs,
          lifecycleTasks,
          payrollBatches,
          assets,
          budgets,
        },
      },
      { spaces: 2 }
    )
    const stats = await fs.stat(backupPath)
    const expenseCount = await prisma.expense.count()

    const record = await prisma.backupRecord.create({
      data: {
        fileName,
        filePath: backupPath,
        fileSize: stats.size,
        expenseCount,
        isAuto: false
      }
    })

    res.json({ success: true, backup: record })
  } catch (error) {
    res.status(500).json({ error: 'Backup failed' })
  }
})

router.get('/list', async (req, res) => {
  try {
    const backups = await prisma.backupRecord.findMany({ orderBy: { createdAt: 'desc' } })
    res.json(backups)
  } catch (error) {
    res.status(500).json({ error: 'Failed to list backups' })
  }
})

export default router
