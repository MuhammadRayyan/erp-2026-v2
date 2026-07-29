# Practical Security and UAE Compliance

## Initial security profile

The initial deployment is owner-operated or shared with a few trusted users. Required controls are secure authentication, revocable sessions, server-side authorization, tenant/business isolation, input validation, private files, protected secrets, financial idempotency, audit history, durable delivery records, HTTPS for remote hosting, and restorable backups.

Enterprise SSO, universal MFA, WAF, SIEM, formal certification, multi-region deployment, and database-per-tenant are deferred until public commercial use creates a real need.

## Mandatory checks

- Never trust tenant, business, role, entitlement, or lifecycle values supplied by the browser as authority.
- Enforce permissions and entitlements inside domain services; route guards and hidden UI controls are not the security boundary.
- Protect owner roles from ordinary invitation and member-management flows.
- Bind related multi-tenant records through composite PostgreSQL constraints where a mismatched tenant would create an invalid graph.
- Check active/inactive state inside the same locked transaction that changes dependent records.
- Keep session and recovery tokens out of logs and browser storage; temporary delivery URLs may exist only in protected outbox payloads until sent, failed, expired, or cancelled.
- Revalidate correlated queued work immediately before external delivery when the related business state may have changed.
- Protect cookie-authenticated writes against CSRF and untrusted origins.
- Store uploads privately with generated keys and authorized downloads.
- Prevent duplicate financial effects on retries and reject conflicting reuse of idempotency keys.
- Audit posting, reversal, role changes, bank-detail changes, restores, registration changes, and sensitive settings.
- Keep PostgreSQL, Mailpit, worker endpoints, and other internal services off public interfaces. Local Compose binds database and Mailpit ports to loopback only.
- Expose the web application remotely only behind HTTPS and an appropriate reverse proxy; do not publish the outbox processor as a normal application endpoint.
- Protect the outbox processing endpoint with a separate high-entropy secret and return no operational details to unauthorized callers.
- Treat database backups as capable of containing pending invitation and password-reset links.
- Scrub terminal email payloads while retaining delivery metadata needed for troubleshooting.
- Design email-triggered actions to remain safe under duplicate delivery because SMTP processing is at-least-once.
- Require database-aware readiness and executable runtime smoke checks; a successful image build alone is not deployment verification.

## Verification boundary

PostgreSQL integration tests cover current transaction and isolation rules. Browser E2E, full user-workflow verification, migration-drift checks, and restoration drills remain mandatory before Phase 3 is finally closed. Their absence must remain visible in `PHASE_3_VERIFICATION_AUDIT.md` and `PROGRESS.md`.

## UAE VAT

Tax identity, effective dates, categories, rates, currency, discounts, rounding, invoice particulars, corrections, and reports must be versioned and reconcilable. Current FTA rules must be rechecked before production claims.

## UAE e-invoicing

A PDF is not an electronic invoice. Structured invoice data must come from the canonical posted document, pass current PINT-AE/UAE validation, and be exchanged through an accredited provider adapter. Current Ministry of Finance deadlines and amendments must be verified before onboarding.
