# Neofab CAD engine

The optional CAD worker turns a bounded declarative specification into separate
parts and an assembly. It runs locally, without an AI provider, Vercel or Supabase.
The source is in [`cad-worker/`](../cad-worker/); provenance and the retained MIT
license are in [`NOTICE.md`](../cad-worker/NOTICE.md) and
[`LICENSE`](../cad-worker/LICENSE).

## Install and build an example

Use Python 3.12 in a virtual environment. The direct runtime dependencies are
pinned in `cad-worker/requirements.txt`.

```sh
python3.12 -m venv cad-worker/.venv
cad-worker/.venv/bin/python -m pip install -r cad-worker/requirements.txt
cad-worker/.venv/bin/python cad-worker/worker.py --check
mkdir -p cad-worker/out
cad-worker/.venv/bin/python cad-worker/worker.py \
  --input cad-worker/examples/plate.json \
  --output cad-worker/out/plate
```

`--check` imports the installed CAD stack and returns
`{"compiler_version":"1.0.0","cadquery_version":"2.8.0","ready":true}`.
An absent or broken dependency returns exit code 2 with a bounded error on stderr.
The CLI accepts stdin when `--input -` is used or `--input` is omitted.

The output directory must be new or empty. Existing files are preserved by
rejecting a nonempty directory. The compiler first writes into a private staging
directory, then publishes the completed directory with a rename. A regular failure
removes the staging directory. The supervising server must clean up the entire
private job directory after a timeout, kill or crash.

The plate example has a 60 × 40 × 6 mm body and an 8 mm central hole. Its volume is
`60 * 40 * 6 - pi * 4^2 * 6` mm³. The furniture example
[`panel-shelf.json`](../cad-worker/examples/panel-shelf.json) has three separate
panels within a 500 × 250 × 300 mm envelope. Its report deliberately fails the
declared-completeness check because fastening and joinery remain undesigned.

## Contract

[`spec.schema.json`](../cad-worker/spec.schema.json) describes the wire format.
The additional cross-field and polygon checks are implemented in
[`cad.py`](../cad-worker/cad.py) and mirrored by the application's
[`shared/cad.ts`](../shared/cad.ts).

All fields are explicit; unknown fields are rejected. The schema version is
`neofab-cad/1` and units are millimetres. A specification contains a title,
description, material/process labels, assumptions, declared missing geometry,
root operations, components and geometry requirements.

Supported operations:

| Operation  | Parameters                                  | Meaning                                           |
| ---------- | ------------------------------------------- | ------------------------------------------------- |
| `box`      | `mode`, `size`, `at`                        | Add or subtract an axis-aligned box               |
| `cylinder` | `mode`, `radius`, `height`, `axis`, `at`    | Add or subtract a cylinder                        |
| `extrude`  | `mode`, `points`, `plane`, `distance`, `at` | Add or subtract a simple closed polygon extrusion |
| `fillet`   | `radius`, `selector`                        | Round selected edges of the existing body         |
| `chamfer`  | `length`, `selector`                        | Chamfer selected edges of the existing body       |

Each operation has an ASCII identifier matching
`^[A-Za-z][A-Za-z0-9_-]{0,39}$`. Edge selectors are limited to `|X`, `|Y`, `|Z`,
`>Z`, `<Z`, or `all`. No Python, expressions, shell commands, filesystem paths,
network addresses, arbitrary selectors or external imports are accepted.

Components have unique identifiers, name/material/process metadata, operations,
translation `at`, rotation `rotation`, and `quantity: 1`. Rotation applies around
the local origin in X, then Y, then Z order, in degrees; translation follows.
Represent multiple positioned instances as separate components. Root operations
create an additional component with reserved identifier `body`.

| Limit                                 | Value                                             |
| ------------------------------------- | ------------------------------------------------- |
| Input JSON                            | 256 KiB                                           |
| Total components, including root body | 24                                                |
| Operations per component or root body | 60                                                |
| Operations across the specification   | 300                                               |
| Polygon vertices                      | 3–100, unique and non-self-intersecting           |
| Coordinates and rotations             | Finite numbers from −2000 to 2000                 |
| Dimensions                            | Finite numbers greater than 0 and at most 2000 mm |
| Expected solid count                  | Integer from 1 to 24                              |
| Geometry comparison tolerance         | Greater than 0 and at most 10 mm                  |
| Display mesh                          | At most 200,000 vertices and 200,000 triangles    |
| Individual artifact                   | 32 MiB                                            |
| All output artifacts                  | 128 MiB                                           |

Numbers are not coerced from strings or booleans. Duplicate JSON object keys,
nonfinite numbers, duplicate identifiers, invalid polygons, empty bodies and
cuts outside a body are rejected. Quantity and units are never guessed.

## Artifacts and checks

Successful execution returns one JSON line on stdout with
`schema_version: "neofab-cad-result/1"`, `passed`, `compiler_version`, and
`manifest: "manifest.json"`. Kernel diagnostics go to stderr. Exit code 0 means
artifacts were built; consult `report.passed` for geometry check results. Failed
checks remain available for design review instead of being presented as an
approved model. Invalid input or a kernel/export failure returns exit code 2.

| Artifact               | Content                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `model.step`           | Assembly with separate named bodies, in world coordinates                |
| `model.stl`            | Binary triangulated assembly in world coordinates                        |
| `parts/<id>/<id>.step` | Individual part in local coordinates                                     |
| `parts/<id>/<id>.stl`  | Individual binary STL in local coordinates                               |
| `mesh.json`            | World-coordinate vertices, triangle indices, component groups and bounds |
| `bom.csv`              | One row per component; text cells escaped against spreadsheet formulas   |
| `spec.json`            | Validated declarative input for rebuilding and editing                   |
| `report.json`          | Geometry measurements, checks, warnings and operation log                |
| `parts.zip`            | CAD files, mesh, BOM, declarative spec and report; no executable source  |
| `manifest.json`        | Relative artifact paths, exact byte lengths and SHA-256 hashes           |

The manifest uses `neofab-cad-manifest/1` and contains
`artifacts: [{path, size, sha256}]`. It excludes itself to avoid a self-hash. The
archive excludes both itself and the manifest. Hash the stored manifest separately
when binding an immutable model version to a project or request for quotation.

The mesh uses `neofab-cad-mesh/1`, `units: "mm"`, `vertices: [[x,y,z]]`,
`triangles: [[i,j,k]]`, `bounds: [xLength,yLength,zLength]`, and
`groups: [{id,name,start,count,center}]`. Group `start` and `count` refer to
triangles, not flat vertex/index-buffer offsets.

The report uses `neofab-cad-report/1` and `compiler_version: "1.0.0"`. It checks
B-Rep validity, one solid per component, declared total solid count, declared
bounding-box dimensions, declared missing geometry and pairwise volume
intersections. Component bounds are measured in local coordinates; assembly
bounds use world coordinates. Bounds are computed from B-Rep, independent of
cached display triangulation. Every report retains
`verification_scope: "geometry_only"` and
`manufacturing_release: "requires_engineer_review"`.

These checks do not verify design intent, fit, strength, fatigue, stability,
material selection, wall thickness, tool access, GD&T, stock or process
compensation. Material/process names are metadata. A missing-geometry list is a
declaration, not an independent test of completeness. There is no CAM, slicing,
postprocessor, machine code, STEP import, freeform surface design or validated
assembly constraint solver in this worker.

Geometry is deterministic for the same supported specification and runtime.
STEP metadata can include timestamps; repeat builds are not promised to be
byte-identical. Freeze actual exported bytes and their manifest hashes for handoff.
STEP transports B-Rep, not this compiler's parameter history; `spec.json` preserves
the editable declarative parameters. See the official
[CadQuery installation guide](https://cadquery.readthedocs.io/en/latest/installation.html)
and [import/export documentation](https://cadquery.readthedocs.io/en/latest/importexport.html).

## Isolation and supervision

This is a fixed one-shot compiler, with no HTTP listener, provider configuration or
network client. The parent server chooses a trusted Python executable and script
path, strips credentials from the environment, enforces ownership, queues jobs,
sets a wall-clock deadline, caps captured output and verifies every artifact before
publishing it. A safe invocation uses `--output <private-job-dir>/out`; never pass
an upload's original filename as the output path.

On POSIX systems the CLI sets CPU time to 90 seconds, file size to 128 MiB, open
files to 128 and core dumps to zero before importing CadQuery. Linux additionally
caps virtual address space at 3 GiB. Native BLAS/OpenMP thread pools are limited to
one. macOS does not use `RLIMIT_AS`, which is unreliable with native frameworks.
These are defensive bounds, not a sandbox for running untrusted executable code.
The supervisor must terminate the process group on timeout and remove its private
working directory. Linux additionally binds the worker lifetime to its parent
with `PR_SET_PDEATHSIG(SIGKILL)`; pass `--parent-pid` with the supervisor PID to
detect a parent exit during interpreter startup. This parent-death mechanism is
not available on macOS; explicit timeout/shutdown handling and CPU limits remain
necessary. A shared host also needs instance storage and concurrency caps.

A separate image can be built from the worker directory:

```sh
docker build -t neofab-cad:local cad-worker
docker run --rm --network=none --read-only \
  --cap-drop=ALL --security-opt=no-new-privileges \
  --pids-limit=64 --memory=3g --cpus=2 \
  --tmpfs /tmp:rw,nosuid,nodev,size=256m \
  neofab-cad:local --check
```

For compilation, mount the input directory read-only and a caller-owned private
output directory read-write, and pass paths inside the container. The image runs
as UID/GID 10001; the mounted output directory must be writable by that identity
or by an explicitly selected unprivileged runtime UID. Network access is needed
when building the image to install dependencies, not for compilation.

To run the complete application with the optional CAD runtime, use the repository
Compose override:

```sh
docker compose -f compose.yaml -f compose.cad.yaml up --build -d
```

This selects the `cad` build target, sets `CAD_PYTHON=/opt/cad/bin/python`, and
bounds the app plus worker to 4 GiB of memory, two CPUs and 256 processes/threads.
The default image ends at the separate `standalone` target and does not install
Python or CadQuery. Both targets retain the unprivileged Node application user and
the same persistent data volume. The combined optional image uses Debian's
Python 3.11; the standalone worker image and the dedicated CI job use Python 3.12.
No model API key is required to compile the manually authored geometry.

After a local application build, `CAD_PYTHON=/absolute/path/to/python node
scripts/cad-check.mjs` compiles both examples and passes the actual files through
the server's artifact, schema and SHA-256 validator. CI additionally runs the CAD
browser flow and compiles the plate inside the optional container. This documents
the intended checks; their result must be read from the relevant CI run.

## Verification

```sh
cad-worker/.venv/bin/python -m pip install -r cad-worker/requirements-test.txt
cad-worker/.venv/bin/python -m pytest cad-worker/tests -q
```

The suite exercises analytic volumes, STEP round-trip, separate assembly parts,
world/local transforms, extrusion, chamfer and fillet results, interference,
declared missing geometry, bounds, mesh indices, manifest hashes, strict limits,
CSV formulas and atomic CLI failures. Tests require the actual CAD kernel; they do
not replace it with mocks. Hosted multiuser operation, Docker runtime behavior and
physical manufacturing must be validated separately from a local kernel run.
