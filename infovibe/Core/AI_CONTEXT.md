# Core AI Context

This file is the focused handoff document for the `Core/` app inside the `infovibe` workspace.

It is intended to help future IDE sessions work on the shared workspace app without needing to re-audit the full monorepo context.

## App Identity

- App directory: `Core/`
- Live URL: `https://taskmanager.infovibex.com`
- PM2 process: `core-taskmanager`
- VPS deploy root: `/var/www/core-taskmanager`
- Observed Nginx upstream: `taskmanager.infovibex.com -> http://127.0.0.1:3050`
- Server IP used in deployment docs: `31.97.228.77`

## Primary Responsibility

`Core/` is the shared tenant workspace application.

Major responsibilities:

- tenant workspace auth
- meetings and attendance
- tasks and task management
- people directory and profiles
- demo access flow
- lead modal / workspace-side engagement flows

## Shared Workspace Model

`Core/` runs as a shared host app on `taskmanager.infovibex.com`.

Important behavior:

- auth JWT includes `tenantId`
- auth cookie name is `infovibex_token`
- production cookie domain is intended to be `.infovibex.com`
- tenant DB access is dynamic via `getTenantModel()` / tenant DB helpers
- shared-host login should allow valid tenant sessions on `taskmanager.infovibex.com`

## Meetings and Attendance Rules

Current business rules for the meeting system:

- there is one permanent internal meeting: `General`
- canonical internal meeting id: `general`
- `General` has exactly 50 breakout rooms
- `General` is auto-managed and must not be deleted manually
- internal meeting creation is disabled from the API/UI path
- admins and super_admins can rename breakout rooms only
- employees should only see/use the shared internal meeting model
- client meetings are separate from internal attendance
- employee attendance counts only from `General`
- admin attendance counts from `General` and client meetings
- client meetings are public-link join flows and do not require a stored client identity record

## Key Files For Meeting / Attendance Work

Start with these files when working in this area:

- `lib/meetings.ts`
- `lib/attendance.ts`
- `lib/queries.ts`
- `lib/roles.ts`
- `lib/validations.ts`
- `lib/client-meetings.ts`
- `models/Attendance.ts`
- `models/ClientMeeting.ts`
- `app/api/attendance/join/route.ts`
- `app/api/attendance/leave/route.ts`
- `app/api/attendance/report/route.ts`
- `app/api/attendance/webhook/jitsi/route.ts`
- `app/api/attendance/webhook/jitsi/events/[...segments]/route.ts`
- `app/api/meetings/create/route.ts`
- `app/api/meetings/[id]/route.ts`
- `app/api/meetings/[id]/rooms/route.ts`
- `app/api/meetings/token/route.ts`
- `app/api/client-meetings/route.ts`
- `app/api/client-meetings/[id]/route.ts`
- `app/api/client-meetings/public/join/route.ts`
- `components/MeetingStudioClient.tsx`
- `components/MeetingManager.tsx`
- `components/ClientMeetingManager.tsx`
- `components/ClientMeetingJoinClient.tsx`
- `app/meeting/page.tsx`
- `app/admin/meetings/page.tsx`
- `app/client-meeting/[tenantId]/[token]/page.tsx`

## Environment Variables

Raw secret values are intentionally not written here.

Future sessions should retrieve actual values from local gitignored env files or from the live server env files in the deploy root.

### Auth and session

- `JWT_SECRET`
- `AUTH_COOKIE_DOMAIN`
- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `WORKSPACE_LINK_SECRET`

### Database

- `MONGODB_URI`
- `MONGODB_URI_HQ`
- `PUBLIC_PROFILES_MONGODB_URI`
- `TENANT_NAME`
- `TENANT_SLUG`

### Jitsi / meetings

- `JITSI_APP_ID`
- `JITSI_APP_SECRET`
- `JITSI_DOMAIN`
- `JITSI_WEBHOOK_SECRET`
- `NEXT_PUBLIC_JITSI_BASE_URL`

### Public/profile/desktop links

- `NEXT_PUBLIC_PUBLIC_PROFILE_BASE_URL`
- `NEXT_PUBLIC_DESKTOP_APP_DOWNLOAD_URL`

### Attendance tuning

- `ATTENDANCE_STALE_OPEN_SESSION_HOURS`
- `ATTENDANCE_ROOM_SWITCH_GRACE_SECONDS`
- `ATTENDANCE_BREAK_THRESHOLD_SECONDS`
- `ATTENDANCE_BREAK_COUNT_START_SECONDS`

## Secret Handling Rule

Do not write plaintext secret values, credentials, or private key material into tracked markdown or source files.

Document:

- variable names
- where they are used
- whether they are required in local/dev/prod
- who owns them or where they are provisioned
- how rotation should be handled

## Local Validation

Primary local validation command:

```bash
npm run build
```

Current status at time of writing:

- local production build succeeds after the General meeting / client meeting refactor

## Deployment Workflow

Typical Windows-to-VPS workflow:

1. Upload changed `Core/` files to `/var/www/core-taskmanager`
2. Rebuild on the VPS
3. Restart PM2 process `core-taskmanager`

### Example upload syntax

```powershell
scp C:/Users/TECHNORON/Desktop/infovibe/Core/path/to/file.ts root@31.97.228.77:/var/www/core-taskmanager/path/to/file.ts
```

### Remote build + restart

```powershell
ssh root@31.97.228.77 "npm --prefix /var/www/core-taskmanager run build && pm2 restart core-taskmanager"
```

### PowerShell caution

Complex inline shell snippets can break under PowerShell quoting.

Prefer:

- small upload batches
- simple SSH commands
- one rebuild/restart command after upload

## Active Deploy Root Reminder

Use:

- `/var/www/core-taskmanager`

Do not assume older or legacy directories are live.

## Suggested First Checks In Future Sessions

When debugging or extending `Core/`, verify these first:

- does local `npm run build` pass?
- is the change tenant-scoped correctly?
- does it affect shared-host auth behavior?
- does it change attendance counting rules?
- does it affect the permanent `General` meeting invariants?
- does it impact public client meeting join behavior?
- if deploying, are files being uploaded to `/var/www/core-taskmanager` and not to a legacy folder?
