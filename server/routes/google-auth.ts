import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { prisma } from '../db.js'

const google = new OAuth2Client()
const cookieName = 'teinco-google-signin'
const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/api/auth/google',
}

export function createGoogleAuthRouter(session: {
  signUser: (user: any) => string
  publicUser: (user: any) => unknown
}) {
  const router = Router()
  const clientId = () => process.env.GOOGLE_CLIENT_ID?.trim()
  // Google sign-in requires an explicitly configured signing secret.
  const secret = () => process.env.JWT_SECRET?.trim()

  router.get('/config', (_req, res) => {
    res.set('Cache-Control', 'no-store')
    if (!clientId() || !secret()) return res.json({ enabled: false })
    const nonce = randomBytes(32).toString('hex')
    const challenge = jwt.sign({ nonce }, secret()!, { audience: 'google-signin', expiresIn: '10m' })
    res.cookie(cookieName, challenge, { ...cookieOptions, maxAge: 10 * 60 * 1000 })
    res.json({ enabled: true, clientId: clientId(), nonce })
  })

  router.post('/', async (req, res) => {
    res.set('Cache-Control', 'no-store')
    if (!clientId() || !secret()) return res.status(503).json({ error: 'Google sign-in is not configured.' })
    if (!req.is('application/json') || typeof req.body.credential !== 'string' || req.body.credential.length > 16000) {
      return res.status(400).json({ error: 'A Google sign-in credential is required.' })
    }

    let nonce: string
    try {
      const cookie = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))
      const challenge = cookie?.slice(cookieName.length + 1)
      if (!challenge) throw new Error('Missing challenge')
      const payload = jwt.verify(decodeURIComponent(challenge), secret()!, { audience: 'google-signin', algorithms: ['HS256'] }) as jwt.JwtPayload
      if (typeof payload.nonce !== 'string') throw new Error('Missing nonce')
      nonce = payload.nonce
    } catch {
      return res.status(401).json({ error: 'Google sign-in expired. Please try again.' })
    }

    let identity
    try {
      const ticket = await google.verifyIdToken({ idToken: req.body.credential, audience: clientId()! })
      identity = ticket.getPayload()
      if (!identity?.sub || !identity.email || !identity.email_verified || (identity as jwt.JwtPayload).nonce !== nonce) {
        throw new Error('Invalid Google identity')
      }
    } catch {
      return res.status(401).json({ error: 'Could not verify Google sign-in. Please try again.' })
    }

    try {
      const email = identity.email!.trim().toLowerCase()
      const linkedUser = await prisma.user.findUnique({ where: { googleSubject: identity.sub } })
      // Only Gmail and Google Workspace addresses are authoritative for first-time linking.
      // Other Google account email addresses require a separate account-linking flow.
      if (!linkedUser && !email.endsWith('@gmail.com') && !identity.hd) {
        return res.status(403).json({ error: 'Use your password to sign in. Google sign-in requires a Gmail or Google Workspace account.' })
      }
      const user = linkedUser || await prisma.user.findUnique({ where: { email } })
      if (!user || !user.isActive || !['admin', 'employee'].includes(user.role) || (user.googleSubject && user.googleSubject !== identity.sub)) {
        return res.status(403).json({ error: 'This Google account does not have active workspace access. Contact your administrator.' })
      }
      // A pending employee's first Google login must close the existing first-password setup path.
      const password = user.password.startsWith('pending-employee-password:')
        ? await bcrypt.hash(randomBytes(48).toString('hex'), 10)
        : undefined
      const updated = await prisma.user.updateMany({
        where: { id: user.id, isActive: true, googleSubject: user.googleSubject, password: user.password },
        data: { googleSubject: identity.sub, lastLogin: new Date(), ...(password ? { password } : {}) },
      })
      if (updated.count !== 1) return res.status(409).json({ error: 'Account access changed. Please try signing in again.' })
      res.clearCookie(cookieName, cookieOptions)
      res.json({ token: session.signUser(user), user: session.publicUser(user) })
    } catch {
      res.status(500).json({ error: 'Google sign-in could not be completed. Please try again.' })
    }
  })
  return router
}
