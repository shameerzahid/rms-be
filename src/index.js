import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import bcrypt from 'bcryptjs'
import { authRequired, signToken } from './auth.js'
import { prisma } from './prisma.js'
import { parsePageIds, serializeReview } from './reviews.js'
import { loadShopifyPages } from './shopify.js'
import { publicRoutes } from './publicRoutes.js'

const app = express()
const port = Number(process.env.PORT) || 4000

const corsOrigin = process.env.CORS_ORIGIN || true
app.set('trust proxy', 1)
app.use(express.json({ limit: '20kb' }))
// Storefront (Shopify) routes: open CORS, no auth, strictly limited — see publicRoutes.js
app.use('/api/public', cors(), publicRoutes)
app.use(cors({ origin: corsOrigin === 'true' ? true : corsOrigin }))

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

app.post('/api/shopify/sync', authRequired, async (_req, res) => {
  try {
    const pages = await loadShopifyPages()
    for (const page of pages) {
      await prisma.page.upsert({
        where: { id: page.id },
        update: { title: page.title },
        create: page,
      })
    }

    const seedIds = [
      'skin-glow-serum-p',
      'skin-glow-serum-l',
      'zafrani-facial-cream-p',
      'zafrani-facial-cream-l',
    ]
    await prisma.page.deleteMany({ where: { id: { in: seedIds } } })

    res.json({ count: pages.length, pages })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Shopify sync failed' })
  }
})

app.get('/api/reviews', authRequired, async (_req, res) => {
  const rows = await prisma.review.findMany({ orderBy: { createdAt: 'desc' } })
  res.json(rows.map(serializeReview))
})

app.post('/api/reviews', authRequired, async (req, res) => {
  const rating = Number(req.body?.rating)
  const displayName = String(req.body?.displayName || '').trim()
  const date = String(req.body?.date || '').trim()
  const text = String(req.body?.text || '').trim()
  const pageIds = parsePageIds(req.body?.pageIds)

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be 1–5' })
  }
  if (!displayName || !date || !text) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const row = await prisma.review.create({
    data: {
      rating,
      displayName,
      date,
      text,
      source: 'admin',
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

// Vercel runs this file as a serverless function (no listen).
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`RMS API on http://localhost:${port}`)
  })
}

export default app
