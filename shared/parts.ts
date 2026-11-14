import { BoxGeometry, Shape, Path, ExtrudeGeometry, BufferGeometry, Vector3 } from 'three';
import { z } from 'zod';

export const partSchema = z
  .object({
    kind: z.enum(['block', 'plate', 'tube']),
    width: z.number().min(4).max(300),
    depth: z.number().min(4).max(300),
    height: z.number().min(1).max(300),
    hole: z.number().min(0).max(296),
  })
  .refine(
    (p) =>
      p.kind === 'block' || p.hole < Math.min(p.width, p.kind === 'tube' ? p.width : p.depth) - 2,
    'Keep at least a 1 mm wall / Оставьте стенку не менее 1 мм',
  )
  .refine(
    (p) => p.kind !== 'tube' || p.hole >= 1,
    'The tube needs a hole / У втулки должно быть отверстие',
  );
export type PartSpec = z.infer<typeof partSchema>;
export const defaultPart: PartSpec = { kind: 'plate', width: 70, depth: 45, height: 5, hole: 10 };
export function partGeometry(input: PartSpec): BufferGeometry {
  const p = partSchema.parse(input);
  if (p.kind === 'block') {
    const g = new BoxGeometry(p.width, p.depth, p.height);
    g.translate(0, 0, p.height / 2);
    return g;
  }
  const shape = new Shape();
  if (p.kind === 'tube') shape.absarc(0, 0, p.width / 2, 0, Math.PI * 2, false);
  else {
    shape.moveTo(-p.width / 2, -p.depth / 2);
    shape.lineTo(p.width / 2, -p.depth / 2);
    shape.lineTo(p.width / 2, p.depth / 2);
    shape.lineTo(-p.width / 2, p.depth / 2);
    shape.closePath();
  }
  if (p.hole > 0) {
    const hole = new Path();
    hole.absarc(0, 0, p.hole / 2, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  return new ExtrudeGeometry(shape, {
    depth: p.height,
    bevelEnabled: false,
    curveSegments: 64,
    steps: 1,
  });
}
export function geometryInfo(geometry: BufferGeometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = g.getAttribute('position');
  if (!position || position.count % 3 || position.count > 1500000)
    throw new Error('Model is empty or too complex / Модель пуста или слишком сложна');
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3(),
    cross = new Vector3();
  let signed = 0;
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    if (![...a.toArray(), ...b.toArray(), ...c.toArray()].every(Number.isFinite))
      throw new Error('Invalid model coordinates');
    signed += a.dot(cross.crossVectors(b, c)) / 6;
  }
  g.computeBoundingBox();
  const box = g.boundingBox!;
  const size = box.getSize(new Vector3());
  if (g !== geometry) g.dispose();
  if (size.length() > 1e7 || size.length() === 0)
    throw new Error('Model dimensions are invalid / Некорректные размеры модели');
  return {
    width: size.x,
    depth: size.y,
    height: size.z,
    triangles: position.count / 3,
    volume: Math.abs(signed),
  };
}
