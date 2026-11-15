"""Bounded declarative geometry compiler. No user-provided code is executed.

Geometry core adapted from ultim8digital/neofab d65ab5d (MIT); see NOTICE.md.
"""

import csv
import hashlib
import io
import json
import math
import zipfile
from pathlib import Path
from typing import Annotated, Literal, Union

import cadquery as cq
from OCP.Bnd import Bnd_Box
from OCP.BRepBndLib import BRepBndLib
from pydantic import BaseModel, ConfigDict, Field, model_validator

COMPILER_VERSION = "1.0.0"
MAX_INPUT_BYTES = 256 * 1024
MAX_FILE_BYTES = 32 * 1024 * 1024
MAX_OUTPUT_BYTES = 128 * 1024 * 1024
MAX_MESH_VERTICES = 200_000
MAX_MESH_TRIANGLES = 200_000
ID_PATTERN = r"^[A-Za-z][A-Za-z0-9_-]{0,39}$"
Identifier = Annotated[str, Field(strict=True, pattern=ID_PATTERN)]
Name = Annotated[str, Field(strict=True, min_length=1, max_length=120)]
Metadata = Annotated[str, Field(strict=True, max_length=160)]
Note = Annotated[str, Field(strict=True, max_length=500)]
Finite = Annotated[float, Field(strict=True, ge=-2000, le=2000, allow_inf_nan=False)]
Positive = Annotated[float, Field(strict=True, gt=0, le=2000, allow_inf_nan=False)]
Point = tuple[Finite, Finite, Finite]
Selector = Literal["|X", "|Y", "|Z", ">Z", "<Z", "all"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Box(Strict):
    type: Literal["box"]
    id: Identifier
    mode: Literal["add", "cut"]
    size: tuple[Positive, Positive, Positive]
    at: Point


class Cylinder(Strict):
    type: Literal["cylinder"]
    id: Identifier
    mode: Literal["add", "cut"]
    radius: Positive
    height: Positive
    axis: Literal["x", "y", "z"]
    at: Point


def _orientation(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _on_segment(a, b, p):
    return (min(a[0], b[0]) - 1e-9 <= p[0] <= max(a[0], b[0]) + 1e-9
            and min(a[1], b[1]) - 1e-9 <= p[1] <= max(a[1], b[1]) + 1e-9)


def _segments_intersect(a, b, c, d):
    values = (_orientation(a, b, c), _orientation(a, b, d),
              _orientation(c, d, a), _orientation(c, d, b))
    if values[0] * values[1] < 0 and values[2] * values[3] < 0:
        return True
    return any(abs(value) <= 1e-9 and _on_segment(start, end, point)
               for value, start, end, point in (
                   (values[0], a, b, c), (values[1], a, b, d),
                   (values[2], c, d, a), (values[3], c, d, b)))


class Extrude(Strict):
    type: Literal["extrude"]
    id: Identifier
    mode: Literal["add", "cut"]
    points: list[tuple[Finite, Finite]] = Field(min_length=3, max_length=100)
    plane: Literal["XY", "XZ", "YZ"]
    distance: Positive
    at: Point

    @model_validator(mode="after")
    def simple_polygon(self):
        points = self.points
        if len(set(points)) != len(points):
            raise ValueError("Polygon vertices must be unique; do not repeat the first vertex")
        area = sum(a[0] * b[1] - b[0] * a[1]
                   for a, b in zip(points, points[1:] + points[:1])) / 2
        if abs(area) < 1e-7:
            raise ValueError("Polygon area is zero")
        for i in range(len(points)):
            for j in range(i + 1, len(points)):
                if j == i + 1 or (i == 0 and j == len(points) - 1):
                    continue
                if _segments_intersect(points[i], points[(i + 1) % len(points)],
                                       points[j], points[(j + 1) % len(points)]):
                    raise ValueError("Polygon must not self-intersect")
        return self


class Fillet(Strict):
    type: Literal["fillet"]
    id: Identifier
    radius: Positive
    selector: Selector


class Chamfer(Strict):
    type: Literal["chamfer"]
    id: Identifier
    length: Positive
    selector: Selector


Operation = Annotated[Union[Box, Cylinder, Extrude, Fillet, Chamfer], Field(discriminator="type")]


class Requirements(Strict):
    expected_solids: Annotated[int, Field(strict=True, ge=1, le=24)]
    bounds: tuple[Positive, Positive, Positive] | None
    tolerance: Annotated[float, Field(strict=True, gt=0, le=10, allow_inf_nan=False)]


class Component(Strict):
    id: Identifier
    name: Name
    material: Metadata
    process: Metadata
    operations: list[Operation] = Field(min_length=1, max_length=60)
    at: Point
    rotation: Point
    quantity: Annotated[int, Field(strict=True, ge=1, le=1)]

    @model_validator(mode="after")
    def unique_operations(self):
        if len({op.id for op in self.operations}) != len(self.operations):
            raise ValueError("Operation IDs must be unique within each component")
        return self


class Spec(Strict):
    schema_version: Literal["neofab-cad/1"]
    name: Name
    units: Literal["mm"]
    material: Metadata
    process: Metadata
    description: Annotated[str, Field(strict=True, max_length=4000)]
    assumptions: list[Note] = Field(max_length=30)
    missing_geometry: list[Note] = Field(max_length=30)
    operations: list[Operation] = Field(max_length=60)
    components: list[Component] = Field(max_length=24)
    requirements: Requirements

    @model_validator(mode="after")
    def geometry(self):
        ids = (["body"] if self.operations else []) + [c.id for c in self.components]
        if not ids:
            raise ValueError("No geometry supplied")
        if len(ids) > 24:
            raise ValueError("Max 24 total components, including the root body")
        if len(ids) != len(set(ids)):
            raise ValueError("Component IDs must be unique, including the root body")
        if len({op.id for op in self.operations}) != len(self.operations):
            raise ValueError("Root operation IDs must be unique")
        if len(self.operations) + sum(len(c.operations) for c in self.components) > 300:
            raise ValueError("Max 300 total operations")
        return self


def precise_box(shape):
    """Measure B-Rep, not a cached display triangulation."""
    box = Bnd_Box()
    BRepBndLib.AddOptimal_s(shape.wrapped, box, False, False)
    return cq.BoundBox(box)


def _shape_bounds(shape):
    box = precise_box(shape)
    return [box.xlen, box.ylen, box.zlen]


def build(operations):
    result = None
    log = []
    for op in operations:
        before = result.Volume() if result else 0
        try:
            if isinstance(op, (Fillet, Chamfer)):
                if result is None:
                    raise ValueError("Edge treatment requires a base solid")
                edges = cq.Workplane(obj=result).edges() if op.selector == "all" else cq.Workplane(obj=result).edges(op.selector)
                result = (edges.fillet(op.radius) if isinstance(op, Fillet) else edges.chamfer(op.length)).val()
            else:
                if isinstance(op, Box):
                    tool = cq.Solid.makeBox(*op.size, cq.Vector(*op.at))
                elif isinstance(op, Cylinder):
                    direction = {"x": (1, 0, 0), "y": (0, 1, 0), "z": (0, 0, 1)}[op.axis]
                    tool = cq.Solid.makeCylinder(op.radius, op.height, cq.Vector(*op.at), cq.Vector(*direction))
                else:
                    tool = cq.Workplane(op.plane, origin=op.at).polyline(op.points).close().extrude(op.distance).val()
                if op.mode == "add":
                    result = tool if result is None else result.fuse(tool).clean()
                else:
                    if result is None:
                        raise ValueError("Cut requires a base solid")
                    if result.intersect(tool).Volume() < 1e-7:
                        raise ValueError("Cut does not intersect the part")
                    result = result.cut(tool).clean()
            volume = result.Volume()
            if not result.isValid() or not math.isfinite(volume) or volume < 1e-7:
                raise ValueError("Operation produced invalid or empty geometry")
            if len(result.Solids()) > 24 or len(result.Faces()) > 12_000:
                raise ValueError("Geometry complexity limit exceeded")
            log.append({"id": op.id, "type": op.type, "volume_before": round(before, 4), "volume_after": round(volume, 4)})
        except Exception as error:
            raise ValueError(f"Operation {op.id}: {str(error)[:400]}") from error
    return result, log


def _write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n", encoding="utf-8")


def _csv_safe(value):
    text = str(value)
    # Spreadsheet import must not turn names/materials into formulas.
    if text.lstrip(" \t\r\n\v\f").startswith(("=", "+", "-", "@")) or text.startswith(("\t", "\r", "\n")):
        return "'" + text
    return text


def _bounded_files(out):
    files = sorted(path for path in out.rglob("*") if path.is_file())
    total = 0
    for path in files:
        if path.is_symlink():
            raise ValueError("Artifact symlinks are forbidden")
        size = path.stat().st_size
        if size > MAX_FILE_BYTES:
            raise ValueError("Artifact exceeds 32 MiB")
        total += size
    if total > MAX_OUTPUT_BYTES:
        raise ValueError("Artifacts exceed 128 MiB")
    return files


def _export_part(shape, directory, name):
    directory.mkdir(parents=True, exist_ok=True)
    cq.exporters.export(shape, str(directory / f"{name}.step"))
    if not shape.exportStl(str(directory / f"{name}.stl"), tolerance=0.05, angularTolerance=0.15,
                           ascii=False, relative=False, parallel=False):
        raise ValueError("STL export failed")


def compile_part(raw, out: Path):
    """Compile into a caller-owned empty directory; CLI supplies atomic publication."""
    spec = Spec.model_validate(raw)
    if out.is_symlink() or (out.exists() and any(out.iterdir())):
        raise ValueError("Output directory must be empty and not a symlink")
    out.mkdir(parents=True, exist_ok=True)
    parts, logs, checks = [], [], []
    if spec.operations:
        shape, log = build(spec.operations)
        parts.append(("body", spec.name, spec.material, spec.process, shape, shape))
        logs.append({"component": "body", "operations": log})
    for component in spec.components:
        local, log = build(component.operations)
        world = local
        for degrees, axis in zip(component.rotation, [(1, 0, 0), (0, 1, 0), (0, 0, 1)]):
            if degrees:
                world = world.rotate((0, 0, 0), axis, degrees)
        world = world.translate(component.at)
        parts.append((component.id, component.name, component.material, component.process, local, world))
        logs.append({"component": component.id, "operations": log})
    for part_id, _, _, _, local, _ in parts:
        checks.append({"code": "component_solid", "name": f"{part_id}: single valid solid", "passed": local.isValid() and len(local.Solids()) == 1, "detail": f"{len(local.Solids())} solid(s)"})
    compound = cq.Compound.makeCompound([part[5] for part in parts])
    bounds = _shape_bounds(compound)
    checks.extend([
        {"code": "brep", "name": "B-Rep validity", "passed": compound.isValid(), "detail": "OpenCascade geometry check"},
        {"code": "solid_count", "name": "Declared solid count", "passed": len(compound.Solids()) == spec.requirements.expected_solids, "detail": f"{len(compound.Solids())} / {spec.requirements.expected_solids}"},
        {"code": "missing_geometry", "name": "Declared missing geometry", "passed": not spec.missing_geometry, "detail": "; ".join(spec.missing_geometry) or "None declared; not an independent completeness assessment"},
    ])
    if spec.requirements.bounds is not None:
        checks.append({"code": "bounds", "name": "Declared bounding box", "passed": all(abs(a - b) <= spec.requirements.tolerance for a, b in zip(bounds, spec.requirements.bounds)), "detail": f"{[round(n, 4) for n in bounds]} mm; check tolerance {spec.requirements.tolerance} mm"})
    for index, first in enumerate(parts):
        for second in parts[index + 1:]:
            volume = first[5].intersect(second[5]).Volume()
            checks.append({"code": "interference", "name": f"Interference {first[0]} / {second[0]}", "passed": math.isfinite(volume) and volume < 1e-5, "detail": f"Common volume {volume:.6f} mm3"})
    report = {
        "schema_version": "neofab-cad-report/1", "compiler_version": COMPILER_VERSION,
        "passed": all(check["passed"] for check in checks), "verification_scope": "geometry_only",
        "manufacturing_release": "requires_engineer_review", "checks": checks,
        "warnings": ["Geometry checks do not authorize manufacture.", "Wall thickness, tool access, strength, fatigue, GD&T and process compensation are not checked.", "No CAM or machine code is generated."] + spec.assumptions,
        "bounds_mm": [round(n, 4) for n in bounds], "volume_mm3": round(compound.Volume(), 4),
        "solids": len(compound.Solids()), "operations": logs,
        "components": [{"id": p[0], "name": p[1], "material": p[2], "process": p[3], "quantity": 1, "bounds_mm": [round(n, 4) for n in _shape_bounds(p[4])], "volume_mm3": round(p[4].Volume(), 4)} for p in parts],
    }
    assembly = cq.Assembly(name="neofab")
    vertices, triangles, groups = [], [], []
    for part_id, name, _, _, local, world in parts:
        assembly.add(world, name=part_id)
        _export_part(local, out / "parts" / part_id, part_id)
        points, faces = world.tessellate(0.05, 0.15)
        if len(vertices) + len(points) > MAX_MESH_VERTICES or len(triangles) + len(faces) > MAX_MESH_TRIANGLES:
            raise ValueError("Mesh complexity limit exceeded")
        offset, start = len(vertices), len(triangles)
        vertices.extend([[point.x, point.y, point.z] for point in points])
        triangles.extend([[a + offset, b + offset, c + offset] for a, b, c in faces])
        groups.append({"id": part_id, "name": name, "start": start, "count": len(faces), "center": list(world.Center().toTuple())})
        _bounded_files(out)
    assembly.export(str(out / "model.step"), exportType="STEP", unit="MM")
    if not compound.exportStl(str(out / "model.stl"), tolerance=0.05, angularTolerance=0.15, ascii=False, relative=False, parallel=False):
        raise ValueError("Assembly STL export failed")
    _write_json(out / "mesh.json", {"schema_version": "neofab-cad-mesh/1", "units": "mm", "vertices": vertices, "triangles": triangles, "groups": groups, "bounds": bounds})
    _write_json(out / "spec.json", spec.model_dump(mode="json"))
    _write_json(out / "report.json", report)
    bom = io.StringIO(newline="")
    writer = csv.writer(bom)
    writer.writerow(["id", "name", "quantity", "material", "process"])
    writer.writerows([[_csv_safe(value) for value in (p[0], p[1], 1, p[2], p[3])] for p in parts])
    (out / "bom.csv").write_text(bom.getvalue(), encoding="utf-8-sig", newline="")
    # ZIP contains declarative JSON, reports and CAD files only, never executable source.
    archive_files = _bounded_files(out)
    with zipfile.ZipFile(out / "parts.zip", "w", zipfile.ZIP_DEFLATED) as archive:
        for path in archive_files:
            relative = path.relative_to(out).as_posix()
            metadata = zipfile.ZipInfo(relative, date_time=(1980, 1, 1, 0, 0, 0))
            metadata.compress_type = zipfile.ZIP_DEFLATED
            metadata.external_attr = 0o100644 << 16
            archive.writestr(metadata, path.read_bytes())
    files = _bounded_files(out)
    manifest = {"schema_version": "neofab-cad-manifest/1", "artifacts": [
        {"path": path.relative_to(out).as_posix(), "size": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
        for path in files
    ]}
    _write_json(out / "manifest.json", manifest)
    _bounded_files(out)
    return report
