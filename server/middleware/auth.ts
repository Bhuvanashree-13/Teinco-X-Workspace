import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../db.js'

const JWT_SECRET = process.env.JWT_SECRET || 'teinco-finance-local-secret-key'

export type AuthUser = {
  userId: number
  role: 'admin' | 'employee'
  employeeId?: number | null
}

export type AuthedRequest = Request & { user?: AuthUser }

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Login required' })

    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, isActive: true, employeeId: true },
    })

    if (!user?.isActive) return res.status(401).json({ error: 'User account is inactive' })

    req.user = {
      userId: user.id,
      role: user.role === 'employee' ? 'employee' : 'admin',
      employeeId: user.employeeId,
    }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired login' })
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  next()
}

export const isAdmin = (req: AuthedRequest) => req.user?.role === 'admin'
