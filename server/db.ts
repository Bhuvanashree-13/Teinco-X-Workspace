import { PrismaClient } from '@prisma/client'

const configuredDatabaseUrl = (process.env.MYSQL_URL || process.env.DATABASE_URL)?.trim()

if (!configuredDatabaseUrl) {
  throw new Error('A MySQL connection URL is required. Add DATABASE_URL or MYSQL_URL from Railway MySQL to the app service.')
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
