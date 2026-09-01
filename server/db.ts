import { PrismaClient } from '@prisma/client'

const trim = (value?: string) => value?.trim() || ''
const normalizeMysqlUrl = (value?: string) => {
  const raw = trim(value)
  if (!raw) return ''
  if (raw.startsWith('mysql://')) return raw
  if (raw.startsWith('mysql2://')) return `mysql://${raw.slice('mysql2://'.length)}`
  return ''
}
const buildMysqlUrlFromParts = () => {
  const host =
    trim(process.env.MYSQLHOST) ||
    trim(process.env.MYSQL_HOST) ||
    trim(process.env.MYSQL_PRIVATE_HOST) ||
    trim(process.env.MYSQL_PUBLIC_HOST)
  const port = trim(process.env.MYSQLPORT) || trim(process.env.MYSQL_PORT) || '3306'
  const user = trim(process.env.MYSQLUSER) || trim(process.env.MYSQL_USERNAME)
  const password = trim(process.env.MYSQLPASSWORD) || trim(process.env.MYSQL_PASSWORD) || trim(process.env.MYSQL_ROOT_PASSWORD)
  const database = trim(process.env.MYSQLDATABASE) || trim(process.env.MYSQL_DATABASE) || trim(process.env.MYSQL_DB)

  if (!host || !user || !password || !database) return ''

  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`
}

const configuredDatabaseUrl =
  normalizeMysqlUrl(process.env.MYSQL_URL) ||
  normalizeMysqlUrl(process.env.DATABASE_URL) ||
  normalizeMysqlUrl(process.env.MYSQL_PUBLIC_URL) ||
  buildMysqlUrlFromParts()

if (!configuredDatabaseUrl) {
  throw new Error('A valid MySQL connection URL is required. Add MYSQL_URL from Railway MySQL to the app service, or provide MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, and MYSQLDATABASE.')
}

process.env.DATABASE_URL = configuredDatabaseUrl
export const databaseUrl = configuredDatabaseUrl

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

export async function connectDB() {
  try {
    await prisma.$connect()
    console.log('✓ Database connected: configured DATABASE_URL')
  } catch (error) {
    console.error('✗ Database connection failed:', error)
    process.exit(1)
  }
}
