# Running your community / Запуск своего сообщества

OpenPrint 0.1 supports **one application process on one computer with local disk storage**. There is no required Vercel, Supabase, SMTP, AI, or map API key. A public repository can exist without any running deployment. A shared live community needs a running server and appropriate administration.

## 1. Local demo

Install Node.js 24 LTS, clone this repository, then:

```sh
npm ci
npm run demo
```

UI: http://localhost:5173. API: http://127.0.0.1:3000. The demo bar switches fictional accounts. Data lives in `.local/demo`. Use only on your own computer, without a public proxy. Stop with Ctrl+C. To start over, stop the process and remove **only** `.local/demo` after checking that it is the demo directory.

## 2. Real local instance

```sh
npm ci
npm run build
cp .env.example .env
npm run admin -- operator@example.org
npm start
```

Open http://localhost:3000. The admin command creates or promotes that account and prints a **single-use setup link, valid for 30 minutes**. Open it privately and choose a password of at least 12 characters. Keep terminal output out of public logs. No email is sent. The first public registration is an ordinary member; it never acquires administrator rights.

`npm run dev` runs Vite and the API with a clean `.local/data` database. `npm run demo` explicitly uses its own `.local/demo` directory. An instance refuses to mix demo and real data.

### Configuration

Node reads `.env` on start; existing process environment variables take precedence.

| Name               | Default                 | Meaning                                                                                  |
| ------------------ | ----------------------- | ---------------------------------------------------------------------------------------- |
| `HOST`             | `127.0.0.1`             | Listener; use `0.0.0.0` only inside your protected server/container network              |
| `PORT`             | `3000`                  | API + built frontend port                                                                |
| `APP_URL`          | `http://localhost:3000` | Exact public origin, including scheme and optional port; no path, query, or credentials  |
| `DATA_DIR`         | `.local/data`           | Persistent local SQLite database and uploads; never publish this directory               |
| `INSTANCE_NAME`    | `OpenPrint`             | Instance name reported by the API; the shared product brand remains OpenPrint            |
| `OPERATOR_CONTACT` | empty                   | Public HTTPS support page or `mailto:` address for recovery/moderation                   |
| `USER_STORAGE_MB`  | `200`                   | Per-user upload quota                                                                    |
| `MAX_STORAGE_MB`   | `1024`                  | Total registered upload quota, excluding DB, logs, backups and temporary request memory  |
| `TRUST_PROXY`      | `0`                     | Set `1` only when exactly one trusted reverse proxy is the only way to reach the process |

Do not set `DEMO_MODE` for a real instance. Demo mode requires a loopback listener, a loopback public origin, and no trusted proxy. Real instances reject a demo database.

## 3. Public server

1. Create a dedicated unprivileged operating-system user and a persistent **local disk** data directory. SQLite WAL is not intended for a shared network filesystem or horizontally scaled replicas.
2. Build the application, set `APP_URL=https://makers.example.org`, set `OPERATOR_CONTACT`, and configure an HTTPS reverse proxy. Keep the Node listener inaccessible from the public internet except through that proxy.
3. Set `TRUST_PROXY=1` only for a single trusted hop that overwrites forwarded IP headers. Keep the default `0` otherwise. Origin validation must match the actual public URL; the app intentionally does not allow wildcard CORS.
4. Configure the proxy for uploads of up to 20 MB. For nginx use an appropriate `client_max_body_size` above 20 MB (e.g. 21m); avoid buffering sensitive attachments in public locations.
5. Run the process under your supervisor or Compose. Use HTTPS for public logins. Cookies are HttpOnly, SameSite=Lax, and become Secure when `APP_URL` is HTTPS.
6. Create the administrator using the command above, define a moderation/recovery policy, and test registration, a direct brief, an offer, delivery confirmation, and a backup restore with synthetic accounts.
7. Apply disk quotas to logs/backups as well as uploads, install OS updates, and establish a supported upgrade schedule. The application upload quota alone does not cap every source of disk usage.

Never proxy a public origin to local demo mode. Never expose `.local`, uploads, the database, reset links, or backups as static files. There is no need to create a public storage bucket.

## 4. Docker Compose

Requires Docker Engine and the Compose plugin. Start in the cloned repository:

```sh
cp .env.example .env
docker compose up --build -d
docker compose exec app node build/scripts/admin.js operator@example.org
```

The site is bound to **127.0.0.1:3000** on the host. The process runs as the unprivileged `node` user. Named volumes `community-data` and `community-backups` hold persistence. Configure `.env` with your exact public `APP_URL` and operator contact before placing your HTTPS proxy in front. The container listens on `0.0.0.0` **inside** its isolated network, not on all host interfaces.

Do not use `docker compose down -v` on a real community; `-v` removes named volumes. Do not scale `app` beyond one replica. Bind-mount users must set correct ownership for UID 1000 themselves; the process never recursively changes ownership of arbitrary host files.

## 5. Password recovery

Users change their own passwords in Settings with their current password. A successful change revokes other sessions and outstanding recovery links.

If a user loses access, **verify the request by your community’s own procedure first**, then:

```sh
npm run admin -- member@example.org --recover
```

This creates an expiring single-use link **without promoting the member**. Send the link privately using your existing support process. No SMTP service is required. For Docker use `docker compose exec app node build/scripts/admin.js member@example.org --recover`.

## 6. Backup and restore

Backups contain private data and credentials hashes. Store them privately with OS permissions, encryption at rest if appropriate, and a retention policy.

### Node.js installation

Stop the application before taking a consistent database **and files** snapshot:

```sh
# Stop npm start / your process supervisor first.
npm run backup -- /absolute/path/outside-data-dir/openprint-2026-11-13
```

The script refuses to run while the same instance process is active. It creates a compact SQLite snapshot with `VACUUM INTO`, checks database integrity/foreign keys, copies every registered upload, and checks SHA-256 hashes. The destination must be new and outside `DATA_DIR`. A failure can leave a partial backup directory: **do not treat it as a valid backup**; remove it or keep it clearly marked as failed.

To restore, stop the application, preserve the old data directory, and copy the completed snapshot’s `openprint.sqlite` and `uploads/` into a **new empty** local directory. Set `DATA_DIR` to that directory and start the same application version. Check `/api/health`, sign in, download a known attachment, and open a known project before reopening access. Never replace a live SQLite database or combine an old `-wal` file with a restored snapshot.

### Docker installation

```sh
docker compose stop app
docker compose run --rm --no-deps app node build/scripts/backup.js /app/backups/snapshot-2026-11-13
docker compose start app
```

The backup is in the private `community-backups` volume. Export it to your own protected backup storage. Restore into a new empty data volume with the application stopped. The backup script and filesystem restore are intentionally explicit; the application does not silently overwrite your live data.

## 7. Updates

Read the release notes, take and verify a backup, stop the old process, install the chosen release with `npm ci`, run `npm run check`, then start it. Database schema version is recorded with `PRAGMA user_version`. This first release creates schema v1; future migrations must preserve accepted agreements. The app refuses databases with a newer schema than it understands.

No migration of existing Supabase accounts, password hashes, collected directory records, or historical orders is supplied. Plan and test such a migration separately rather than copying production data into the public repository.
