# Running your community / Запуск своего сообщества

OpenPrint 0.2 supports **one application process on one computer with local disk storage**. There is no required Vercel, Supabase, SMTP, AI, or map API key. The optional local CAD process needs Python/CadQuery but no cloud account. A public repository can exist without any running deployment. A shared live community needs a running server and appropriate administration.

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

Open http://localhost:3000. The admin command prepares the account and prints a **single-use setup link, valid for 30 minutes**. Administrator privileges take effect when that link is redeemed. Open it privately and choose a password of at least 12 characters. Keep terminal output out of public logs. No email is sent. The first public registration is an ordinary member; it never acquires administrator rights.

`npm run dev` runs Vite and the API with a clean `.local/data` database. `npm run demo` explicitly uses its own `.local/demo` directory. An instance refuses to mix demo and real data.

### Configuration

Node reads `.env` on start; existing process environment variables take precedence.

| Name               | Default                 | Meaning                                                                                    |
| ------------------ | ----------------------- | ------------------------------------------------------------------------------------------ |
| `HOST`             | `127.0.0.1`             | Listener; use `0.0.0.0` only inside your protected server/container network                |
| `PORT`             | `3000`                  | API + built frontend port                                                                  |
| `APP_URL`          | `http://localhost:3000` | Exact public origin, including scheme and optional port; no path, query, or credentials    |
| `DATA_DIR`         | `.local/data`           | Persistent local SQLite database and uploads; never publish this directory                 |
| `INSTANCE_NAME`    | `OpenPrint`             | Instance name reported by the API; the shared product brand remains OpenPrint              |
| `OPERATOR_CONTACT` | empty                   | Public HTTPS support page or `mailto:` address for recovery/moderation                     |
| `USER_STORAGE_MB`  | `200`                   | Per-user upload quota                                                                      |
| `MAX_STORAGE_MB`   | `1024`                  | Total registered upload quota, excluding DB, logs, backups and temporary request memory    |
| `TRUST_PROXY`      | `0`                     | Set `1` only when exactly one trusted reverse proxy is the only way to reach the process   |
| `CAD_PYTHON`       | empty                   | Optional absolute path to the trusted Python interpreter containing the pinned CAD runtime |

Do not set `DEMO_MODE` for a real instance. Demo mode requires a loopback listener, a loopback public origin, and no trusted proxy. Real instances reject a demo database.

### Optional local CAD

```sh
python3.12 -m venv cad-worker/.venv
cad-worker/.venv/bin/python -m pip install -r cad-worker/requirements.txt
cad-worker/.venv/bin/python cad-worker/worker.py --check
```

Set `CAD_PYTHON` in the server environment or `.env` to the absolute path of that virtual environment's Python, then restart the app. Keep this setting server-side; it is not a `VITE_*` variable. The `--check` command verifies the installed runtime; build a small example in Studio to check the complete path. Without this setting, briefs and simple browser templates continue to work. The complete geometry contract and limitations are in [CAD_ENGINE.md](CAD_ENGINE.md); optional AI configuration is in [NEOFAB_SETUP.md](NEOFAB_SETUP.md).

The application runs one native CAD process at a time, with 30 attempts/project, 10/user/rolling day and 100/instance/rolling day. Failed/cancelled attempts count; account closure does not reset instance usage. Each result is capped at 128 MiB, each file at 32 MiB, and registered CAD artifacts at 256 MiB/user and 2 GiB/instance. CAD specifications are capped at 90,000 bytes within a 96 KiB JSON request body. These are separate limits from `USER_STORAGE_MB` and `MAX_STORAGE_MB` for ordinary uploads.

CAD uses a 90-second CPU cap and 120-second wall deadline. Linux also applies a 3 GiB virtual-memory cap; macOS does not. This fixed compiler runs with a scrubbed environment and no generated executable code, but it is not a full filesystem/network sandbox. Provide extra capacity for temporary exports, SQLite/WAL and backups, and keep native dependencies updated. On restart, interrupted running builds fail explicitly; eligible queued builds resume. Their output cannot update a newer project version.

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

To include CadQuery in the application image, use the optional override:

```sh
docker compose -f compose.yaml -f compose.cad.yaml up --build -d
```

It selects the `cad` target and sets `CAD_PYTHON` inside the container. It retains the same data volume and unprivileged application user, with a combined app/worker limit of 4 GiB, two CPUs and 256 processes/threads. The default image does not install Python. Use the same two `-f` arguments when administering this deployment. Stop and back up an existing installation before rebuilding/upgrading it; the override is not a data migration tool.

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
npm run backup -- /absolute/path/outside-data-dir/openprint-2026-11-15
```

The script refuses to run while the same instance process is active. Stop the server and let its CAD worker exit before backup. It creates a compact SQLite snapshot with `VACUUM INTO`, checks database integrity/foreign keys, copies every registered upload, and checks SHA-256 hashes. CAD artifacts are already inside the SQLite snapshot as BLOBs; the script verifies their lengths/hashes and records their metadata in backup manifest version 2. No separate CAD output directory needs copying. The destination must be new and outside `DATA_DIR`. A failure can leave a partial backup directory: **do not treat it as a valid backup**; remove it or keep it clearly marked as failed.

To restore, stop the application, preserve the old data directory, and copy the completed snapshot’s `openprint.sqlite` and `uploads/` into a **new empty** local directory. Set `DATA_DIR` to that directory and start the same application version. Check `/api/health`, sign in, download a known attachment and CAD artifact, compare its SHA-256 with the backup manifest, and open a known project before reopening access. Never replace a live SQLite database or combine an old `-wal` file with a restored snapshot.

### Docker installation

```sh
docker compose stop app
docker compose run --rm --no-deps app node build/scripts/backup.js /app/backups/snapshot-2026-11-15
docker compose start app
```

The backup is in the private `community-backups` volume. Export it to your own protected backup storage. Restore into a new empty data volume with the application stopped. The backup script and filesystem restore are intentionally explicit; the application does not silently overwrite your live data.

## 7. Updates

Read the release notes, stop the old process, and take/verify a backup **using the old version before installing the update**. Then install the chosen release with `npm ci`, run `npm run check`, and start it. Database schema version is recorded with `PRAGMA user_version`. Version 0.2 migrates schemas 1 and 2 additively to schema 3, adding CAD revisions/builds/artifacts/handoffs/grants while retaining existing projects and agreements. The app refuses databases with a newer schema than it understands. To roll back to an older application, restore its compatible pre-upgrade backup into a fresh data directory; do not edit `PRAGMA user_version` or reopen schema 3 with old code.

No migration of existing Supabase accounts, password hashes, collected directory records, or historical orders is supplied. Plan and test such a migration separately rather than copying production data into the public repository.
