# InfoVibeX

InfoVibeX is an internal full-stack company platform built with Next.js App Router. It combines employee authentication, meeting management, Jitsi room launch, and breakout room generation in a single deployable application.

## Stack

- Next.js 14 App Router
- React 18
- MongoDB with Mongoose
- JWT authentication stored in an HTTP-only cookie
- Tailwind CSS
- External Jitsi Meet server integration

## Features

- Employee and admin login flow
- Initial admin bootstrap through the register API
- Admin employee management
- Admin meeting creation with up to 50 breakout rooms per meeting
- Employee meeting join flow that opens the external Jitsi room in a new tab

## Environment Variables

Copy `.env.example` to `.env.local` and set:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/infovibex
JWT_SECRET=replace-with-a-long-random-secret
NEXT_PUBLIC_JITSI_BASE_URL=https://meet.infovibex.com
APP_URL=https://infovibex.com
```

## Install and Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Bootstrap the First Admin

When the database has no users, create the first admin with:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Platform Admin","email":"admin@infovibex.com","password":"ChangeMe123!","role":"admin"}'
```

The first registration is forced to `admin` and also logs that account in.

## Linux VPS Deployment

1. Install Node.js 20+ and MongoDB connectivity on the server.
2. Set the environment variables in the deployment shell or process manager.
3. Run `npm install`.
4. Run `npm run build`.
5. Run `npm run start` behind Nginx or another reverse proxy.
6. Point `infovibex.com` to the Next.js app and keep `meet.infovibex.com` pointed at the existing Jitsi server.

## Project Layout

```text
app/
  admin/
  api/
  dashboard/
  login/
  meeting/
components/
lib/
models/
utils/
```