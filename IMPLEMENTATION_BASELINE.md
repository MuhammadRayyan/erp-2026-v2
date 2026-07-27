# Implementation Baseline

## Selected defaults

- Node.js 24 LTS
- npm while the repository is a single deployable product
- Next.js 16 App Router and React 19
- TypeScript strict mode
- PostgreSQL 16
- Prisma 7 through reviewed migrations
- Better Auth with PostgreSQL-backed revocable sessions
- Zod for contracts and validation
- Tailwind CSS with source-owned UI components
- TanStack Query/Table when interactive server state and ERP lists require them
- PostgreSQL outbox worker before Redis
- private local storage first, S3-compatible adapter later
- HTML/CSS and Chromium for versioned PDFs
- SMTP adapter with queued delivery
- Vitest, PostgreSQL integration tests, and browser E2E tests
- Docker Compose for local and hosted deployment

## Structural rules

- Use real App Router routes and layouts.
- Keep route handlers thin.
- Organize business rules by domain modules.
- Do not call internal HTTP routes from Server Components when the server use case can be called directly.
- Do not introduce global client state without a concrete need.
- Keep network calls outside financial transactions.
- Store exact money values as decimal database values and precise API representations.
- Use one authoritative VAT calculation contract.
- Add dependencies only when they solve a current requirement.
