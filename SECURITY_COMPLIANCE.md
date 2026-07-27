# Practical Security and UAE Compliance

## Initial security profile

The initial deployment is owner-operated or shared with a few trusted users. Required controls are secure authentication, revocable sessions, server-side authorization, tenant/business isolation, input validation, private files, protected secrets, financial idempotency, audit history, HTTPS for remote hosting, and restorable backups.

Enterprise SSO, universal MFA, WAF, SIEM, formal certification, multi-region deployment, and database-per-tenant are deferred until public commercial use creates a real need.

## Mandatory checks

- Never trust tenant or business IDs supplied by the browser as authority.
- Check permissions and lifecycle state in every protected use case.
- Keep session and recovery tokens out of URLs, logs, and browser storage.
- Protect cookie-authenticated writes against CSRF and untrusted origins.
- Store uploads privately with generated keys and authorized downloads.
- Prevent duplicate financial effects on retries.
- Audit posting, reversal, role changes, bank-detail changes, restores, and sensitive settings.
- Keep PostgreSQL and internal services off the public network.

## UAE VAT

Tax identity, effective dates, categories, rates, currency, discounts, rounding, invoice particulars, corrections, and reports must be versioned and reconcilable. Current FTA rules must be rechecked before production claims.

## UAE e-invoicing

A PDF is not an electronic invoice. Structured invoice data must come from the canonical posted document, pass current PINT-AE/UAE validation, and be exchanged through an accredited provider adapter. Current Ministry of Finance deadlines and amendments must be verified before onboarding.
