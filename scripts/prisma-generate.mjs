import { spawnSync } from 'node:child_process'
import path from 'node:path'

const configuredDatabaseUrl = (process.env.MYSQL_URL || process.env.DATABASE_URL || '').trim()

if (!configuredDatabaseUrl) {
  console.error('A MySQL connection URL is required. Add DATABASE_URL or MYSQL_URL from Railway MySQL to the app service.')
  process.exit(1)
}

process.env.DATABASE_URL = configuredDatabaseUrl

const prismaCliPath = path.resolve(process.cwd(), 'node_modules/prisma/build/index.js')
const generate = spawnSync(process.execPath, [prismaCliPath, 'generate'], {
  stdio: 'inherit',
  env: process.env,
})

if (generate.error) {
  console.error(generate.error)
  process.exit(1)
}

process.exit(generate.status || 0)
