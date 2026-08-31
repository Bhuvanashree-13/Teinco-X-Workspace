import { Router } from 'express'
import { addDays, endOfDay, startOfDay } from 'date-fns'
import { prisma } from '../db.js'

const router = Router()
const defaultTimezone = 'Asia/Kolkata'

const toNumber = (value: unknown) => Number(value) || 0

const serializeEmployee = (employee: any) => employee ? ({
  ...employee,
  monthlyCost: toNumber(employee.monthlyCost),
  annualCost: toNumber(employee.annualCost),
  annualPtoDays: toNumber(employee.annualPtoDays),
}) : null

const serializeEvent = (event: any) => ({
  ...event,
  employee: serializeEmployee(event.employee),
})

const nextCode = async (prefix: string, count: () => Promise<number>) => {
  const year = new Date().getFullYear()
  const currentCount = await count()
  return `${prefix}-${year}-${String(currentCount + 1).padStart(6, '0')}`
}

const dateWindow = (startDate?: string, endDate?: string) => {
  const start = startDate ? startOfDay(new Date(startDate)) : startOfDay(new Date())
  const end = endDate ? endOfDay(new Date(endDate)) : endOfDay(addDays(start, 30))
  return { start, end }
}

async function detectConflicts() {
  const { start, end } = dateWindow(undefined, addDays(new Date(), 45).toISOString())
  const events = await prisma.scheduleEvent.findMany({
    where: {
      status: 'scheduled',
      employeeId: { not: null },
      startsAt: { lte: end },
      endsAt: { gte: start },
    },
    include: { employee: true },
    orderBy: { startsAt: 'asc' },
  })

  const conflicts: Array<Record<string, unknown>> = []

  events.forEach((event, index) => {
    events.slice(index + 1).forEach(other => {
      if (event.employeeId !== other.employeeId) return
      if (event.startsAt < other.endsAt && other.startsAt < event.endsAt) {
        conflicts.push({
          type: 'double_booked_event',
          priority: 'urgent',
          employeeName: event.employee?.name || 'Unassigned',
          startsAt: event.startsAt,
          timezone: event.timezone,
          title: `${event.title} overlaps ${other.title}`,
          recommendation: 'Move one event to the nearest open slot outside this overlap.',
        })
      }
    })
  })

  return conflicts
}

router.get('/summary', async (_req, res) => {
  try {
    const today = new Date()
    const { start, end } = dateWindow(today.toISOString(), addDays(today, 14).toISOString())

    const [events, milestones, conflicts] = await Promise.all([
      prisma.scheduleEvent.groupBy({
        by: ['priority'],
        where: { status: 'scheduled', startsAt: { gte: start, lte: end } },
        _count: true,
      }),
      prisma.scheduleMilestone.groupBy({
        by: ['priority'],
        where: { status: 'open', dueAt: { gte: start, lte: end } },
        _count: true,
      }),
      detectConflicts(),
    ])

    const priorityCounts = { urgent: 0, standard: 0, informational: 0 }
    events.forEach(item => { priorityCounts[item.priority as keyof typeof priorityCounts] += item._count })
    milestones.forEach(item => { priorityCounts[item.priority as keyof typeof priorityCounts] += item._count })

    res.json({
      timezone: defaultTimezone,
      windowStart: start,
      windowEnd: end,
      upcomingEvents: events.reduce((sum, item) => sum + item._count, 0),
      openMilestones: milestones.reduce((sum, item) => sum + item._count, 0),
      conflicts: conflicts.length,
      priorityCounts,
    })
  } catch (error) {
    console.error('Schedule summary error:', error)
    res.status(500).json({ error: 'Failed to load schedule summary' })
  }
})

router.get('/events', async (req, res) => {
  try {
    const { priority = 'all', eventType = 'all' } = req.query
    const { start, end } = dateWindow(req.query.startDate as string | undefined, req.query.endDate as string | undefined)
    const where: any = {
      status: { not: 'cancelled' },
      startsAt: { lte: end },
      endsAt: { gte: start },
    }
    if (priority !== 'all') where.priority = priority as string
    if (eventType !== 'all') where.eventType = eventType as string

    const events = await prisma.scheduleEvent.findMany({
      where,
      include: {
        employee: true,
        project: { select: { id: true, code: true, name: true, color: true } },
      },
      orderBy: [{ priority: 'asc' }, { startsAt: 'asc' }],
    })
    res.json(events.map(serializeEvent))
  } catch (error) {
    console.error('Schedule events error:', error)
    res.status(500).json({ error: 'Failed to load schedule events' })
  }
})

router.post('/events', async (req, res) => {
  try {
    const data = req.body
    const year = new Date().getFullYear()
    const eventId = await nextCode('EVT', () => prisma.scheduleEvent.count({ where: { eventId: { startsWith: `EVT-${year}` } } }))
    const event = await prisma.scheduleEvent.create({
      data: {
        eventId,
        title: data.title,
        description: data.description || null,
        eventType: data.eventType || 'meeting',
        priority: data.priority || 'standard',
        module: data.module || 'schedule',
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        timezone: data.timezone || defaultTimezone,
        location: data.location || null,
        ownerName: data.ownerName || null,
        employeeId: data.employeeId ? Number(data.employeeId) : null,
        projectId: data.projectId ? Number(data.projectId) : null,
        isAllDay: Boolean(data.isAllDay),
      },
      include: { employee: true, project: true },
    })
    res.json(serializeEvent(event))
  } catch (error) {
    console.error('Create schedule event error:', error)
    res.status(500).json({ error: 'Failed to create schedule event' })
  }
})

router.get('/milestones', async (req, res) => {
  try {
    const { status = 'all', priority = 'all' } = req.query
    const where: any = {}
    if (status !== 'all') where.status = status as string
    if (priority !== 'all') where.priority = priority as string
    const milestones = await prisma.scheduleMilestone.findMany({
      where,
      include: { project: { select: { id: true, code: true, name: true, color: true } } },
      orderBy: [{ priority: 'asc' }, { dueAt: 'asc' }],
    })
    res.json(milestones)
  } catch (error) {
    console.error('Schedule milestones error:', error)
    res.status(500).json({ error: 'Failed to load schedule milestones' })
  }
})

router.post('/milestones', async (req, res) => {
  try {
    const data = req.body
    const year = new Date().getFullYear()
    const milestoneId = await nextCode('MIL', () => prisma.scheduleMilestone.count({ where: { milestoneId: { startsWith: `MIL-${year}` } } }))
    const milestone = await prisma.scheduleMilestone.create({
      data: {
        milestoneId,
        title: data.title,
        milestoneType: data.milestoneType || 'project',
        priority: data.priority || 'standard',
        module: data.module || 'schedule',
        dueAt: new Date(data.dueAt),
        timezone: data.timezone || defaultTimezone,
        ownerDepartment: data.ownerDepartment || null,
        projectId: data.projectId ? Number(data.projectId) : null,
        notes: data.notes || null,
      },
      include: { project: true },
    })
    res.json(milestone)
  } catch (error) {
    console.error('Create milestone error:', error)
    res.status(500).json({ error: 'Failed to create schedule milestone' })
  }
})

router.put('/milestones/:id/status', async (req, res) => {
  try {
    const milestone = await prisma.scheduleMilestone.update({
      where: { id: Number(req.params.id) },
      data: { status: req.body.status },
      include: { project: true },
    })
    res.json(milestone)
  } catch (error) {
    console.error('Update milestone error:', error)
    res.status(500).json({ error: 'Failed to update schedule milestone' })
  }
})

router.get('/conflicts', async (_req, res) => {
  try {
    res.json(await detectConflicts())
  } catch (error) {
    console.error('Schedule conflicts error:', error)
    res.status(500).json({ error: 'Failed to detect schedule conflicts' })
  }
})

export default router
