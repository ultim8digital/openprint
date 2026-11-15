import { Mesh, MeshBasicMaterial, BufferGeometry } from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { partGeometry, geometryInfo, type PartSpec } from '../shared/parts';

export function partFile(spec: PartSpec) {
  const geometry = partGeometry(spec),
    material = new MeshBasicMaterial(),
    mesh = new Mesh(geometry, material);
  try {
    const result = new STLExporter().parse(mesh, { binary: true });
    return new File(
      [result.buffer as ArrayBuffer],
      `openprint-${spec.kind}-${spec.width}x${spec.depth}x${spec.height}.stl`,
      { type: 'application/octet-stream' },
    );
  } finally {
    geometry.dispose();
    material.dispose();
  }
}
export function downloadFile(file: File) {
  const url = URL.createObjectURL(file),
    link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export async function readModel(file: File): Promise<BufferGeometry> {
  if (file.size > 20 * 1024 * 1024) throw new Error('Maximum file size: 20 MB / Максимум 20 МБ');
  let geometry: BufferGeometry;
  if (file.name.toLowerCase().endsWith('.stl'))
    geometry = new STLLoader().parse(await file.arrayBuffer());
  else if (file.name.toLowerCase().endsWith('.obj')) {
    const group = new OBJLoader().parse(await file.text()),
      geometries: BufferGeometry[] = [];
    group.updateMatrixWorld(true);
    group.traverse((node) => {
      if (node instanceof Mesh) {
        let g = node.geometry.clone().applyMatrix4(node.matrixWorld);
        if (g.index) {
          const flat = g.toNonIndexed();
          g.dispose();
          g = flat;
        }
        for (const attribute of Object.keys(g.attributes))
          if (attribute !== 'position') g.deleteAttribute(attribute);
        g.computeVertexNormals();
        geometries.push(g);
        node.geometry.dispose();
        for (const material of Array.isArray(node.material) ? node.material : [node.material])
          material.dispose();
      }
    });
    geometry = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    if (!geometry) throw new Error('No model found / В файле не найдена модель');
  } else
    throw new Error(
      'Local preview supports STL and OBJ. STEP, 3MF and GLB can be attached to a project without preview / Просмотр: STL и OBJ. STEP, 3MF и GLB можно приложить к проекту без просмотра',
    );
  try {
    geometryInfo(geometry);
    return geometry;
  } catch (error) {
    geometry.dispose();
    throw error;
  }
}
