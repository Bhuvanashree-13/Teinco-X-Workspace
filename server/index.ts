import express from 'express'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import path from 'path'
import { existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { connectDB, prisma } from './db.js'
import { seedData } from './seed.js'

// Routes
import dashboardRoutes from './routes/dashboard.js'
import expenseRoutes from './routes/expenses.js'
import vendorRoutes from './routes/vendors.js'
import subscriptionRoutes from './routes/subscriptions.js'
import categoryRoutes from './routes/categories.js'
import projectRoutes from './routes/projects.js'
import employeeRoutes from './routes/employees.js'
import scheduleRoutes from './routes/schedule.js'
import flowRoutes from './routes/flow.js'
import assetRoutes from './routes/assets.js'
import settingsRoutes from './routes/settings.js'
import backupRoutes from './routes/backup.js'
import analyticsRoutes from './routes/analytics.js'
import reportRoutes from './routes/reports.js'
import importExportRoutes from './routes/import-export.js'
import authRoutes from './routes/auth.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = Number(process.env.PORT || 3001)
const clientDistPath = path.resolve(process.cwd(), 'dist')
const dataRootPath = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.cwd()
const uploadsPath = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(dataRootPath, 'uploads')

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
mkdirSync(uploadsPath, { recursive: true })

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/expenses', expenseRoutes)
app.use('/api/vendors', vendorRoutes)
app.use('/api/subscriptions', subscriptionRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/employees', employeeRoutes)
app.use('/api/schedule', scheduleRoutes)
app.use('/api/flow', flowRoutes)
app.use('/api/assets', assetRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/backup', backupRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/import-export', importExportRoutes)

// Static files for uploads
app.use('/uploads', express.static(uploadsPath))

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

if (existsSync(path.join(clientDistPath, 'index.html'))) {
  app.use(express.static(clientDistPath))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(clientDistPath, 'index.html'), err => {
      if (err) next(err)
    })
  })
}

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', err)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  })
})

async function startServer() {
  await connectDB()

  // Seed demo data only when explicitly requested. A clean ledger can be intentional.
  const settingsCount = await prisma.settings.count()
  if (settingsCount === 0) {
    if (process.env.SEED_DEMO_DATA === 'true') {
      console.log('Seeding initial demo data...')
      await seedData()
      console.log('✓ Seed complete')
    } else {
      await prisma.settings.create({
        data: {
          companyName: 'Teinco-X Workspace',
          country: 'India',
          baseCurrency: 'INR',
          reportingYear: 'calendar',
          financialYearStart: 4,
          financialYearEnd: 3,
          backupPath: process.env.RAILWAY_VOLUME_MOUNT_PATH ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'backups') : './backups',
          autoBackup: true,
          autoBackupInterval: 24,
        },
      })
      console.log('✓ Initial settings created')
    }
  }

  const adminCount = await prisma.user.count({ where: { role: 'admin' } })
  const bootstrapAdminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
  const bootstrapAdminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || ''
  if (adminCount === 0 && bootstrapAdminEmail && bootstrapAdminPassword) {
    const hashedPassword = await bcrypt.hash(bootstrapAdminPassword, 10)
    await prisma.user.create({
      data: {
        email: bootstrapAdminEmail,
        name: process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Workspace Admin',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
      },
    })
    console.log('✓ Initial admin access provisioned')
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ Server running on http://localhost:${PORT}`)
    console.log(`✓ API documentation: http://localhost:${PORT}/api/health`)
  })
}

startServer().catch(console.error)
