import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { applyDatabaseUrl } from './database-url.mjs'
import { PrismaClient } from '@prisma/client'
import { prepareGoogleSchema } from './prepare-google-schema.mjs'

const configuredDatabaseUrl = applyDatabaseUrl()

if (!configuredDatabaseUrl) {
  console.error('A valid MySQL connection URL is required. Add MYSQL_URL from Railway MySQL to the app service, or provide MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, and MYSQLDATABASE.')
  process.exit(1)
}

const schemaClient = new PrismaClient()
try {
  await prepareGoogleSchema(schemaClient)
} catch (error) {
  console.error('Google identity schema preparation failed:', error)
  process.exitCode = 1
} finally {
  await schemaClient.$disconnect()
}
if (process.exitCode) process.exit(process.exitCode)

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
