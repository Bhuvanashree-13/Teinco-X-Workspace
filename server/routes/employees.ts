import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { endOfDay, endOfYear, format, startOfDay, startOfYear } from 'date-fns'
import { prisma } from '../db.js'
import { isAdmin, requireAdmin, requireAuth, type AuthedRequest } from '../middleware/auth.js'

const router = Router()
const PENDING_EMPLOYEE_PASSWORD_PREFIX = 'pending-employee-password:'

const toNumber = (value: unknown) => Number(value) || 0

const serializeEmployee = (employee: any) => ({
  ...employee,
  monthlyCost: toNumber(employee.monthlyCost),
  annualCost: toNumber(employee.annualCost),
  annualPtoDays: toNumber(employee.annualPtoDays),
})

const serializeLeave = (request: any) => ({
  ...request,
  days: toNumber(request.days),
  employee: request.employee ? serializeEmployee(request.employee) : request.employee,
})

const serializeAttendance = (log: any) => ({
  ...log,
  regularHours: toNumber(log.regularHours),
  overtimeHours: toNumber(log.overtimeHours),
  employee: log.employee ? serializeEmployee(log.employee) : log.employee,
})

const serializePayrollBatch = (batch: any) => ({
  ...batch,
  grossPay: toNumber(batch.grossPay),
  approvedExpenses: toNumber(batch.approvedExpenses),
  bonuses: toNumber(batch.bonuses),
  deductions: toNumber(batch.deductions),
  netPay: toNumber(batch.netPay),
  employees: batch.employees?.map((line: any) => ({
    ...line,
    basePay: toNumber(line.basePay),
    expenseReimbursements: toNumber(line.expenseReimbursements),
    bonus: toNumber(line.bonus),
    deductions: toNumber(line.deductions),
    netPay: toNumber(line.netPay),
    employee: line.employee ? serializeEmployee(line.employee) : line.employee,
  })),
})

const serializePayslip = (line: any) => {
  const basePay = toNumber(line.basePay)
  const reimbursements = toNumber(line.expenseReimbursements)
  const bonus = toNumber(line.bonus)
  const deductions = toNumber(line.deductions)
  const totalEarnings = basePay + reimbursements + bonus

  return {
    id: line.id,
    slipId: `${line.payrollBatch.batchId}-${line.employee.employeeId}`,
    batchId: line.payrollBatch.batchId,
    periodStart: line.payrollBatch.periodStart,
    periodEnd: line.payrollBatch.periodEnd,
    status: line.payrollBatch.status,
    issueDate: line.payrollBatch.updatedAt,
    notes: line.payrollBatch.notes,
    paymentUtr: line.paymentUtr ?? null,
    employee: serializeEmployee(line.employee),
    earnings: [
      { label: 'Base pay', amount: basePay },
      { label: 'Expense reimbursement', amount: reimbursements },
      { label: 'Bonus', amount: bonus },
    ].filter(item => item.amount > 0 || item.label === 'Base pay'),
    deductions: [{ label: 'Payroll deductions', amount: deductions }],
    totalEarnings,
    totalDeductions: deductions,
    netPay: toNumber(line.netPay),
  }
}

const calculatePayrollSnapshot = async (periodStart: Date, periodEnd: Date) => {
  const activeEmployees = await prisma.employee.findMany({
    where: { status: 'active', isArchived: false },
    orderBy: { name: 'asc' },
  })
  const approvedExpenses = await prisma.expense.aggregate({
    where: {
      status: 'active',
      expenseType: 'reimbursement',
      expenseDate: { gte: periodStart, lte: periodEnd },
    },
    _sum: { baseCurrencyAmount: true },
  })
  const grossPay = activeEmployees.reduce((sum, employee) => sum + toNumber(employee.monthlyCost), 0)
  const reimbursements = toNumber(approvedExpenses._sum.baseCurrencyAmount)

  return { activeEmployees, grossPay, reimbursements }
}

const syncPayrollSalaryExpense = async (payrollBatchId: number) => {
  const batch = await prisma.payrollBatch.findUnique({ where: { id: payrollBatchId } })
  if (!batch) return

  const salaryCategory = await prisma.expenseCategory.findFirst({
    where: { code: 'SALARIES', isActive: true, isArchived: false },
  })
  if (!salaryCategory) throw new Error('The Salaries expense category is not configured')

  // Reimbursements are already represented by their original expense records.
  // Gross pay plus bonuses is the employer's salary expense for this payroll period.
  const salaryAmount = Math.max(0, toNumber(batch.grossPay) + toNumber(batch.bonuses))
  const description = `Employee salaries — ${format(batch.periodStart, 'MMM yyyy')} (${batch.batchId})`
  const existingExpense = await prisma.expense.findFirst({ where: { payrollBatchId } })

  if (existingExpense) {
    await prisma.expense.update({
      where: { id: existingExpense.id },
      data: {
        expenseDate: batch.periodEnd,
        description,
        categoryId: salaryCategory.id,
        expenseType: 'salary',
        baseAmount: salaryAmount,
        gstRate: 0,
        gstAmount: 0,
        totalAmount: salaryAmount,
        originalAmount: salaryAmount,
        exchangeRate: 1,
        baseCurrencyAmount: salaryAmount,
        notes: batch.notes,
        status: 'active',
      },
    })
    return
  }

  const year = new Date().getFullYear()
  const expenseCount = await prisma.expense.count({ where: { expenseId: { startsWith: `EXP-${year}` } } })
  await prisma.expense.create({
    data: {
      expenseId: `EXP-${year}-${String(expenseCount + 1).padStart(6, '0')}`,
      expenseDate: batch.periodEnd,
      description,
      categoryId: salaryCategory.id,
      expenseType: 'salary',
      payrollBatchId: batch.id,
      baseAmount: salaryAmount,
      gstRate: 0,
      gstAmount: 0,
      totalAmount: salaryAmount,
      originalCurrency: 'INR',
      originalAmount: salaryAmount,
      exchangeRate: 1,
      baseCurrency: 'INR',
      baseCurrencyAmount: salaryAmount,
      businessPurpose: 'Employee payroll',
      notes: batch.notes,
      status: 'active',
    },
  })
}

router.use(requireAuth)

const requireLinkedEmployee = (req: AuthedRequest, res: any) => {
  if (!req.user?.employeeId) {
    res.status(403).json({ error: 'Employee login is not linked to an employee profile' })
    return null
  }
  return req.user.employeeId
}

router.get('/', async (req: AuthedRequest, res) => {
  try {
    const { status = 'active', search, department } = req.query
    const where: any = { isArchived: false }

    if (isAdmin(req)) {
      if (status !== 'all') where.status = status as string
      if (department && department !== 'all') where.department = department as string
    } else {
      const employeeId = requireLinkedEmployee(req, res)
      if (!employeeId) return
      where.id = employeeId
    }

    if (isAdmin(req) && search) {
      where.OR = [
        { name: { contains: search as string } },
        { employeeId: { contains: search as string } },
        { email: { contains: search as string } },
        { role: { contains: search as string } },
      ]
    }

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        leaveRequests: { where: { status: 'pending' }, select: { id: true } },
        attendanceLogs: { orderBy: { workDate: 'desc' }, take: 1 },
        lifecycleTasks: { where: { status: { not: 'complete' } }, select: { id: true } },
        user: { select: { id: true, email: true, role: true, isActive: true, lastLogin: true, createdAt: true } },
      },
    })

    res.json(employees.map(serializeEmployee))
  } catch (error) {
    console.error('Employees list error:', error)
    res.status(500).json({ error: 'Failed to load employees' })
  }
})

router.get('/summary', async (req: AuthedRequest, res) => {
  try {
    if (!isAdmin(req)) {
      const employeeId = requireLinkedEmployee(req, res)
      if (!employeeId) return
      const today = new Date()
      const todayStart = startOfDay(today)
      const todayEnd = endOfDay(today)
      const [employee, attendanceToday, pendingLeave] = await Promise.all([
        prisma.employee.findUnique({ where: { id: employeeId } }),
        prisma.attendanceLog.groupBy({
          by: ['status'],
          where: { employeeId, workDate: { gte: todayStart, lte: todayEnd } },
          _count: true,
        }),
        prisma.leaveRequest.count({ where: { employeeId, status: 'pending' } }),
      ])

      return res.json({
        headcount: employee ? 1 : 0,
        onLeaveCount: employee?.status === 'on_leave' ? 1 : 0,
        contractorCount: employee?.employmentType === 'contractor' ? 1 : 0,
        monthlyPeopleCost: 0,
        annualPeopleCost: 0,
        pendingLeave,
        usedPtoDays: 0,
        attendanceToday: attendanceToday.map(item => ({ status: item.status, count: item._count })),
        openLifecycleTasks: 0,
        latestPayrollBatch: null,
        byDepartment: [],
        privacy: {
          compensationAccess: 'restricted',
          visibleTo: ['HR administrators', 'direct managers'],
        },
      })
    }

    const today = new Date()
    const todayStart = startOfDay(today)
    const todayEnd = endOfDay(today)
    const yearStart = startOfYear(today)
    const yearEnd = endOfYear(today)

    const [
      employees,
      byDepartment,
      pendingLeave,
      approvedLeave,
      attendanceToday,
      openLifecycleTasks,
      latestPayrollBatch,
    ] = await Promise.all([
      prisma.employee.findMany({ where: { isArchived: false } }),
      prisma.employee.groupBy({
        by: ['department'],
        where: { status: 'active', isArchived: false },
        _sum: { monthlyCost: true, annualCost: true },
        _count: true,
      }),
      prisma.leaveRequest.count({ where: { status: 'pending' } }),
      prisma.leaveRequest.groupBy({
        by: ['employeeId'],
        where: {
          status: 'approved',
          leaveType: 'paid_time_off',
          startDate: { gte: yearStart, lte: yearEnd },
        },
        _sum: { days: true },
      }),
      prisma.attendanceLog.groupBy({
        by: ['status'],
        where: { workDate: { gte: todayStart, lte: todayEnd } },
        _count: true,
      }),
      prisma.lifecycleTask.count({ where: { status: { not: 'complete' } } }),
      prisma.payrollBatch.findFirst({ orderBy: { createdAt: 'desc' } }),
    ])

    const activeEmployees = employees.filter(employee => employee.status === 'active')
    const onLeaveEmployees = employees.filter(employee => employee.status === 'on_leave')
    const contractorEmployees = employees.filter(employee => employee.employmentType === 'contractor')
    const usedPtoDays = approvedLeave.reduce((sum, request) => sum + toNumber(request._sum.days), 0)

    res.json({
      headcount: activeEmployees.length,
      onLeaveCount: onLeaveEmployees.length,
      contractorCount: contractorEmployees.length,
      monthlyPeopleCost: activeEmployees.reduce((sum, employee) => sum + toNumber(employee.monthlyCost), 0),
      annualPeopleCost: activeEmployees.reduce((sum, employee) => sum + toNumber(employee.annualCost), 0),
      pendingLeave,
      usedPtoDays,
      attendanceToday: attendanceToday.map(item => ({ status: item.status, count: item._count })),
      openLifecycleTasks,
      latestPayrollBatch: latestPayrollBatch ? serializePayrollBatch(latestPayrollBatch) : null,
      byDepartment: byDepartment.map(item => ({
        department: item.department || 'Unassigned',
        count: item._count,
        monthlyCost: toNumber(item._sum.monthlyCost),
        annualCost: toNumber(item._sum.annualCost),
      })),
      privacy: {
        compensationAccess: 'restricted',
        visibleTo: ['HR administrators', 'direct managers'],
      },
    })
  } catch (error) {
    console.error('Employee summary error:', error)
    res.status(500).json({ error: 'Failed to load employee summary' })
  }
})

router.get('/leave', async (req: AuthedRequest, res) => {
  try {
    const { status = 'all' } = req.query
    const where: any = status !== 'all' ? { status: status as string } : {}
    if (!isAdmin(req)) {
      const employeeId = requireLinkedEmployee(req, res)
      if (!employeeId) return
      where.employeeId = employeeId
    }
    const requests = await prisma.leaveRequest.findMany({
      where,
      include: { employee: true },
      orderBy: { startDate: 'desc' },
    })
    res.json(requests.map(serializeLeave))
  } catch (error) {
    console.error('Leave list error:', error)
    res.status(500).json({ error: 'Failed to load leave requests' })
  }
})

router.get('/leave/balances', async (req: AuthedRequest, res) => {
  try {
    const yearStart = startOfYear(new Date())
    const yearEnd = endOfYear(new Date())
    const employeeWhere = isAdmin(req)
      ? { isArchived: false }
      : { id: requireLinkedEmployee(req, res) || -1, isArchived: false }
    if (!isAdmin(req) && employeeWhere.id === -1) return
    const [employees, approvedLeave] = await Promise.all([
      prisma.employee.findMany({ where: employeeWhere, orderBy: { name: 'asc' } }),
      prisma.leaveRequest.groupBy({
        by: ['employeeId'],
        where: {
          status: 'approved',
          leaveType: 'paid_time_off',
          startDate: { gte: yearStart, lte: yearEnd },
        },
        _sum: { days: true },
      }),
    ])
    const usedByEmployee = new Map(approvedLeave.map(item => [item.employeeId, toNumber(item._sum.days)]))

    res.json(employees.map(employee => {
      const allowance = toNumber(employee.annualPtoDays)
      const used = usedByEmployee.get(employee.id) || 0
      return {
        employeeId: employee.id,
        employeeCode: employee.employeeId,
        name: employee.name,
        department: employee.department,
        allowance,
        used,
        balance: Math.max(allowance - used, 0),
      }
    }))
  } catch (error) {
    console.error('Leave balance error:', error)
    res.status(500).json({ error: 'Failed to load PTO balances' })
  }
})

router.post('/leave', async (req: AuthedRequest, res) => {
  try {
    const data = req.body
    const employeeId = isAdmin(req) ? Number(data.employeeId) : requireLinkedEmployee(req, res)
    if (!employeeId) return
    const year = new Date().getFullYear()
    const count = await prisma.leaveRequest.count({ where: { requestId: { startsWith: `PTO-${year}` } } })
    const leave = await prisma.leaveRequest.create({
      data: {
        requestId: `PTO-${year}-${String(count + 1).padStart(6, '0')}`,
        employeeId,
        leaveType: data.leaveType || 'paid_time_off',
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        days: Number(data.days) || 1,
        reason: data.reason || null,
        approverName: data.approverName || null,
        blackoutChecked: Boolean(data.blackoutChecked),
      },
      include: { employee: true },
    })
    res.json(serializeLeave(leave))
  } catch (error) {
    console.error('Create leave error:', error)
    res.status(500).json({ error: 'Failed to create leave request' })
  }
})

router.put('/leave/:id/status', requireAdmin, async (req, res) => {
  try {
    const leave = await prisma.leaveRequest.update({
      where: { id: Number(req.params.id) },
      data: {
        status: req.body.status,
        approverName: req.body.approverName || null,
        blackoutChecked: Boolean(req.body.blackoutChecked),
      },
      include: { employee: true },
    })
    res.json(serializeLeave(leave))
  } catch (error) {
    console.error('Update leave error:', error)
    res.status(500).json({ error: 'Failed to update leave request' })
  }
})

router.get('/attendance', async (req: AuthedRequest, res) => {
  try {
    const workDate = req.query.date ? new Date(`${req.query.date}T00:00:00`) : new Date()
    const where: any = { workDate: { gte: startOfDay(workDate), lte: endOfDay(workDate) } }
    if (!isAdmin(req)) {
      const employeeId = requireLinkedEmployee(req, res)
      if (!employeeId) return
      where.employeeId = employeeId
    }
    const logs = await prisma.attendanceLog.findMany({
      where,
      include: { employee: true },
      orderBy: { employee: { name: 'asc' } },
    })
    res.json(logs.map(serializeAttendance))
  } catch (error) {
    console.error('Attendance list error:', error)
    res.status(500).json({ error: 'Failed to load attendance logs' })
  }
})

router.post('/attendance', async (req: AuthedRequest, res) => {
  try {
    const data = req.body
    const employeeId = isAdmin(req) ? Number(data.employeeId) : requireLinkedEmployee(req, res)
    if (!employeeId) return
    const workDate = startOfDay(new Date(data.workDate))
    const log = await prisma.attendanceLog.upsert({
      where: { employeeId_workDate: { employeeId, workDate } },
      update: {
        checkIn: data.checkIn ? new Date(data.checkIn) : null,
        checkOut: data.checkOut ? new Date(data.checkOut) : null,
        workMode: data.workMode || 'office',
        geoFenceStatus: data.geoFenceStatus || 'not_required',
        regularHours: Number(data.regularHours) || 0,
        overtimeHours: Number(data.overtimeHours) || 0,
        status: data.status || 'present',
        notes: data.notes || null,
      },
      create: {
        employeeId,
        workDate,
        checkIn: data.checkIn ? new Date(data.checkIn) : null,
        checkOut: data.checkOut ? new Date(data.checkOut) : null,
        workMode: data.workMode || 'office',
        geoFenceStatus: data.geoFenceStatus || 'not_required',
        regularHours: Number(data.regularHours) || 0,
        overtimeHours: Number(data.overtimeHours) || 0,
        status: data.status || 'present',
        notes: data.notes || null,
      },
      include: { employee: true },
    })
    res.json(serializeAttendance(log))
  } catch (error) {
    console.error('Create attendance error:', error)
    res.status(500).json({ error: 'Failed to record attendance' })
  }
})

router.get('/lifecycle', requireAdmin, async (req, res) => {
  try {
    const { status = 'all', taskType = 'all' } = req.query
    const where: any = {}
    if (status !== 'all') where.status = status as string
    if (taskType !== 'all') where.taskType = taskType as string
    const tasks = await prisma.lifecycleTask.findMany({
      where,
      include: { employee: true },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    })
    res.json(tasks)
  } catch (error) {
    console.error('Lifecycle list error:', error)
    res.status(500).json({ error: 'Failed to load lifecycle tasks' })
  }
})

router.post('/lifecycle', requireAdmin, async (req, res) => {
  try {
    const data = req.body
    const year = new Date().getFullYear()
    const count = await prisma.lifecycleTask.count({ where: { taskId: { startsWith: `HR-${year}` } } })
    const task = await prisma.lifecycleTask.create({
      data: {
        taskId: `HR-${year}-${String(count + 1).padStart(6, '0')}`,
        employeeId: data.employeeId ? Number(data.employeeId) : null,
        taskType: data.taskType || 'onboarding',
        ownerTeam: data.ownerTeam || 'HR',
        title: data.title,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        checklist: data.checklist || null,
      },
      include: { employee: true },
    })
    res.json(task)
  } catch (error) {
    console.error('Create lifecycle task error:', error)
    res.status(500).json({ error: 'Failed to create lifecycle task' })
  }
})

router.put('/lifecycle/:id', requireAdmin, async (req, res) => {
  try {
    const status = req.body.status
    const task = await prisma.lifecycleTask.update({
      where: { id: Number(req.params.id) },
      data: {
        status,
        completedAt: status === 'complete' ? new Date() : null,
      },
      include: { employee: true },
    })
    res.json(task)
  } catch (error) {
    console.error('Update lifecycle task error:', error)
    res.status(500).json({ error: 'Failed to update lifecycle task' })
  }
})

router.get('/payslips', async (req: AuthedRequest, res) => {
  try {
    const employeeId = isAdmin(req) ? null : requireLinkedEmployee(req, res)
    if (!isAdmin(req) && !employeeId) return

    const lines = await prisma.payrollBatchEmployee.findMany({
      where: employeeId ? { employeeId } : {},
      include: {
        employee: true,
        payrollBatch: true,
      },
    })

    res.json(
      lines
        .sort((a, b) => b.payrollBatch.periodStart.getTime() - a.payrollBatch.periodStart.getTime())
        .map(serializePayslip)
    )
  } catch (error) {
    console.error('Payslip list error:', error)
    res.status(500).json({ error: 'Failed to load payslips' })
  }
})

router.put('/payslips/:id/payment-reference', async (req: AuthedRequest, res) => {
  try {
    const lineId = Number(req.params.id)
    const rawValue = typeof req.body?.paymentReference === 'string' ? req.body.paymentReference.trim() : ''
    if (rawValue.length > 60) {
      return res.status(400).json({ error: 'UTR / transaction ID must be 60 characters or fewer' })
    }

    const existing = await prisma.payrollBatchEmployee.findUnique({ where: { id: lineId } })
    if (!existing) return res.status(404).json({ error: 'Payslip not found' })
    if (!isAdmin(req) && existing.employeeId !== req.user?.employeeId) {
      return res.status(403).json({ error: 'You can only update your own payslips' })
    }

    const updated = await prisma.payrollBatchEmployee.update({
      where: { id: lineId },
      data: { paymentUtr: rawValue || null },
      include: { employee: true, payrollBatch: true },
    })
    res.json(serializePayslip(updated))
  } catch (error) {
    console.error('Payslip payment reference error:', error)
    res.status(500).json({ error: 'Failed to save the payment reference' })
  }
})

router.get('/payroll-batches', requireAdmin, async (_req, res) => {
  try {
    const unsyncedBatches = await prisma.payrollBatch.findMany({
      where: { salaryExpenses: { none: {} } },
      select: { id: true },
    })
    for (const batch of unsyncedBatches) await syncPayrollSalaryExpense(batch.id)
    const batches = await prisma.payrollBatch.findMany({
      include: { employees: { include: { employee: true } } },
      orderBy: { periodStart: 'desc' },
    })
    res.json(batches.map(serializePayrollBatch))
  } catch (error) {
    console.error('Payroll list error:', error)
    res.status(500).json({ error: 'Failed to load payroll batches' })
  }
})

router.get('/payroll-batches/:id', requireAdmin, async (req, res) => {
  try {
    const batch = await prisma.payrollBatch.findUnique({
      where: { id: Number(req.params.id) },
      include: { employees: { include: { employee: true }, orderBy: { employee: { name: 'asc' } } } },
    })
    if (!batch) return res.status(404).json({ error: 'Payroll batch not found' })
    res.json(serializePayrollBatch(batch))
  } catch (error) {
    console.error('Payroll detail error:', error)
    res.status(500).json({ error: 'Failed to load payroll batch' })
  }
})

router.post('/payroll-batches', requireAdmin, async (req, res) => {
  try {
    const data = req.body
    const periodStart = new Date(data.periodStart)
    const periodEnd = new Date(data.periodEnd)
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      return res.status(400).json({ error: 'Valid payroll period dates are required' })
    }
    if (periodStart > periodEnd) return res.status(400).json({ error: 'Payroll period start must be before period end' })

    const { activeEmployees, grossPay, reimbursements } = await calculatePayrollSnapshot(periodStart, periodEnd)
    const bonuses = Number(data.bonuses) || 0
    const deductions = Number(data.deductions) || 0
    const netPay = grossPay + reimbursements + bonuses - deductions
    const year = new Date().getFullYear()
    const count = await prisma.payrollBatch.count({ where: { batchId: { startsWith: `PAY-${year}` } } })

    const batch = await prisma.payrollBatch.create({
      data: {
        batchId: `PAY-${year}-${String(count + 1).padStart(6, '0')}`,
        periodStart,
        periodEnd,
        status: data.status || 'draft',
        employeeCount: activeEmployees.length,
        grossPay,
        approvedExpenses: reimbursements,
        bonuses,
        deductions,
        netPay,
        notes: data.notes || null,
        employees: {
          create: activeEmployees.map(employee => ({
            employeeId: employee.id,
            basePay: toNumber(employee.monthlyCost),
            netPay: toNumber(employee.monthlyCost),
          })),
        },
      },
      include: { employees: { include: { employee: true } } },
    })

    await syncPayrollSalaryExpense(batch.id)

    res.json(serializePayrollBatch(batch))
  } catch (error) {
    console.error('Create payroll batch error:', error)
    res.status(500).json({ error: 'Failed to prepare payroll batch' })
  }
})

router.put('/payroll-batches/:id', requireAdmin, async (req, res) => {
  try {
    const existing = await prisma.payrollBatch.findUnique({ where: { id: Number(req.params.id) } })
    if (!existing) return res.status(404).json({ error: 'Payroll batch not found' })

    const data = req.body
    const periodStart = data.periodStart ? new Date(data.periodStart) : existing.periodStart
    const periodEnd = data.periodEnd ? new Date(data.periodEnd) : existing.periodEnd
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      return res.status(400).json({ error: 'Valid payroll period dates are required' })
    }
    if (periodStart > periodEnd) return res.status(400).json({ error: 'Payroll period start must be before period end' })

    const { activeEmployees, grossPay, reimbursements } = await calculatePayrollSnapshot(periodStart, periodEnd)
    const bonuses = data.bonuses === undefined ? toNumber(existing.bonuses) : Number(data.bonuses) || 0
    const deductions = data.deductions === undefined ? toNumber(existing.deductions) : Number(data.deductions) || 0
    const netPay = grossPay + reimbursements + bonuses - deductions

    const batch = await prisma.payrollBatch.update({
      where: { id: existing.id },
      data: {
        periodStart,
        periodEnd,
        status: data.status || existing.status,
        employeeCount: activeEmployees.length,
        grossPay,
        approvedExpenses: reimbursements,
        bonuses,
        deductions,
        netPay,
        notes: data.notes ?? existing.notes,
        employees: {
          deleteMany: {},
          create: activeEmployees.map(employee => ({
            employeeId: employee.id,
            basePay: toNumber(employee.monthlyCost),
            netPay: toNumber(employee.monthlyCost),
          })),
        },
      },
      include: { employees: { include: { employee: true }, orderBy: { employee: { name: 'asc' } } } },
    })

    await syncPayrollSalaryExpense(batch.id)

    res.json(serializePayrollBatch(batch))
  } catch (error) {
    console.error('Update payroll batch error:', error)
    res.status(500).json({ error: 'Failed to update payroll batch' })
  }
})

router.delete('/payroll-batches/:id', requireAdmin, async (req, res) => {
  try {
    const existing = await prisma.payrollBatch.findUnique({ where: { id: Number(req.params.id) } })
    if (!existing) return res.status(404).json({ error: 'Payroll batch not found' })

    await prisma.payrollBatch.delete({ where: { id: existing.id } })
    res.json({ success: true })
  } catch (error) {
    console.error('Delete payroll batch error:', error)
    res.status(500).json({ error: 'Failed to delete payroll batch' })
  }
})

router.post('/', requireAdmin, async (req, res) => {
  try {
    const count = await prisma.employee.count()
    const data = req.body
    const monthlyCost = Number(data.monthlyCost) || 0
    const email = data.email ? String(data.email).trim().toLowerCase() : null
    if (!email) return res.status(400).json({ error: 'Employee email is required to create the login user' })

    const existingUser = email ? await prisma.user.findUnique({ where: { email }, include: { employee: true } }) : null
    if (existingUser?.role === 'admin') {
      return res.status(409).json({ error: 'This email belongs to an admin account and cannot be used for an employee login' })
    }
    if (existingUser?.employeeId && !existingUser.employee?.isArchived) {
      return res.status(409).json({ error: 'This email is already linked to another employee login' })
    }

    const employee = await prisma.$transaction(async tx => {
      const createdEmployee = await tx.employee.create({
        data: {
          employeeId: `EMP-${String(count + 1).padStart(6, '0')}`,
          name: data.name,
          email,
          phone: data.phone || null,
          role: data.role || null,
          department: data.department || null,
          managerName: data.managerName || null,
          workLocation: data.workLocation || null,
          employmentType: data.employmentType || 'full_time',
          monthlyCost,
          annualCost: monthlyCost * 12,
          annualPtoDays: Number(data.annualPtoDays) || 18,
          startDate: data.startDate ? new Date(data.startDate) : null,
          status: data.status || 'active',
          notes: data.notes || null,
        },
      })

      if (email) {
        if (existingUser) {
          await tx.user.update({
            where: { id: existingUser.id },
            data: {
              name: data.name,
              role: 'employee',
              employeeId: createdEmployee.id,
              isActive: true,
            },
          })
        } else {
          await tx.user.create({
            data: {
              email,
              name: data.name,
              role: 'employee',
              employeeId: createdEmployee.id,
              password: `${PENDING_EMPLOYEE_PASSWORD_PREFIX}${randomUUID()}`,
            },
          })
        }
      }

      return createdEmployee
    })
    res.json(serializeEmployee(employee))
  } catch (error) {
    console.error('Create employee error:', error)
    res.status(500).json({ error: 'Failed to create employee' })
  }
})

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const data = req.body
    const updateData: any = { ...data }
    if (data.monthlyCost !== undefined) {
      updateData.monthlyCost = Number(data.monthlyCost) || 0
      updateData.annualCost = updateData.monthlyCost * 12
    }
    if (data.annualPtoDays !== undefined) updateData.annualPtoDays = Number(data.annualPtoDays) || 0
    if (data.email !== undefined) updateData.email = data.email ? String(data.email).trim().toLowerCase() : null
    if (data.startDate) updateData.startDate = new Date(data.startDate)
    if (data.endDate) updateData.endDate = new Date(data.endDate)

    const employee = await prisma.employee.update({
      where: { id: Number(req.params.id) },
      data: updateData,
    })
    res.json(serializeEmployee(employee))
  } catch (error) {
    console.error('Update employee error:', error)
    res.status(500).json({ error: 'Failed to update employee' })
  }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const employeeId = Number(req.params.id)
    const existing = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: true },
    })
    if (!existing || existing.isArchived) return res.status(404).json({ error: 'Employee not found' })

    const employee = await prisma.$transaction(async tx => {
      if (existing.user) {
        await tx.user.update({
          where: { id: existing.user.id },
          data: {
            isActive: false,
            employeeId: null,
          },
        })
      }

      return tx.employee.update({
        where: { id: employeeId },
        data: {
          status: 'terminated',
          endDate: new Date(),
          isArchived: true,
        },
      })
    })

    res.json({ success: true, employee: serializeEmployee(employee) })
  } catch (error) {
    console.error('Remove employee error:', error)
    res.status(500).json({ error: 'Failed to remove employee' })
  }
})

export default router
