import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { applyDatabaseUrl } from './database-url.mjs'

if (existsSync('.env')) for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
  if (!match || process.env[match[1]] !== undefined) continue
  process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
}
const databaseUrl = applyDatabaseUrl()
if (!databaseUrl) {
  console.error('A valid MySQL connection is required. Configure MYSQL_URL, DATABASE_URL, or the MYSQLHOST/MYSQLUSER/MYSQLPASSWORD/MYSQLDATABASE values.')
  process.exit(1)
}

const prismaCliPath = path.resolve(process.cwd(), 'node_modules/prisma/build/index.js')
const result = spawnSync(process.execPath, [prismaCliPath, 'db', 'push'], {
  stdio: 'inherit',
  env: process.env,
})
if (result.error) console.error(result.error)
process.exit(result.status ?? 1)
