# Running your community / Запуск своего сообщества

Each OpenPrint node runs **one application process with its own SQLite database on local storage**. There is no required Vercel, Supabase, SMTP, AI, or map API key. The optional local CAD process needs Python/CadQuery but no cloud account. A public repository can exist without any running deployment. A shared live community needs a running server and appropriate administration.

## 1. Default catalogue

Install Node.js 24 LTS, clone this repository, then:

```sh
npm ci
npm run dev
```

UI: http://localhost:5173. API: http://127.0.0.1:3000. The default catalogue uses `.local/data` and requires no accounts or administrator setup. Studios publish immediately and manage their own record with a private link; see [the public catalogue workflow](OPEN_CATALOG.md).

For the optional old community demo, explicitly run `APP_MODE=community npm run demo`. Its fictional accounts/projects live in `.local/demo` and must stay on loopback. `npm run demo` without that override uses separate demo storage with the catalogue interface; it does not create new accounts in catalogue mode.

## 2. Real local instance

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open http://localhost:3000. With the default `APP_MODE=catalog`, registration, account recovery, moderation, private project and CAD endpoints are disabled. No administrator command is needed. The catalogue accepts immediate public submissions. Existing private community data is preserved when switching modes.

To enable the separate community/CAD workflows, set `APP_MODE=community` explicitly, restart and run `npm run admin -- operator@example.org` if administrator setup is needed. That command issues a private one-use setup link; the legacy account instructions below apply only to this mode.

Either mode can import an existing studio catalogue. See [catalogue import](CATALOG_IMPORT.md). A real instance refuses a database containing fictional demo accounts. Use a separate data directory for real public operation.

### Independent workshop nodes

A catalog or community instance can discover makers on other instances through `OPENPRINT_PEERS`. For orders, a maker uses a community instance and opts in from their profile. The [workshop network guide](WORKSHOP_NETWORK.md) includes a two-node local setup and the customer-to-maker workflow.

### Configuration

Node reads `.env` on start; existing process environment variables take precedence.

| Name               | Default                 | Meaning                                                                                                      |
| ------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `APP_MODE`         | `catalog`               | `catalog`: immediate public listings, no account/moderation API; `community`: optional private collaboration |
| `HOST`             | `127.0.0.1`             | Listener; use `0.0.0.0` only inside your protected server/container network                                  |
| `PORT`             | `3000`                  | API + built frontend port                                                                                    |
| `APP_URL`          | `http://localhost:3000` | Exact public origin, including scheme and optional port; no path, query, or credentials                      |
| `DATA_DIR`         | `.local/data`           | Persistent local SQLite database and uploads; never publish this directory                                   |
| `OPENPRINT_PEERS`  | empty                   | Comma-separated origins of peer workshop nodes                                                               |
| `MAP_TILES`        | `osm`                   | Set `off` to display markers and lists without external tile requests                                        |
| `INSTANCE_NAME`    | `OpenPrint`             | Instance name reported by the API; the shared product brand remains OpenPrint                                |
| `OPERATOR_CONTACT` | empty                   | Public HTTPS support page or `mailto:` address for recovery/moderation                                       |
| `USER_STORAGE_MB`  | `200`                   | Per-user upload quota                                                                                        |
| `MAX_STORAGE_MB`   | `1024`                  | Total registered upload quota, excluding DB, logs, backups and temporary request memory                      |
| `TRUST_PROXY`      | `0`                     | Set `1` only when exactly one trusted reverse proxy is the only way to reach the process                     |
| `CAD_PYTHON`       | empty                   | Optional absolute path to the trusted Python interpreter containing the pinned CAD runtime                   |

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
6. Test guest publication, the saved management link, editing, deletion and backup restore using synthetic catalogue records. In optional community mode, also test administrator setup and private collaboration.
7. Apply disk quotas to logs/backups as well as uploads, install OS updates, and establish a supported upgrade schedule. The application upload quota alone does not cap every source of disk usage.

Never proxy a public origin to local demo mode. Never expose `.local`, uploads, the database, reset links, or backups as static files. There is no need to create a public storage bucket.

## 4. Docker Compose

Requires Docker Engine and the Compose plugin. Start in the cloned repository:

```sh
cp .env.example .env
docker compose up --build -d
```

The site is bound to **127.0.0.1:3000** on the host. The process runs as the unprivileged `node` user. Named volumes `community-data` and `community-backups` hold persistence. Configure `.env` with your exact public `APP_URL` and operator contact before placing your HTTPS proxy in front. The container listens on `0.0.0.0` **inside** its isolated network, not on all host interfaces.

Do not use `docker compose down -v` on a real community; `-v` removes named volumes. Do not scale `app` beyond one replica. Bind-mount users must set correct ownership for UID 1000 themselves; the process never recursively changes ownership of arbitrary host files.

To include CadQuery in the application image, use the optional override:

```sh
docker compose -f compose.yaml -f compose.cad.yaml up --build -d
```

It selects the `cad` target and sets `CAD_PYTHON` inside the container. It retains the same data volume and unprivileged application user, with a combined app/worker limit of 4 GiB, two CPUs and 256 processes/threads. The default image does not install Python. Use the same two `-f` arguments when administering this deployment. Stop and back up an existing installation before rebuilding/upgrading it; the override is not a data migration tool.

## 5. Optional community account recovery

This section requires `APP_MODE=community`. The default catalogue uses per-listing private links; there are no user passwords or email recovery.

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

Read the release notes, stop the old process, and take/verify a backup **using the old version before installing the update**. Then install the chosen release with `npm ci`, run `npm run check`, and start it. Database schema version is recorded with `PRAGMA user_version`. The network update migrates schemas 1–7 to schema 8. Existing profiles start with network listing switched off. Earlier migrations add the separate studio catalogue, self-published records and durable publication quotas; schema 7 widens the project language constraint to all 50 locales while retaining project rows and their child history in a checked transaction. The app refuses databases with a newer schema than it understands. To roll back to an older application, restore its compatible pre-upgrade backup into a fresh data directory; do not edit `PRAGMA user_version` or reopen schema 8 with old code. Imported and self-published catalogue records, management-key hashes and quota state are included in SQLite backups; no external catalogue service is needed after import.

Existing Supabase accounts, password hashes and historical orders require a separate migration. Public studio directory records can be connected through the [operator catalogue importer](CATALOG_IMPORT.md), which stores only its allowlisted fields. Keep source data and database snapshots outside the public repository.
