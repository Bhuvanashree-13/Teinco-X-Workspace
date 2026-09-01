import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { applyDatabaseUrl } from './database-url.mjs'

applyDatabaseUrl()
process.env.DATABASE_URL ||= 'mysql://user:password@localhost:3306/teinco_x_workspace'

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
