# Email Outbox Operations

## Purpose

Tenant invitations and password-reset emails are persisted in PostgreSQL before the originating request completes. SMTP delivery is performed by a separate lightweight worker so temporary SMTP failure does not lose delivery work.

## Local host development

Start PostgreSQL and Mailpit:

```bash
docker compose up -d db mailpit
```

Run the application:

```bash
npm run dev
```

Run the worker in a second terminal:

```bash
npm run worker:email
```

The worker reads `.env`, calls the private processing endpoint, and Mailpit displays delivered messages at `http://localhost:8025`.

Required local settings:

```text
OUTBOX_WORKER_SECRET=<at least 32 random characters>
OUTBOX_BATCH_SIZE=10
OUTBOX_POLL_SECONDS=5
```

## Full Docker mode

```bash
docker compose up --build
```

Compose starts `db`, `mailpit`, `migrate`, `web`, and `worker`. The worker has no direct database or SMTP credentials. It calls the web application's internal endpoint with the shared worker secret.

Inspect worker activity:

```bash
docker compose logs -f worker
docker compose logs -f web
```

## Delivery lifecycle

Statuses:

- `PENDING`: created and available for first processing;
- `PROCESSING`: exclusively claimed by one worker;
- `RETRY`: temporary failure with a future availability time;
- `SENT`: SMTP accepted the message;
- `FAILED`: attempt budget exhausted;
- `EXPIRED`: delivery window elapsed before successful delivery;
- `CANCELLED`: the related invitation was accepted or revoked before delivery.

Workers claim bounded batches with PostgreSQL `FOR UPDATE SKIP LOCKED`. Multiple workers may run concurrently. A processing lock older than ten minutes is recovered automatically. Retry delays begin at 30 seconds, double after each failed attempt, and stop increasing at one hour.

## Sensitive payload retention

Invitation URLs and password-reset URLs are stored only while delivery remains actionable. `textBody` and `htmlBody` are cleared after `SENT`, `FAILED`, `EXPIRED`, or `CANCELLED`. Delivery metadata, attempts, provider message ID, timestamps, and the final error remain available for operations.

Database backups can contain pending message bodies. Protect backups using the same access controls as the application database and expire old backups according to the project backup policy.

## Failure handling

Tenant owners can see invitation delivery status and attempt count under Users and Business Access. A terminal invitation failure should be handled by:

1. checking SMTP configuration and connectivity;
2. correcting the problem;
3. revoking the failed invitation if it remains pending;
4. creating a new invitation, which creates a new token and queue record.

Do not manually change a failed row back to pending in normal operations because its sensitive body has already been scrubbed.

## Secret rotation

`OUTBOX_WORKER_SECRET` protects the internal processing endpoint. Use a high-entropy value of at least 32 characters. It must be supplied to both the web service and worker.

To rotate it:

1. set the same new value for web and worker;
2. restart both services together;
3. confirm the worker receives successful responses;
4. remove the old secret from deployment configuration and secret history where supported.

The endpoint returns a generic 404 response when the secret is absent or incorrect.

## Delivery guarantee

The queue provides durable at-least-once processing. SMTP does not provide a transaction shared with PostgreSQL. A process crash after SMTP accepts a message but before the worker records `SENT` can cause a retry and duplicate email. Templates and related application actions must remain safe when a recipient receives the same message more than once.

## Recovery and backup

Outbox records are part of the PostgreSQL backup. After restoring a database:

- review pending and retry rows before starting the worker;
- confirm their expiry timestamps are still valid;
- start the web service first, then the worker;
- monitor Mailpit or the configured SMTP provider for resumed delivery;
- do not restore old pending password-reset messages into an active environment without reviewing their expiry and security impact.
