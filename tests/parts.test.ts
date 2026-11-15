import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partGeometry, geometryInfo } from '../shared/parts.js';
import { minorUnits, jobInput } from '../shared/validation.js';

test('generated block, drilled plate and tube are closed meshes with correct dimensions and volume', () => {
  for (const spec of [
    { kind: 'block', width: 20, depth: 30, height: 10, hole: 0 },
    { kind: 'plate', width: 60, depth: 40, height: 5, hole: 10 },
    { kind: 'tube', width: 30, depth: 30, height: 20, hole: 15 },
  ] as const) {
    const g = partGeometry({ ...spec }),
      info = geometryInfo(g);
    assert.ok(Math.abs(info.width - spec.width) < 0.01);
    assert.ok(Math.abs(info.height - spec.height) < 0.01);
    const expected =
      spec.kind === 'tube'
        ? Math.PI * ((spec.width / 2) ** 2 - (spec.hole / 2) ** 2) * spec.height
        : (spec.width * spec.depth - Math.PI * (spec.hole / 2) ** 2) * spec.height;
    assert.ok(Math.abs(info.volume - expected) / expected < 0.001);
    const flat = g.index ? g.toNonIndexed() : g,
      p = flat.getAttribute('position'),
      edges = new Map<string, number>();
    const point = (i: number) =>
      [p.getX(i), p.getY(i), p.getZ(i)].map((n) => Math.round(n * 10000)).join(',');
    for (let i = 0; i < p.count; i += 3) {
      for (const [a, b] of [
        [i, i + 1],
        [i + 1, i + 2],
        [i + 2, i],
      ]) {
        const key = [point(a), point(b)].sort().join('|');
        edges.set(key, (edges.get(key) || 0) + 1);
      }
    }
    assert.ok([...edges.values()].every((n) => n === 2));
    if (flat !== g) flat.dispose();
    g.dispose();
  }
});
test('impossible dimensions and ambiguous monetary inputs are rejected', () => {
  assert.throws(() => partGeometry({ kind: 'tube', width: 20, depth: 20, height: 4, hole: 19 }));
  assert.throws(() => partGeometry({ kind: 'block', width: 20, depth: 20, height: -1, hole: 0 }));
  assert.equal(minorUnits('19,99'), 1999);
  assert.equal(minorUnits('0.01'), 1);
  assert.equal(minorUnits(''), null);
  assert.throws(() => minorUnits('1e4'));
  assert.throws(() => minorUnits('1.999'));
  assert.throws(() => minorUnits('Infinity'));
});
