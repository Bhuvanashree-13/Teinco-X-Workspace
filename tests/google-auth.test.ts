import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import express from 'express'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'

process.env.DATABASE_URL = 'mysql://test:test@127.0.0.1:3306/test'
process.env.JWT_SECRET = 'test-google-signin-secret-not-for-production'
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com'
const { prisma } = await import('../server/db.js')
const { createGoogleAuthRouter } = await import('../server/routes/google-auth.js')
const originalVerify = OAuth2Client.prototype.verifyIdToken
const originalFind = prisma.user.findUnique
const originalUpdate = prisma.user.updateMany
let identity: any
let account: any
let writes: any[]
let lookups: any[]
let rejectVerification: boolean
let changed: boolean
const app = express()
app.use(express.json())
app.use('/api/auth/google', createGoogleAuthRouter({
  signUser: user => jwt.sign({ userId: user.id, role: user.role, employeeId: user.employeeId }, process.env.JWT_SECRET!),
  publicUser: user => ({ id: user.id, role: user.role, employeeId: user.employeeId }),
}))
const server = app.listen(0, '127.0.0.1')
await new Promise<void>(resolve => server.once('listening', resolve))
const address = server.address() as { port: number }
const base = `http://127.0.0.1:${address.port}/api/auth/google`

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com'
  identity = { sub: 'google-user-1', email: 'person@gmail.com', email_verified: true }
  account = { id: 42, email: identity.email, role: 'employee', employeeId: 12, googleSubject: null, isActive: true, password: 'existing-password-hash' }
  writes = []
  lookups = []
  rejectVerification = false
  changed = false
  OAuth2Client.prototype.verifyIdToken = (async (options: any) => {
    assert.equal(options.audience, process.env.GOOGLE_CLIENT_ID)
    assert.equal(options.idToken, 'test-credential')
    if (rejectVerification) throw new Error('invalid signature, audience, issuer, or expiry')
    return { getPayload: () => identity }
  }) as any
  prisma.user.findUnique = (async ({ where }: any) => {
    lookups.push(where)
    if (!account) return null
    return where.googleSubject ? (account.googleSubject === where.googleSubject ? account : null) : (account.email === where.email ? account : null)
  }) as any
  prisma.user.updateMany = (async (query: any) => { writes.push(query); return { count: changed ? 0 : 1 } }) as any
})
after(async () => {
  OAuth2Client.prototype.verifyIdToken = originalVerify
  prisma.user.findUnique = originalFind
  prisma.user.updateMany = originalUpdate
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  await prisma.$disconnect()
})
async function challenge() {
  const response = await fetch(`${base}/config`)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const config = await response.json()
  identity.nonce = config.nonce
  const cookie = response.headers.get('set-cookie')!
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /SameSite=Strict/i)
  return cookie.split(';')[0]
}
async function signIn(cookie?: string, body: any = { credential: 'test-credential' }) {
  return fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) })
}
for (const role of ['admin', 'employee']) test(`Google sign-in preserves the provisioned ${role} role`, async () => {
  account.role = role
  const response = await signIn(await challenge(), { credential: 'test-credential', role: 'admin', employeeId: 999 })
  assert.equal(response.status, 200)
  const body = await response.json()
  const token = jwt.verify(body.token, process.env.JWT_SECRET!) as jwt.JwtPayload
  assert.equal(token.role, role)
  assert.equal(token.employeeId, 12)
  assert.equal(body.user.role, role)
  assert.equal(writes[0].data.googleSubject, identity.sub)
  assert.equal(writes[0].data.password, undefined)
  assert.match(response.headers.get('set-cookie')!, /Expires=Thu, 01 Jan 1970/)
})
test('unknown accounts are refused without creating or updating users', async () => {
  account = null
  assert.equal((await signIn(await challenge())).status, 403)
  assert.equal(writes.length, 0)
})
test('inactive users are refused', async () => {
  account.isActive = false
  assert.equal((await signIn(await challenge())).status, 403)
  assert.equal(writes.length, 0)
})
test('unsupported roles cannot become admins', async () => {
  account.role = 'owner'
  assert.equal((await signIn(await challenge())).status, 403)
})
test('missing browser challenge is refused before verification/database lookup', async () => {
  assert.equal((await signIn()).status, 401)
  assert.equal(lookups.length, 0)
})
test('nonce mismatch is refused', async () => {
  const cookie = await challenge()
  identity.nonce = 'another-browser'
  assert.equal((await signIn(cookie)).status, 401)
  assert.equal(lookups.length, 0)
})
test('expired browser challenge is refused', async () => {
  const expired = jwt.sign({ nonce: 'old' }, process.env.JWT_SECRET!, { audience: 'google-signin', expiresIn: -1 })
  assert.equal((await signIn(`teinco-google-signin=${expired}`)).status, 401)
})
test('verification failures cannot produce a workspace session', async () => {
  rejectVerification = true
  assert.equal((await signIn(await challenge())).status, 401)
  assert.equal(lookups.length, 0)
})
test('real Google verifier rejects malformed credentials', async () => {
  OAuth2Client.prototype.verifyIdToken = originalVerify
  assert.equal((await signIn(await challenge())).status, 401)
  assert.equal(lookups.length, 0)
})
test('unverified email is refused', async () => {
  identity.email_verified = false
  assert.equal((await signIn(await challenge())).status, 401)
})
test('third-party email is not automatically linked', async () => {
  identity.email = account.email = 'person@example.com'
  assert.equal((await signIn(await challenge())).status, 403)
  assert.equal(writes.length, 0)
})
test('verified Workspace email can link an existing user', async () => {
  identity.email = account.email = 'person@example.com'
  identity.hd = 'example.com'
  assert.equal((await signIn(await challenge())).status, 200)
})
test('returning users are matched by stable Google subject', async () => {
  account.googleSubject = identity.sub
  identity.email = 'renamed@gmail.com'
  assert.equal((await signIn(await challenge())).status, 200)
  assert.equal(lookups.length, 1)
})
test('a different Google subject cannot replace an existing link', async () => {
  account.googleSubject = 'other-google-user'
  assert.equal((await signIn(await challenge())).status, 403)
  assert.equal(writes.length, 0)
})
test('first Google login closes pending employee password activation', async () => {
  account.password = 'pending-employee-password:setup'
  assert.equal((await signIn(await challenge())).status, 200)
  assert.match(writes[0].data.password, /^\$2[aby]\$/)
  assert.equal(writes[0].where.password, account.password)
})
test('concurrent account changes abort sign-in', async () => {
  changed = true
  assert.equal((await signIn(await challenge())).status, 409)
})
test('missing credentials return a validation error', async () => {
  assert.equal((await signIn(await challenge(), {})).status, 400)
})
test('missing configuration hides Google login and fails closed', async () => {
  delete process.env.GOOGLE_CLIENT_ID
  assert.deepEqual(await (await fetch(`${base}/config`)).json(), { enabled: false })
  assert.equal((await signIn()).status, 503)
})
