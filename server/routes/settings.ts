import { Router } from 'express'
import { prisma } from '../db.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const settings = await prisma.settings.findFirst()
    res.json(settings || {})
  } catch (error) {
    res.status(500).json({ error: 'Failed to load settings' })
  }
})

router.put('/', async (req, res) => {
  try {
    const settings = await prisma.settings.findFirst()
    let result
    if (settings) {
      result = await prisma.settings.update({ where: { id: settings.id }, data: req.body })
    } else {
      result = await prisma.settings.create({ data: req.body })
    }
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' })
  }
})

export default router
