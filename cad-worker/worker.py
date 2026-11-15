"""One-shot CLI. Model data enters via JSON; stdout is one result JSON line."""

import argparse
import json
import os
from pathlib import Path
import shutil
import signal
import sys
import tempfile

MAX_INPUT_BYTES = 256 * 1024


def bind_parent(expected_parent=None):
    """Linux: a killed supervisor must not leave a native kernel job running."""
    if not sys.platform.startswith("linux"):
        return
    import ctypes
    parent = os.getppid() if expected_parent is None else expected_parent
    if os.getppid() != parent:
        raise ValueError("CAD supervisor exited before worker startup")
    libc = ctypes.CDLL(None, use_errno=True)
    libc.prctl.argtypes = [ctypes.c_int, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong]
    libc.prctl.restype = ctypes.c_int
    # PR_SET_PDEATHSIG = 1; fixed libc call, no dynamic input is executed.
    if libc.prctl(1, signal.SIGKILL, 0, 0, 0) != 0:
        raise OSError(ctypes.get_errno(), "Cannot bind CAD worker lifetime to supervisor")
    if os.getppid() != parent:
        os.kill(os.getpid(), signal.SIGKILL)


def resource_limits():
    # Limit native BLAS/OpenMP thread pools before importing the CAD stack.
    for key in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
        os.environ[key] = "1"
    try:
        import resource
    except ImportError:
        return
    caps = [(resource.RLIMIT_CPU, 90), (resource.RLIMIT_FSIZE, 128 * 1024 * 1024),
            (resource.RLIMIT_NOFILE, 128), (resource.RLIMIT_CORE, 0)]
    if sys.platform.startswith("linux"):
        # RLIMIT_AS is unreliable for macOS native frameworks. Linux also gets the container memory cap.
        caps.append((resource.RLIMIT_AS, 3 * 1024 * 1024 * 1024))
    for kind, maximum in caps:
        _, hard = resource.getrlimit(kind)
        ceiling = maximum if hard == resource.RLIM_INFINITY else min(maximum, hard)
        resource.setrlimit(kind, (ceiling, ceiling))


def _unique_object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("Duplicate JSON object key")
        value[key] = item
    return value


def read_spec(source):
    if source == "-":
        payload = sys.stdin.buffer.read(MAX_INPUT_BYTES + 1)
    else:
        path = Path(source)
        if path.is_symlink() or not path.is_file():
            raise ValueError("Input must be a regular file")
        with path.open("rb") as handle:
            payload = handle.read(MAX_INPUT_BYTES + 1)
    if len(payload) > MAX_INPUT_BYTES:
        raise ValueError("Input exceeds 256 KiB")
    def reject_constant(_):
        raise ValueError("Non-finite JSON numbers are forbidden")
    return json.loads(payload.decode("utf-8"), object_pairs_hook=_unique_object, parse_constant=reject_constant)


def main():
    parser = argparse.ArgumentParser(description="Compile a bounded Neofab CAD JSON specification")
    parser.add_argument("--input", default="-", help="JSON file or - for stdin")
    parser.add_argument("--output", help="New or empty private output directory")
    parser.add_argument("--check", action="store_true", help="Check the installed CAD runtime")
    parser.add_argument("--parent-pid", type=int, help="Expected supervisor PID for Linux startup-race protection")
    args = parser.parse_args()
    staging = None
    try:
        if args.parent_pid is not None and args.parent_pid < 1:
            raise ValueError("Parent PID must be positive")
        bind_parent(args.parent_pid)
        resource_limits()
        if args.check:
            from cad import COMPILER_VERSION
            import cadquery
            print(json.dumps({"compiler_version": COMPILER_VERSION, "cadquery_version": cadquery.__version__, "ready": True}), flush=True)
            return 0
        if not args.output:
            raise ValueError("--output is required for compilation")
        raw = read_spec(args.input)
        requested_output = Path(args.output).absolute()
        if requested_output.is_symlink():
            raise ValueError("Output directory must not be a symlink")
        # Resolve trusted CLI parent paths (macOS /var itself is a symlink).
        # A caller must own the parent; the model specification never supplies paths.
        output = requested_output.parent.resolve(strict=True) / requested_output.name
        if not output.parent.is_dir():
            raise ValueError("Output parent directory must already exist")
        if output.exists() and (not output.is_dir() or any(output.iterdir())):
            raise ValueError("Output directory must be new or empty")
        staging = Path(tempfile.mkdtemp(prefix=".neofab-cad-", dir=output.parent))
        # CAD kernel diagnostics belong on stderr, including native stdout writes.
        saved_stdout = os.dup(1)
        try:
            os.dup2(2, 1)
            from cad import compile_part
            report = compile_part(raw, staging)
            sys.stdout.flush()
        finally:
            os.dup2(saved_stdout, 1)
            os.close(saved_stdout)
        if output.exists():
            output.rmdir()
        os.replace(staging, output)
        staging = None
        print(json.dumps({"schema_version": "neofab-cad-result/1", "passed": report["passed"],
                          "manifest": "manifest.json", "compiler_version": report["compiler_version"]}), flush=True)
        return 0
    except Exception as error:
        print(json.dumps({"error": "CAD_BUILD_FAILED", "message": str(error)[:800]}), file=sys.stderr, flush=True)
        return 2
    finally:
        if staging is not None:
            shutil.rmtree(staging, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
