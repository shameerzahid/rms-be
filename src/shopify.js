const API_VERSION = '2026-10'

function shopHost() {
  return String(process.env.SHOPIFY_STORE || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
}

function nextPath(linkHeader) {
  if (!linkHeader) return null
  const part = linkHeader.split(',').find((p) => p.includes('rel="next"'))
  const url = part?.match(/<([^>]+)>/)?.[1]
  if (!url) return null
  const parsed = new URL(url)
  return `${parsed.pathname.replace(/^\/admin\/api\/[^/]+/, '')}${parsed.search}`
}

let cachedToken = null
let cachedUntil = 0

async function accessToken() {
  const direct = process.env.SHOPIFY_ADMIN_TOKEN
  if (direct) return direct

  if (cachedToken && Date.now() < cachedUntil) return cachedToken

  const shop = shopHost()
  const clientId = process.env.SHOPIFY_CLIENT_ID
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET
  if (!shop || !clientId || !clientSecret) {
    const error = new Error(
      'Set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET in backend/.env',
    )
    error.status = 400
    throw error
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.access_token) {
    const error = new Error(
      json.error_description || json.error || `Shopify token ${res.status}`,
    )
    error.status = 502
    throw error
  }

  cachedToken = json.access_token
  const seconds = Number(json.expires_in) || 3600
  cachedUntil = Date.now() + Math.max(seconds - 60, 30) * 1000
  return cachedToken
}

async function shopifyGet(path) {
  const shop = shopHost()
  const token = await accessToken()
  if (!shop || !token) {
    const error = new Error('Set SHOPIFY_STORE in backend/.env')
    error.status = 400
    throw error
  }

  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}${path}`, {
    headers: {
      'X-Shopify-Access-Token': token,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    const error = new Error(`Shopify ${res.status}: ${text.slice(0, 180)}`)
    error.status = 502
    throw error
  }

  return { json: await res.json(), link: res.headers.get('link') }
}

async function fetchAll(path, key) {
  const items = []
  let next = `${path}${path.includes('?') ? '&' : '?'}limit=250`
  while (next) {
    const { json, link } = await shopifyGet(next)
    items.push(...(json[key] || []))
    next = nextPath(link)
  }
  return items
}

export async function loadShopifyPages() {
  const [products, pages] = await Promise.all([
    fetchAll('/products.json?status=active', 'products'),
    fetchAll('/pages.json', 'pages'),
  ])

  const productPages = products.map((product) => ({
    id: `product-${product.id}`,
    title: `${product.title} P`,
  }))

  const landingPages = pages
    .filter((page) => page.published_at)
    .map((page) => ({
      id: `page-${page.id}`,
      title: `${page.title} L`,
    }))

  return [...productPages, ...landingPages]
}
