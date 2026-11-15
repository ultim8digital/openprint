import { useEffect, useRef, useState } from 'react';
import {
  Scene,
  Color,
  PerspectiveCamera,
  WebGLRenderer,
  Mesh,
  MeshStandardMaterial,
  HemisphereLight,
  DirectionalLight,
  GridHelper,
  Box3,
  Vector3,
  type BufferGeometry,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useApp } from './core';
export default function ModelViewer({ geometry }: { geometry: BufferGeometry }) {
  const container = useRef<HTMLDivElement>(null),
    [error, setError] = useState(false),
    { t } = useApp(),
    commands = useRef<{ zoom: (factor: number) => void; reset: () => void } | null>(null);
  useEffect(() => {
    const host = container.current;
    if (!host) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setError(true);
      return;
    }
    setError(false);
    const scene = new Scene();
    scene.background = new Color('#edf2e7');
    const material = new MeshStandardMaterial({
        color: '#9bc7a5',
        roughness: 0.7,
        metalness: 0.05,
      }),
      copy = geometry.clone(),
      mesh = new Mesh(copy, material);
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
    const box = new Box3().setFromObject(mesh),
      size = box.getSize(new Vector3()),
      center = box.getCenter(new Vector3()),
      longest = Math.max(size.x, size.y, size.z);
    mesh.position.sub(center);
    mesh.position.y += size.y / 2;
    const camera = new PerspectiveCamera(38, 1, 0.01, Math.max(longest * 100, 1000));
    camera.position.set(longest * 1.45, longest * 1.15, longest * 1.65);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, size.y / 2, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = longest * 0.25;
    controls.maxDistance = longest * 8;
    const initial = camera.position.clone();
    commands.current = {
      zoom(factor) {
        camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);
        controls.update();
      },
      reset() {
        camera.position.copy(initial);
        controls.target.set(0, size.y / 2, 0);
        controls.update();
      },
    };
    const grid = new GridHelper(
      Math.max(100, Math.ceil(longest / 25) * 100),
      20,
      '#c6d4bd',
      '#d7e1ce',
    );
    grid.position.y = -0.05;
    scene.add(grid);
    scene.add(new HemisphereLight('#fffef5', '#697a58', 2.7));
    const light = new DirectionalLight('#fff', 3);
    light.position.set(longest * 2, longest * 4, longest * 3);
    scene.add(light);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    renderer.domElement.setAttribute('role', 'img');
    const observer = new ResizeObserver(() => {
      const width = host.clientWidth,
        height = host.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    observer.observe(host);
    renderer.setAnimationLoop(() => {
      if (document.visibilityState === 'visible') {
        controls.update();
        renderer.render(scene, camera);
      }
    });
    return () => {
      commands.current = null;
      observer.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      copy.dispose();
      material.dispose();
      grid.geometry.dispose();
      for (const m of Array.isArray(grid.material) ? grid.material : [grid.material]) m.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [geometry]);
  useEffect(() => {
    container.current
      ?.querySelector('canvas')
      ?.setAttribute(
        'aria-label',
        t(
          'Трёхмерная модель. Поверните перетаскиванием, измените масштаб колёсиком.',
          '3D preview. Drag to orbit and scroll to zoom.',
        ),
      );
  }, [t, geometry]);
  return (
    <div className="viewer" ref={container}>
      {error ? (
        <div className="info-box">
          {t(
            'Просмотр 3D недоступен в этом браузере. Размеры и экспорт STL продолжат работать.',
            '3D preview is unavailable in this browser. Dimensions and STL export still work.',
          )}
        </div>
      ) : (
        <>
          <span className="viewer-badge">
            {t('OPENPRINT / ПРОСМОТР 3D', 'OPENPRINT / 3D VIEW')}
          </span>
          <div className="viewer-actions">
            <button
              aria-label={t('Увеличить модель', 'Zoom in')}
              onClick={() => commands.current?.zoom(0.8)}
            >
              +
            </button>
            <button
              aria-label={t('Уменьшить модель', 'Zoom out')}
              onClick={() => commands.current?.zoom(1.25)}
            >
              −
            </button>
            <button
              aria-label={t('Сбросить вид', 'Reset view')}
              onClick={() => commands.current?.reset()}
            >
              ↺
            </button>
          </div>
          <span className="viewer-note">
            {t(
              'Потяните, чтобы повернуть · прокрутите для масштаба',
              'Drag to orbit · scroll to zoom',
            )}
          </span>
        </>
      )}
    </div>
  );
}
