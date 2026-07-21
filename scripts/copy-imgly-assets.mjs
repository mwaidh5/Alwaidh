// Copies the background-removal AI model into public/ so it is served from
// our own origin (Firebase's global CDN) instead of the third-party
// staticimgly.com host, which is slow/blocked on some connections.
//
// We copy only the "small" model plus the onnxruntime WASM runtimes — the
// larger "medium" model is left out to keep the download light. Runs before
// dev and build; the output folder is git-ignored (regenerated from
// node_modules each time).
import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  mkdirSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDist = join(root, 'node_modules', '@imgly', 'background-removal-data', 'dist');
const outDir = join(root, 'public', 'imgly-data');

if (!existsSync(join(dataDist, 'resources.json'))) {
  console.error(
    '[imgly] @imgly/background-removal-data not found in node_modules — run npm install first.',
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(dataDist, 'resources.json'), 'utf8'));

// Keep the small model and every onnxruntime WASM runtime (the browser picks
// one at load time depending on SIMD/threads/WebGPU support — hosting all of
// them avoids a "missing file" failure). The medium model is skipped.
const keep = (key) => key === '/models/small' || key.startsWith('/onnxruntime-web/');

if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const hashes = new Set();
for (const [key, entry] of Object.entries(manifest)) {
  if (!keep(key)) continue;
  for (const chunk of entry.chunks) hashes.add(chunk.hash);
}

// resources.json is copied unchanged; entries we didn't copy (medium model)
// are simply never requested because we force model: 'small'.
writeFileSync(join(outDir, 'resources.json'), JSON.stringify(manifest));

let bytes = 0;
for (const hash of hashes) {
  const src = join(dataDist, hash);
  copyFileSync(src, join(outDir, hash));
  bytes += readFileSync(src).length;
}

console.log(
  `[imgly] Copied ${hashes.size} model files (${(bytes / 1048576).toFixed(0)} MB) to public/imgly-data/`,
);
