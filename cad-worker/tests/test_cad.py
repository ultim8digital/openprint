import copy
import csv
import hashlib
import io
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import time
import zipfile

import cadquery as cq
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from cad import Spec, compile_part, precise_box  # noqa: E402


@pytest.fixture
def plate():
    return json.loads((ROOT / "examples" / "plate.json").read_text())


@pytest.fixture
def shelf():
    return json.loads((ROOT / "examples" / "panel-shelf.json").read_text())


def test_plate_volume_step_roundtrip_and_manifest(plate, tmp_path):
    report = compile_part(plate, tmp_path / "out")
    assert report["passed"]
    expected = 60 * 40 * 6 - math.pi * 4**2 * 6
    assert report["volume_mm3"] == pytest.approx(expected, abs=0.0001)
    restored = cq.importers.importStep(str(tmp_path / "out" / "model.step"))
    solids = restored.solids().vals()
    assert len(solids) == 1 and solids[0].isValid()
    assert solids[0].Volume() == pytest.approx(expected, rel=1e-7)
    assert report["bounds_mm"] == pytest.approx([60, 40, 6], abs=1e-6)
    assert report["verification_scope"] == "geometry_only"
    assert report["manufacturing_release"] == "requires_engineer_review"
    manifest = json.loads((tmp_path / "out" / "manifest.json").read_text())
    assert manifest["schema_version"] == "neofab-cad-manifest/1"
    paths = {item["path"] for item in manifest["artifacts"]}
    assert paths == {"bom.csv", "mesh.json", "model.step", "model.stl", "parts.zip", "parts/body/body.step", "parts/body/body.stl", "report.json", "spec.json"}
    for item in manifest["artifacts"]:
        data = (tmp_path / "out" / item["path"]).read_bytes()
        assert len(data) == item["size"]
        assert hashlib.sha256(data).hexdigest() == item["sha256"]
    with zipfile.ZipFile(tmp_path / "out" / "parts.zip") as archive:
        assert set(archive.namelist()) == paths - {"parts.zip"}
        assert not any(name.endswith((".py", ".js", ".sh")) for name in archive.namelist())


def test_assembly_preserves_components_local_parts_and_world_mesh(shelf, tmp_path):
    shelf["missing_geometry"] = []
    report = compile_part(shelf, tmp_path)
    assert report["passed"] and report["solids"] == 3
    assert report["bounds_mm"] == pytest.approx([500, 250, 300], abs=1e-6)
    assert report["volume_mm3"] == pytest.approx(500 * 250 * 18 + 2 * 18 * 250 * 282, abs=0.0001)
    restored = cq.importers.importStep(str(tmp_path / "model.step"))
    assert len(restored.solids().vals()) == 3
    top = cq.importers.importStep(str(tmp_path / "parts/top/top.step")).val()
    assert precise_box(top).zmin == pytest.approx(0, abs=1e-6)
    assert precise_box(top).zmax == pytest.approx(18, abs=1e-6)
    mesh = json.loads((tmp_path / "mesh.json").read_text())
    assert len(mesh["groups"]) == 3
    assert sum(group["count"] for group in mesh["groups"]) == len(mesh["triangles"])
    assert mesh["groups"][0]["center"] == pytest.approx([250, 125, 291])
    for triangle in mesh["triangles"]:
        assert len(triangle) == 3 and all(0 <= index < len(mesh["vertices"]) for index in triangle)
    assert all(math.isfinite(value) for vertex in mesh["vertices"] for value in vertex)


def test_missing_geometry_and_bounds_are_not_accepted(shelf, tmp_path):
    shelf["requirements"]["bounds"] = [500, 250, 350]
    report = compile_part(shelf, tmp_path)
    assert not report["passed"]
    failed = {check["code"] for check in report["checks"] if not check["passed"]}
    assert failed == {"bounds", "missing_geometry"}


def test_interference_and_solid_count_fail(shelf, tmp_path):
    shelf["missing_geometry"] = []
    shelf["components"][2]["at"] = [0, 0, 0]
    shelf["requirements"]["bounds"] = None
    shelf["requirements"]["expected_solids"] = 2
    report = compile_part(shelf, tmp_path)
    failed = {check["code"] for check in report["checks"] if not check["passed"]}
    assert failed == {"interference", "solid_count"}


def test_outside_cut_and_empty_result_rejected(plate, tmp_path):
    plate["operations"][1]["at"] = [1000, 1000, 1000]
    with pytest.raises(ValueError, match="does not intersect"):
        compile_part(plate, tmp_path / "outside")
    plate["operations"][1] = {"id": "remove", "type": "box", "mode": "cut", "at": [-1, -1, -1], "size": [62, 42, 8]}
    with pytest.raises(ValueError, match="invalid or empty"):
        compile_part(plate, tmp_path / "empty")


def test_extrusion_chamfer_and_rotation_numerically(plate, tmp_path):
    plate["operations"] = [
        {"id": "outline", "type": "extrude", "mode": "add", "points": [[0, 0], [20, 0], [20, 10], [0, 10]], "plane": "XY", "distance": 4, "at": [0, 0, 0]},
        {"id": "corners", "type": "chamfer", "length": 1, "selector": "|Z"},
    ]
    plate["requirements"]["bounds"] = [20, 10, 4]
    report = compile_part(plate, tmp_path / "chamfer")
    assert report["passed"]
    assert report["volume_mm3"] == pytest.approx(20 * 10 * 4 - 4 * (1 * 1 / 2) * 4)
    operations = plate["operations"]
    plate["operations"] = []
    plate["components"] = [{"id": "rotated", "name": "Rotated", "material": "", "process": "", "quantity": 1, "at": [50, 30, 10], "rotation": [0, 0, 90], "operations": operations}]
    plate["requirements"]["bounds"] = [10, 20, 4]
    rotated = compile_part(plate, tmp_path / "rotated")
    assert rotated["passed"]
    assert rotated["bounds_mm"] == pytest.approx([10, 20, 4])
    assert rotated["volume_mm3"] == pytest.approx(report["volume_mm3"])


def test_fillet_preserves_bounds_and_changes_volume(plate, tmp_path):
    plate["operations"] = [plate["operations"][0], {"id": "rounded", "type": "fillet", "radius": 2, "selector": "|Z"}]
    report = compile_part(plate, tmp_path)
    assert report["passed"]
    expected = 60 * 40 * 6 - (4 - math.pi) * 2**2 * 6
    assert report["volume_mm3"] == pytest.approx(expected, abs=0.0001)


@pytest.mark.parametrize("bad", [float("nan"), float("inf"), True, "60", 0, 2001])
def test_numeric_inputs_are_strict_finite_and_bounded(plate, bad):
    plate["operations"][0]["size"][0] = bad
    with pytest.raises(ValueError):
        Spec.model_validate(plate)


def test_paths_code_duplicate_ids_and_body_collision_are_rejected(plate, shelf):
    malicious = copy.deepcopy(plate)
    malicious["operations"][0]["id"] = "../escape"
    with pytest.raises(ValueError):
        Spec.model_validate(malicious)
    malicious = copy.deepcopy(plate)
    malicious["operations"][0]["type"] = "exec"
    with pytest.raises(ValueError):
        Spec.model_validate(malicious)
    malicious = copy.deepcopy(plate)
    malicious["python"] = "print('must never run')"
    with pytest.raises(ValueError):
        Spec.model_validate(malicious)
    malicious = copy.deepcopy(plate)
    malicious["operations"][1]["id"] = malicious["operations"][0]["id"]
    with pytest.raises(ValueError, match="unique"):
        Spec.model_validate(malicious)
    malicious = copy.deepcopy(plate)
    malicious["components"] = [shelf["components"][0]]
    malicious["components"][0]["id"] = "body"
    with pytest.raises(ValueError, match="unique"):
        Spec.model_validate(malicious)
    shelf["components"][0]["quantity"] = True
    with pytest.raises(ValueError):
        Spec.model_validate(shelf)


def test_total_component_and_operation_limits(plate, shelf):
    component = shelf["components"][0]
    plate["components"] = [{**copy.deepcopy(component), "id": f"part{i}"} for i in range(24)]
    with pytest.raises(ValueError, match="24 total"):
        Spec.model_validate(plate)
    plate["operations"] = []
    assert len(Spec.model_validate(plate).components) == 24
    plate["components"] = plate["components"][:6]
    for part in plate["components"]:
        part["operations"] = [{**copy.deepcopy(component["operations"][0]), "id": f"op{i}"} for i in range(51)]
    with pytest.raises(ValueError, match="300"):
        Spec.model_validate(plate)


@pytest.mark.parametrize("points", [
    [[0, 0], [10, 10], [0, 10], [10, 0]],
    [[0, 0], [10, 0], [0, 0]],
    [[0, 0], [10, 0], [20, 0]],
])
def test_degenerate_or_self_intersecting_profile_rejected(plate, points):
    plate["operations"] = [{"id": "bad", "type": "extrude", "mode": "add", "points": points, "plane": "XY", "distance": 4, "at": [0, 0, 0]}]
    with pytest.raises(ValueError):
        Spec.model_validate(plate)


def test_csv_names_cannot_be_formulas(plate, tmp_path):
    plate["name"] = "=1+2"
    plate["material"] = "  @SUM(1,2)"
    plate["process"] = "\t+cmd"
    compile_part(plate, tmp_path)
    rows = list(csv.reader(io.StringIO((tmp_path / "bom.csv").read_text(encoding="utf-8-sig"))))
    assert rows[1][1] == "'=1+2"
    assert rows[1][3] == "'  @SUM(1,2)"
    assert rows[1][4] == "'\t+cmd"


def _cli(tmp_path, payload, *arguments):
    return subprocess.run([sys.executable, str(ROOT / "worker.py"), "--output", str(tmp_path / "result"), *arguments],
                          input=payload, text=True, capture_output=True, timeout=30)


def test_cli_stdin_and_failed_checks_still_export(shelf, tmp_path):
    result = _cli(tmp_path, json.dumps(shelf))
    assert result.returncode == 0, result.stderr
    status = json.loads(result.stdout)
    assert status["schema_version"] == "neofab-cad-result/1" and status["passed"] is False
    assert (tmp_path / "result" / "manifest.json").is_file()
    assert not list(tmp_path.glob(".neofab-cad-*"))


@pytest.mark.parametrize("payload", ['{"x":1,"x":2}', '{"x":NaN}', "x" * (256 * 1024 + 1)])
def test_cli_rejects_ambiguous_and_oversized_input_atomically(payload, tmp_path):
    result = _cli(tmp_path, payload)
    assert result.returncode == 2
    assert result.stdout == "" and '"error": "CAD_BUILD_FAILED"' in result.stderr
    assert not (tmp_path / "result").exists()
    assert not list(tmp_path.glob(".neofab-cad-*"))


def test_cli_failed_geometry_does_not_publish_partial_files(plate, tmp_path):
    plate["operations"][1]["at"] = [1000, 1000, 1000]
    result = _cli(tmp_path, json.dumps(plate))
    assert result.returncode == 2 and result.stdout == ""
    assert not (tmp_path / "result").exists()
    assert not list(tmp_path.glob(".neofab-cad-*"))


def test_cli_preserves_existing_output_and_rejects_symlink(plate, tmp_path):
    target = tmp_path / "result"
    target.mkdir()
    (target / "keep").write_text("existing work")
    result = _cli(tmp_path, json.dumps(plate))
    assert result.returncode == 2 and (target / "keep").read_text() == "existing work"
    (target / "keep").unlink()
    target.rmdir()
    target.symlink_to(tmp_path / "other", target_is_directory=True)
    result = _cli(tmp_path, json.dumps(plate))
    assert result.returncode == 2 and target.is_symlink()


def test_runtime_check():
    result = subprocess.run([sys.executable, str(ROOT / "worker.py"), "--check"], text=True, capture_output=True, timeout=20)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == {"compiler_version": "1.0.0", "cadquery_version": "2.8.0", "ready": True}


@pytest.mark.skipif(not sys.platform.startswith("linux"), reason="Linux parent-death signal")
def test_native_worker_dies_when_supervisor_exits():
    child_code = f"import sys,os,time; sys.path.insert(0,{str(ROOT)!r}); from worker import bind_parent; bind_parent(os.getppid()); print('armed',flush=True); time.sleep(60)"
    supervisor_code = f"import subprocess,sys,time; p=subprocess.Popen([sys.executable,'-c',{child_code!r}],stdout=subprocess.PIPE,text=True); assert p.stdout.readline().strip()=='armed'; print(p.pid,flush=True); time.sleep(60)"
    supervisor = subprocess.Popen([sys.executable, "-c", supervisor_code], stdout=subprocess.PIPE, text=True)
    child_pid = None
    child_alive = True
    try:
        child_pid = int(supervisor.stdout.readline())
        supervisor.terminate()
        supervisor.wait(timeout=5)
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline:
            status = Path(f"/proc/{child_pid}/stat")
            try:
                state = status.read_text().split()[2]
            except FileNotFoundError:
                state = "gone"
            if state in ("gone", "Z"):
                child_alive = False
                break
            time.sleep(0.02)
        else:
            pytest.fail("Native CAD worker survived supervisor termination")
    finally:
        if supervisor.poll() is None:
            supervisor.kill()
            supervisor.wait(timeout=5)
        if child_pid is not None and child_alive:
            try:
                os.kill(child_pid, 9)
            except ProcessLookupError:
                pass


@pytest.mark.skipif(not sys.platform.startswith("linux"), reason="Linux parent-death signal")
def test_cli_rejects_wrong_supervisor_pid(tmp_path):
    result = _cli(tmp_path, "{}", "--parent-pid", "2147483647")
    assert result.returncode == 2 and result.stdout == ""
    assert "supervisor exited" in result.stderr
