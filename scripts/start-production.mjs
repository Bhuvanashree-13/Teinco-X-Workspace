import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const volumeMountPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
const databasePath = volumeMountPath
  ? path.resolve(volumeMountPath, 'teinco_finance.db')
  : path.resolve(process.cwd(), 'prisma/teinco_finance.db')

if (volumeMountPath || !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${databasePath}`
}

if (process.env.DATABASE_URL.startsWith('file:')) {
  mkdirSync(path.dirname(process.env.DATABASE_URL.replace(/^file:/, '')), { recursive: true })
}

const prismaCliPath = path.resolve(process.cwd(), 'node_modules/prisma/build/index.js')
const dbPush = spawnSync(process.execPath, [prismaCliPath, 'db', 'push', '--skip-generate'], {
  stdio: 'inherit',
  env: process.env,
})

if (dbPush.error) {
  console.error(dbPush.error)
  process.exit(1)
}

if (dbPush.status !== 0) {
  process.exit(dbPush.status || 1)
}

await import('../dist-server/server/index.js')
