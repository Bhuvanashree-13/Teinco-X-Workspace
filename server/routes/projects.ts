import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)
const statuses = ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done'] as const
const priorities = ['lowest', 'low', 'medium', 'high', 'highest'] as const
const types = ['epic', 'story', 'task', 'bug'] as const
const issueSchema = z.object({
  projectId: z.number().int().positive(), type: z.enum(types).default('task'), summary: z.string().trim().min(2).max(180),
  description: z.string().trim().max(10000).nullable().optional(), status: z.enum(statuses).default('backlog'), priority: z.enum(priorities).default('medium'),
  assigneeId: z.number().int().positive().nullable().optional(), sprint: z.string().trim().max(100).nullable().optional(), storyPoints: z.number().int().min(0).max(100).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(), labels: z.string().trim().max(500).nullable().optional(),
}).strict()
const projectSchema = z.object({ code: z.string().trim().max(20).optional(), name: z.string().trim().min(2).max(160), description: z.string().max(5000).nullable().optional(), status: z.enum(['active', 'paused', 'completed', 'archived']).default('active'), startDate: z.coerce.date().nullable().optional(), endDate: z.coerce.date().nullable().optional(), budget: z.number().min(0).optional(), color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#6366f1') }).strict()
const includeIssue = { project: { select: { id: true, code: true, name: true, color: true } }, assignee: { select: { id: true, employeeId: true, name: true } }, reporter: { select: { id: true, name: true, email: true } }, comments: { orderBy: { createdAt: 'asc' as const }, include: { author: { select: { id: true, name: true, email: true } } } }, activities: { orderBy: { createdAt: 'desc' as const }, take: 30 } }

router.get('/', async (_req, res) => {
  try { res.json(await prisma.project.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { workItems: true } } } })) }
  catch { res.status(500).json({ error: 'Failed to load projects' }) }
})
router.get('/issues', async (req, res) => {
  try {
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined
    if (projectId !== undefined && (!Number.isInteger(projectId) || projectId < 1)) return res.status(400).json({ error: 'Invalid project' })
    const status = req.query.status && req.query.status !== 'all' ? String(req.query.status) : undefined
    if (status && !statuses.includes(status as typeof statuses[number])) return res.status(400).json({ error: 'Invalid workflow status' })
    res.json(await prisma.workItem.findMany({ where: { ...(projectId ? { projectId } : {}), ...(status ? { status } : {}) }, include: includeIssue, orderBy: [{ updatedAt: 'desc' }], take: 500 }))
  } catch { res.status(500).json({ error: 'Failed to load work items' }) }
})
router.post('/issues', async (req: AuthedRequest, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  const parsed = issueSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid project, summary, workflow, priority, and estimate.' })
  try {
    const project = await prisma.project.findUnique({ where: { id: parsed.data.projectId }, select: { code: true } })
    if (!project) return res.status(404).json({ error: 'Project not found' })
    const item = await prisma.$transaction(async db => {
      const sequence = await db.project.update({ where: { id: parsed.data.projectId }, data: { issueSequence: { increment: 1 } }, select: { issueSequence: true } })
      const key = `${project.code.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10)}-${sequence.issueSequence}`
      return db.workItem.create({ data: { ...parsed.data, key, reporterId: req.user!.userId, resolvedAt: parsed.data.status === 'done' ? new Date() : null, activities: { create: { actorId: req.user!.userId, action: 'created', details: `Created as ${parsed.data.type}` } } }, include: includeIssue })
    })
    res.status(201).json(item)
  } catch { res.status(500).json({ error: 'Failed to create work item' }) }
})
router.put('/issues/:issueId', async (req: AuthedRequest, res) => {
  const id = Number(req.params.issueId), parsed = issueSchema.partial().safeParse(req.body)
  if (!Number.isInteger(id) || !parsed.success) return res.status(400).json({ error: 'Invalid work item update' })
  try {
    const current = await prisma.workItem.findUnique({ where: { id } })
    if (!current) return res.status(404).json({ error: 'Work item not found' })
    if (req.user?.role !== 'admin' && current.assigneeId !== req.user?.employeeId) return res.status(403).json({ error: 'You can update only work assigned to you' })
    const changes = Object.entries(parsed.data).filter(([key, value]) => value !== (current as any)[key]).map(([key]) => key)
    const item = await prisma.workItem.update({ where: { id }, data: { ...parsed.data, ...(parsed.data.status ? { resolvedAt: parsed.data.status === 'done' ? current.resolvedAt || new Date() : null } : {}), activities: { create: { actorId: req.user!.userId, action: 'updated', details: changes.length ? `Changed ${changes.join(', ')}` : 'Saved work item' } } }, include: includeIssue })
    res.json(item)
  } catch { res.status(500).json({ error: 'Failed to update work item' }) }
})
router.post('/issues/:issueId/comments', async (req: AuthedRequest, res) => {
  const id = Number(req.params.issueId), parsed = z.object({ body: z.string().trim().min(1).max(5000) }).safeParse(req.body)
  if (!Number.isInteger(id) || !parsed.success) return res.status(400).json({ error: 'Enter a comment' })
  const item = await prisma.workItem.findUnique({ where: { id }, select: { id: true } })
  if (!item) return res.status(404).json({ error: 'Work item not found' })
  const comment = await prisma.workItemComment.create({ data: { workItemId: id, authorId: req.user!.userId, body: parsed.data.body }, include: { author: { select: { id: true, name: true, email: true } } } })
  await prisma.workItemActivity.create({ data: { workItemId: id, actorId: req.user!.userId, action: 'commented' } })
  res.status(201).json(comment)
})
router.delete('/issues/:issueId', requireAdmin, async (req, res) => {
  const id = Number(req.params.issueId)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid work item' })
  try { await prisma.workItem.delete({ where: { id } }); res.json({ success: true }) } catch { res.status(404).json({ error: 'Work item not found' }) }
})
router.get('/:id/spend', async (req, res) => {
  try {
    const projectId = Number(req.params.id), yearStart = new Date(new Date().getFullYear(), 0, 1), yearEnd = new Date(new Date().getFullYear(), 11, 31)
    const [totalSpend, expenses] = await Promise.all([prisma.expense.aggregate({ where: { projectId, expenseDate: { gte: yearStart, lte: yearEnd }, status: 'active' }, _sum: { baseCurrencyAmount: true } }), prisma.expense.findMany({ where: { projectId, status: 'active' }, include: { category: { select: { name: true, color: true } } }, orderBy: { expenseDate: 'desc' }, take: 20 })])
    res.json({ totalSpend: Number(totalSpend._sum.baseCurrencyAmount) || 0, expenses })
  } catch { res.status(500).json({ error: 'Failed to load project spend' }) }
})
router.post('/', requireAdmin, async (req, res) => {
  const parsed = projectSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Enter valid project details' })
  try { const count = await prisma.project.count(); res.status(201).json(await prisma.project.create({ data: { ...parsed.data, code: parsed.data.code || `PRJ-${String(count + 1).padStart(3, '0')}` } })) } catch (error) { console.error('Project creation failed:', error); res.status(500).json({ error: 'Failed to create project' }) }
})
router.put('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id), parsed = projectSchema.partial().safeParse(req.body)
  if (!Number.isInteger(id) || id < 1 || !parsed.success) return res.status(400).json({ error: 'Enter valid project details' })
  try { res.json(await prisma.project.update({ where: { id }, data: parsed.data })) } catch { res.status(404).json({ error: 'Project not found' }) }
})
router.delete('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid project' })
  try {
    await prisma.$transaction(async db => {
      const project = await db.project.findUnique({ where: { id }, select: { id: true } })
      if (!project) throw new Error('PROJECT_NOT_FOUND')
      // Preserve finance and planning records while removing their project link.
      await Promise.all([
        db.expense.updateMany({ where: { projectId: id }, data: { projectId: null } }),
        db.budget.updateMany({ where: { projectId: id }, data: { projectId: null } }),
        db.scheduleEvent.updateMany({ where: { projectId: id }, data: { projectId: null } }),
        db.scheduleMilestone.updateMany({ where: { projectId: id }, data: { projectId: null } }),
      ])
      await db.project.delete({ where: { id } })
    })
    res.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') return res.status(404).json({ error: 'Project not found' })
    console.error('Project deletion failed:', error)
    res.status(500).json({ error: 'Failed to delete project' })
  }
})
export default router
