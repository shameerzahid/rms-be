import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { authRequired, signToken } from './auth.js'
import { prisma } from './prisma.js'
import { parsePageIds, serializeReview } from './reviews.js'

const app = express()
const port = Number(process.env.PORT) || 4000

app.use(cors({ origin: true }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase()
  const password = String(req.body?.password || '')

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }

  const admin = await prisma.admin.findUnique({ where: { email } })
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  res.json({
    token: signToken(admin),
    user: { email: admin.email },
  })
})

app.get('/api/pages', async (_req, res) => {
  const pages = await prisma.page.findMany({ orderBy: { title: 'asc' } })
  res.json(pages)
})

app.get('/api/reviews', async (_req, res) => {
  const rows = await prisma.review.findMany({ orderBy: { createdAt: 'desc' } })
  res.json(rows.map(serializeReview))
})

app.post('/api/reviews', async (req, res) => {
  const rating = Number(req.body?.rating)
  const displayName = String(req.body?.displayName || '').trim()
  const date = String(req.body?.date || '').trim()
  const text = String(req.body?.text || '').trim()
  const source = req.body?.source === 'customer' ? 'customer' : 'admin'
  const pageIds = parsePageIds(req.body?.pageIds)

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be 1–5' })
  }
  if (!displayName || !date || !text) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  if (source === 'admin') {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    try {
      if (!token) throw new Error('no token')
      jwt.verify(token, process.env.JWT_SECRET || 'rms-dev-secret-change-me')
    } catch {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const row = await prisma.review.create({
    data: {
      rating,
      displayName,
      date,
      text,
      source,
      pageIds: JSON.stringify(pageIds),
      pinned: false,
    },
  })

  res.status(201).json(serializeReview(row))
})

app.patch('/api/reviews/:id', authRequired, async (req, res) => {
  const existing = await prisma.review.findUnique({ where: { id: req.params.id } })
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const data = {}
  if (req.body?.text !== undefined) {
    const text = String(req.body.text).trim()
    if (!text) return res.status(400).json({ error: 'Text required' })
    data.text = text
  }
  if (req.body?.rating !== undefined) {
    const rating = Number(req.body.rating)
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be 1–5' })
    }
    data.rating = rating
  }
  if (req.body?.displayName !== undefined) {
    data.displayName = String(req.body.displayName).trim()
  }
  if (req.body?.date !== undefined) data.date = String(req.body.date).trim()
  if (req.body?.pinned !== undefined) data.pinned = Boolean(req.body.pinned)
  if (req.body?.pageIds !== undefined) {
    data.pageIds = JSON.stringify(parsePageIds(req.body.pageIds))
  }

  const row = await prisma.review.update({
    where: { id: req.params.id },
    data,
  })
  res.json(serializeReview(row))
})

app.delete('/api/reviews/:id', authRequired, async (req, res) => {
  try {
    await prisma.review.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch {
    res.status(404).json({ error: 'Not found' })
  }
})

app.listen(port, () => {
  console.log(`RMS API on http://localhost:${port}`)
})
