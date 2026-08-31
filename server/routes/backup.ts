import { Router } from 'express'
import { dbPath, prisma } from '../db.js'
import fs from 'fs-extra'
import path from 'path'
import { format } from 'date-fns'

const router = Router()

router.post('/create', async (req, res) => {
  try {
    const settings = await prisma.settings.findFirst()
    const backupDir = settings?.backupPath || './backups'
    await fs.ensureDir(backupDir)

    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm')
    const fileName = `teincox_finance_backup_${timestamp}.db`
    const backupPath = path.join(backupDir, fileName)

    await fs.copy(dbPath, backupPath)
    const stats = await fs.stat(backupPath)
    const expenseCount = await prisma.expense.count()

    const record = await prisma.backupRecord.create({
      data: {
        fileName,
        filePath: backupPath,
        fileSize: stats.size,
        expenseCount,
        isAuto: false
      }
    })

    res.json({ success: true, backup: record })
  } catch (error) {
    res.status(500).json({ error: 'Backup failed' })
  }
})

router.get('/list', async (req, res) => {
  try {
    const backups = await prisma.backupRecord.findMany({ orderBy: { createdAt: 'desc' } })
    res.json(backups)
  } catch (error) {
    res.status(500).json({ error: 'Failed to list backups' })
  }
})

export default router
