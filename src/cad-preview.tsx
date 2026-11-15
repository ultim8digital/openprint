import { useEffect, useRef, useState } from 'react';
import {
  Box3,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { cadMeshSchema, type CadMesh } from '../shared/cad';
import { ErrorBox, errorText, Loading, useApp } from './core';

export default function CadPreview({ url }: { url: string }) {
  const { t } = useApp();
  const host = useRef<HTMLDivElement>(null);
  const [mesh, setMesh] = useState<CadMesh | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const [selected, setSelected] = useState('');
  const [explode, setExplode] = useState(0);
  const controlsRef = useRef<{ reset: () => void; zoom: (amount: number) => void } | null>(null);
  const updateRef = useRef<((selected: string, explode: number) => void) | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    setMesh(null);
    setPreviewUnavailable(false);
    setSelected('');
    setExplode(0);
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('CAD_MESH_FETCH');
        return cadMeshSchema.parse(await response.json());
      })
      .then(setMesh)
      .catch((reason) => {
        if (reason.name !== 'AbortError') setError(reason);
      });
    return () => controller.abort();
  }, [url]);
  useEffect(() => {
    if (!host.current || !mesh) return;
    const container = host.current;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true });
    } catch {
      setPreviewUnavailable(true);
      return;
    }
    setPreviewUnavailable(false);
    const scene = new Scene();
    scene.background = new Color('#edf2e7');
    const assembly = new Group();
    assembly.rotation.x = -Math.PI / 2;
    const colors = ['#77aa88', '#d1ad72', '#7a9ab6', '#b794b4', '#a7b65f', '#c98e79'];
    const parts: Array<{ id: string; object: Mesh; center: Vector3 }> = [];
    for (const [index, group] of mesh.groups.entries()) {
      const geometry = new BufferGeometry();
      const positions: number[] = [];
      for (let triangle = group.start; triangle < group.start + group.count; triangle++) {
        for (const vertex of mesh.triangles[triangle]!) positions.push(...mesh.vertices[vertex]!);
      }
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      const material = new MeshStandardMaterial({
        color: colors[index % colors.length],
        roughness: 0.68,
        metalness: 0.08,
      });
      const object = new Mesh(geometry, material);
      assembly.add(object);
      parts.push({ id: group.id, object, center: new Vector3(...group.center) });
    }
    scene.add(assembly);
    const box = new Box3().setFromObject(assembly);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const longest = Math.max(size.x, size.y, size.z, 1);
    assembly.position.sub(center);
    assembly.position.y += size.y / 2;
    const camera = new PerspectiveCamera(38, 1, 0.01, Math.max(longest * 200, 10000));
    camera.position.set(longest * 1.5, longest * 1.2, longest * 1.7);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, size.y / 2, 0);
    controls.enableDamping = true;
    controls.minDistance = longest * 0.2;
    controls.maxDistance = longest * 10;
    const initial = camera.position.clone();
    controlsRef.current = {
      reset() {
        camera.position.copy(initial);
        controls.target.set(0, size.y / 2, 0);
        controls.update();
      },
      zoom(amount) {
        camera.position.sub(controls.target).multiplyScalar(amount).add(controls.target);
        controls.update();
      },
    };
    const assemblyCenter = new Vector3();
    for (const part of parts) assemblyCenter.add(part.center);
    assemblyCenter.divideScalar(Math.max(1, parts.length));
    updateRef.current = (visible, amount) => {
      for (const [index, part] of parts.entries()) {
        part.object.visible = !visible || visible === part.id;
        const direction = part.center.clone().sub(assemblyCenter);
        if (direction.lengthSq() < 0.001) direction.set(index % 2 ? 1 : -1, 0, 0.5);
        part.object.position.copy(direction.normalize().multiplyScalar((longest * amount) / 100));
      }
    };
    const grid = new GridHelper(
      Math.max(100, Math.ceil(longest / 25) * 100),
      20,
      '#bdcdb6',
      '#d7e1ce',
    );
    grid.position.y = -0.1;
    scene.add(grid, new HemisphereLight('#fffef5', '#697a58', 2.6));
    const light = new DirectionalLight('#ffffff', 3);
    light.position.set(longest * 2, longest * 4, longest * 3);
    scene.add(light);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.domElement.setAttribute('role', 'img');

    container.appendChild(renderer.domElement);
    const observer = new ResizeObserver(() => {
      const width = container.clientWidth,
        height = container.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    });
    observer.observe(container);
    renderer.setAnimationLoop(() => {
      if (document.visibilityState === 'visible') {
        controls.update();
        renderer.render(scene, camera);
      }
    });
    return () => {
      controlsRef.current = null;
      updateRef.current = null;
      observer.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      for (const part of parts) {
        part.object.geometry.dispose();
        (part.object.material as MeshStandardMaterial).dispose();
      }
      grid.geometry.dispose();
      for (const material of Array.isArray(grid.material) ? grid.material : [grid.material])
        material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [mesh]);
  useEffect(() => {
    host.current
      ?.querySelector('canvas')
      ?.setAttribute(
        'aria-label',
        t(
          'Геометрия CAD. Поверните перетаскиванием или используйте кнопки масштаба.',
          'CAD geometry. Drag to orbit or use the zoom buttons.',
        ),
      );
  }, [t, mesh]);
  useEffect(() => {
    updateRef.current?.(selected, explode);
  }, [selected, explode, mesh]);
  return (
    <div className="cad-preview">
      <ErrorBox
        error={
          previewUnavailable
            ? t(
                '3D-просмотр недоступен. Отчёт и файлы можно скачать ниже.',
                '3D preview is unavailable. The report and files are still available below.',
              )
            : error instanceof Error && error.message === 'CAD_MESH_FETCH'
              ? t('Не удалось загрузить геометрию.', 'Could not load geometry.')
              : error
                ? errorText(error)
                : ''
        }
      />
      {!mesh && !error && <Loading />}
      {mesh && (
        <>
          <div className="cad-preview-tools">
            <label>
              {t('Показать компонент', 'Show component')}
              <select value={selected} onChange={(event) => setSelected(event.target.value)}>
                <option dir="auto" value="">
                  {t('Вся сборка', 'Whole assembly')}
                </option>
                {mesh.groups.map((group) => (
                  <option dir="auto" key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('Разнести компоненты', 'Explode components')} · {explode}%
              <input
                dir="auto"
                type="range"
                min="0"
                max="100"
                value={explode}
                onChange={(event) => setExplode(Number(event.target.value))}
                disabled={mesh.groups.length < 2}
              />
            </label>
          </div>
          <div className="cad-canvas" ref={host}>
            <div className="viewer-actions">
              <button
                type="button"
                aria-label={t('Увеличить CAD-модель', 'Zoom CAD in')}
                onClick={() => controlsRef.current?.zoom(0.8)}
              >
                +
              </button>
              <button
                type="button"
                aria-label={t('Уменьшить CAD-модель', 'Zoom CAD out')}
                onClick={() => controlsRef.current?.zoom(1.25)}
              >
                −
              </button>
              <button
                type="button"
                aria-label={t('Сбросить вид CAD', 'Reset CAD view')}
                onClick={() => controlsRef.current?.reset()}
              >
                ↺
              </button>
            </div>
          </div>
          <p className="studio-help">
            {t(
              'Разнесённый вид служит для просмотра и не изменяет модель или выгрузку.',
              'The exploded view is for inspection and does not change the model or exported files.',
            )}
          </p>
        </>
      )}
    </div>
  );
}
