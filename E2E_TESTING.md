# Browser End-to-End Verification

## Purpose

The Playwright suite verifies that the real browser, public routes, server components, cookie-backed sessions, PostgreSQL transactions, private file storage, email outbox worker, SMTP delivery, and Mailpit API work together. It complements unit and PostgreSQL integration tests; it does not replace them.

## Covered critical workflow

The initial Chromium scenario proves:

- anonymous users cannot enter the Account Hub;
- owner sign-up and tenant/business onboarding;
- party and catalog creation through the public UI;
- private CSV upload and authenticated byte-for-byte download;
- tenant-owner invitation creation;
- outbox worker delivery to Mailpit;
- invited-account creation and invitation acceptance;
- viewer read access with both hidden management controls and server-side write denial;
- viewer access to the existing private download;
- password-reset delivery through Mailpit;
- password update, old-session revocation, and sign-in with the new credential.

Each run uses unique account and master-data identifiers. The full stateful security workflow runs once per clean CI job rather than using automatic Playwright retries, because repeated sign-up and recovery attempts from the same runner can correctly trigger authentication rate limits and obscure the original failure.

## First local run

Install dependencies and the Chromium browser once:

```bash
npm ci
npx playwright install chromium
```

Prepare the normal local environment and infrastructure:

```bash
cp .env.example .env
# Set private BETTER_AUTH_SECRET and OUTBOX_WORKER_SECRET values.
docker compose up -d db mailpit
npm run db:generate
npm run db:deploy
npm run build
```

Run the browser suite:

```bash
npm run test:e2e
```

Playwright starts the production Next.js server and email worker automatically. PostgreSQL and Mailpit must already be reachable through the values in `.env`. The application origin must match `APP_URL`, `BETTER_AUTH_URL`, and `PLAYWRIGHT_BASE_URL`; the default is `http://localhost:3000`.

Useful optional variables:

```text
PLAYWRIGHT_BASE_URL=http://localhost:3000
MAILPIT_URL=http://localhost:8025
E2E_RUN_ID=local-manual-run
```

Interactive debugging:

```bash
npm run test:e2e:ui
```

## CI behavior

CI starts clean PostgreSQL and Mailpit services, applies all migrations, runs unit and PostgreSQL integration tests, builds the production application, installs Chromium, and then runs Playwright with one worker. On failure it retains the HTML report, trace, screenshot, and video as a short-lived workflow artifact.

The remaining Docker image and booted-runtime checks run only after browser verification succeeds.

## Safety rules

- Never point the E2E suite at production or a valuable database.
- Keep Mailpit local or CI-only; it is not a production mail provider.
- Do not weaken permissions, disable secure session behavior, or expose invitation/reset tokens solely to simplify tests.
- Prefer role- and label-based selectors over implementation-specific CSS selectors.
- Diagnose the first failure from retained evidence; do not hide stateful authentication failures behind automatic retries.
