import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PAGES = [
  { id: 'skin-glow-serum-p', title: 'Skin glow serum P' },
  { id: 'skin-glow-serum-l', title: 'Skin glow serum L' },
  { id: 'zafrani-facial-cream-p', title: 'Zafrani facial cream P' },
  { id: 'zafrani-facial-cream-l', title: 'Zafrani facial cream L' },
]

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@company.com'
  const password = process.env.ADMIN_PASSWORD || 'admin123'
  const passwordHash = await bcrypt.hash(password, 10)

  await prisma.admin.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  })

  for (const page of PAGES) {
    await prisma.page.upsert({
      where: { id: page.id },
      update: { title: page.title },
      create: page,
    })
  }

  console.log(`Seeded admin ${email} + ${PAGES.length} pages`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
