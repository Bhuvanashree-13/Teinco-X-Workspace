import { PrismaClient } from '@prisma/client'
import path from 'path'
import { mkdirSync } from 'fs'

const volumeMountPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
const defaultDbPath = volumeMountPath
  ? path.resolve(volumeMountPath, 'teinco_finance.db')
  : path.resolve(process.cwd(), 'prisma/teinco_finance.db')

export const databaseUrl = volumeMountPath
  ? `file:${defaultDbPath}`
  : process.env.DATABASE_URL || `file:${defaultDbPath}`

process.env.DATABASE_URL = databaseUrl

export const dbPath = databaseUrl.startsWith('file:')
  ? databaseUrl.replace(/^file:/, '')
  : defaultDbPath

mkdirSync(path.dirname(dbPath), { recursive: true })

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

export async function connectDB() {
  try {
    await prisma.$connect()
    console.log('✓ Database connected:', databaseUrl.startsWith('file:') ? dbPath : 'configured DATABASE_URL')
  } catch (error) {
    console.error('✗ Database connection failed:', error)
    process.exit(1)
  }
}
