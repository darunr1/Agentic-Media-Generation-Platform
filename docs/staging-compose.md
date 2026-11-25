# Staging Compose

Use a Linux host with Docker Engine and Compose v2, sufficient disk for images
and media, and a trusted HTTPS reverse proxy. This is a separate Compose
project (`sequence-staging`); never combine it with the development Compose
file. It has separate named PostgreSQL and media volumes. Adminer is absent;
Postgres, worker and renderer have no published ports.

Create an ignored, private `.env.staging.local` file (mode 0600). Set
`STAGING_DB_PASSWORD` to a URL-safe random hex value (for example
`openssl rand -hex 32`), `AUTH_SECRET` and `ENCRYPTION_KEY` to distinct
random 32-byte base64 strings (`openssl rand -base64 32`), `APP_URL` to
the external HTTPS origin, and `RESEND_API_KEY` and `EMAIL_FROM` to the
email provider credentials and verified sender. Do not reuse dev credentials.
The stack derives its internal database URL and pins local media and
Postgres queues. The T08 authentication changes are required before inviting
users. Until then, keep the web port private.

Run from the repository root:

```bash
docker compose --env-file .env.staging.local -f docker-compose.staging.yml config --quiet
docker compose --env-file .env.staging.local -f docker-compose.staging.yml up -d --build
docker compose --env-file .env.staging.local -f docker-compose.staging.yml ps -a
curl --fail http://127.0.0.1:3000/api/readyz
```

The web port defaults to 3000 on loopback; optionally set
`STAGING_WEB_PORT` to avoid a conflict. Use your reverse proxy to forward
only the web port and overwrite forwarded headers. Do not expose worker,
renderer or database ports. Do not run the development seed in staging.

Expect migration to exit 0 and all four persistent services to be healthy.
Inspect readiness of non-published services using Compose health status, or
run the smoke script from the repository root:

```bash
bash scripts/staging-smoke.sh
```

The script checks health, port isolation, and the shared media volume. It
does not test external TLS, paid providers or magic-link delivery. Back up
the database and media volume together and test restoration. Restarting or
running `down` retains volumes; never use `down --volumes` on a real staging
host unless intentionally destroying its data. Changing the initial database
password in the env file does not rotate an existing PostgreSQL role.

Host startup is not considered verified until the smoke checks pass.
