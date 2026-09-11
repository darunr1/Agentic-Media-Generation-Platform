# Platform approval checklist

- Register a real business/developer account and separate staging/production apps.
- Publish privacy, terms, support, and data-deletion URLs.
- Request only scopes the implemented capability needs.
- Configure exact HTTPS OAuth redirect and webhook URLs.
- Store client secrets in Secret Manager and document rotation/revocation.
- Verify signatures, timestamps, replay protection, redaction, and retry behavior.
- Record a reviewer demo showing login, connection, account selection, approval, publish, analytics, disconnect, and deletion.
- Test expired tokens, rejected scopes, rate limits, duplicate callbacks, partial publishing, and account removal.
- Keep the UI at **Setup required** until sandbox and production reviews pass.
