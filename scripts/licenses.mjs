import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const packages = [
  'react',
  'react-dom',
  'scheduler',
  'react-router',
  'react-router-dom',
  'cookie',
  'set-cookie-parser',
  'three',
  'leaflet',
  'lucide-react',
  'zod',
  'express',
];
let text =
  'OpenPrint - third-party license notices\n\nThe application code is MIT. The following dependencies retain their own copyright and licenses.\n\n';
for (const name of packages) {
  const dir = join('node_modules', name),
    meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')),
    file = readdirSync(dir).find((n) => /^licen[sc]e(\.txt|\.md)?$/i.test(n));
  if (!file) throw new Error('Missing license: ' + name);
  text += `${'='.repeat(72)}\n${name} ${meta.version} (${meta.license || 'see below'})\n${'='.repeat(72)}\n\n${readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n').trimEnd()}\n\n`;
}
mkdirSync('public', { recursive: true });
writeFileSync('public/third-party-licenses.txt', text.trimEnd() + '\n');
console.log('Updated public/third-party-licenses.txt');
