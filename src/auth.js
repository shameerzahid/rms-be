import jwt from 'jsonwebtoken'

const secret = () => process.env.JWT_SECRET || 'rms-dev-secret-change-me'

export function signToken(admin) {
  return jwt.sign({ sub: admin.id, email: admin.email }, secret(), {
    expiresIn: '7d',
  })
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    req.user = jwt.verify(token, secret())
    next()
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}
