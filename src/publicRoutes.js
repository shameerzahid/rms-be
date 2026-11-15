import express from 'express'
import { prisma } from './prisma.js'

export const publicRoutes = express.Router()

// 5 customer reviews per IP per hour (in-memory; resets on restart)
const hits = new Map()
function limited(ip) {
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3600_000)
  if (recent.length >= 5) return true
  hits.set(ip, [...recent, now])
  return false
}

async function pageReviews(pageId) {
  const rows = await prisma.review.findMany({
    where: { pageIds: { contains: JSON.stringify(pageId) } },
    orderBy: { createdAt: 'desc' },
  })
  return rows.filter((r) => JSON.parse(r.pageIds || '[]').includes(pageId))
}

// Reviews + average for one page. Only reviews assigned to this page.
publicRoutes.get('/pages/:pageId/reviews', async (req, res) => {
  const list = await pageReviews(req.params.pageId)
  const count = list.length
  const average = count
    ? Math.round((list.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
    : null

  res.set('Cache-Control', 'public, max-age=60')
  res.json({
    average,
    count,
    reviews: list
      .sort((a, b) => Number(b.pinned) - Number(a.pinned))
      .map((r) => ({
        id: r.id,
        rating: r.rating,
        displayName: r.displayName,
        date: r.date,
        text: r.text,
        pinned: r.pinned,
      })),
  })
})

// Customer review: saved unassigned; admin assigns it to pages (per the PDF).
publicRoutes.post('/pages/:pageId/reviews', async (req, res) => {
  if (req.body?.website) return res.status(201).json({ ok: true }) // honeypot
  if (limited(req.ip)) {
    return res.status(429).json({ error: 'Too many reviews. Try again later.' })
  }

  const page = await prisma.page.findUnique({ where: { id: req.params.pageId } })
  if (!page) return res.status(404).json({ error: 'Unknown page' })

  const rating = Number(req.body?.rating)
  const displayName = String(req.body?.displayName || '').trim().slice(0, 60)
  const text = String(req.body?.text || '').trim().slice(0, 1000)

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Select a rating' })
  }
  if (!displayName || !text) {
    return res.status(400).json({ error: 'Enter your name and review' })
  }

  await prisma.review.create({
    data: {
      rating,
      displayName,
      text,
      date: new Date().toISOString().slice(0, 10),
      source: 'customer',
      pageIds: '[]',
    },
  })
  res.status(201).json({ ok: true })
})
