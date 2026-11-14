# rms-be

RMS Admin backend (Express + Prisma).

## Setup

```bash
cp .env.example .env
# fill DATABASE_URL, JWT_SECRET, admin credentials

npm install
npm run db:setup
npm run dev
```

API runs on `http://localhost:4000`.

## Demo admin

Set in `.env` (defaults):

- `ADMIN_EMAIL=admin@company.com`
- `ADMIN_PASSWORD=admin123`
