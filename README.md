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

## Admin login

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` (no defaults), then run `npm run db:seed`.
