import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../db.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'teinco-finance-local-secret-key'
const PENDING_EMPLOYEE_PASSWORD_PREFIX = 'pending-employee-password:'

const publicUser = (user: any) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role === 'employee' ? 'employee' : 'admin',
  employeeId: user.employeeId || null,
})

const signUser = (user: any) => jwt.sign(
  { userId: user.id, role: user.role, employeeId: user.employeeId || null },
  JWT_SECRET,
  { expiresIn: '24h' }
)

const publicAdmin = (user: any) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  isActive: user.isActive,
  lastLogin: user.lastLogin,
  createdAt: user.createdAt,
})

const publicLoginUser = (user: any) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role === 'employee' ? 'employee' : 'admin',
  employeeId: user.employeeId || null,
  isActive: user.isActive,
  lastLogin: user.lastLogin,
  createdAt: user.createdAt,
  employee: user.employee
    ? {
        id: user.employee.id,
        employeeId: user.employee.employeeId,
        name: user.employee.name,
        department: user.employee.department,
        status: user.employee.status,
        isArchived: user.employee.isArchived,
      }
    : null,
})

// Login
router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) return res.status(401).json({ error: 'Sign-in failed' })

    if (!user.isActive) return res.status(401).json({ error: 'User account is inactive' })

    if (user.role === 'employee' && user.password.startsWith(PENDING_EMPLOYEE_PASSWORD_PREFIX)) {
      const hashedPassword = await bcrypt.hash(password, 10)
      const activatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          lastLogin: new Date(),
        },
      })
      return res.json({ token: signUser(activatedUser), user: publicUser(activatedUser) })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'Sign-in failed' })

    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } })

    res.json({ token: signUser(user), user: publicUser(user) })
  } catch (error) {
    console.error('Login failed:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

// Verify token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'No token' })

    const decoded = jwt.verify(token, JWT_SECRET) as any
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } })
    if (!user) return res.status(401).json({ error: 'User not found' })

    res.json({ user: publicUser(user) })
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

router.get('/users', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            department: true,
            status: true,
            isArchived: true,
          },
        },
      },
    })

    res.json(users.map(publicLoginUser))
  } catch (error) {
    console.error('Login user list failed:', error)
    res.status(500).json({ error: 'Failed to load login users' })
  }
})

router.get('/admins', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'admin' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
    })

    res.json(admins.map(publicAdmin))
  } catch (error) {
    console.error('Admin user list failed:', error)
    res.status(500).json({ error: 'Failed to load admin users' })
  }
})

router.post('/admins', requireAuth, requireAdmin, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    const name = String(req.body.name || '').trim()
    const password = String(req.body.password || '')

    if (!name) return res.status(400).json({ error: 'Admin name is required' })
    if (!email) return res.status(400).json({ error: 'Admin email is required' })
    if (password.length < 6) return res.status(400).json({ error: 'Admin access phrase must be at least 6 characters' })

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) return res.status(409).json({ error: 'A login user with this email already exists' })

    const hashedPassword = await bcrypt.hash(password, 10)
    const admin = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: 'admin',
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
    })

    res.json(publicAdmin(admin))
  } catch (error) {
    console.error('Admin user create failed:', error)
    res.status(500).json({ error: 'Failed to create admin user' })
  }
})

export default router
