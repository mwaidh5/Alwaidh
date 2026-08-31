// Copies pdf.js's character maps and standard fonts into public/ so the
// in-app PDF viewer can read them from our own origin.
//
// Without the cMaps, a PDF whose Arabic text uses CID-encoded fonts —
// which is most Arabic PDFs, including the bank's — renders through the
// wrong glyph table: the letters come out shuffled and unjoined. The
// standard fonts do the same job for PDFs that reference the base-14
// fonts without embedding them.
//
// Runs before dev and build; the output folder is git-ignored and
// regenerated from node_modules each time.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = join(root, 'node_modules', 'pdfjs-dist');
const outDir = join(root, 'public', 'pdf-assets');

if (!existsSync(pkg)) {
  console.error('[pdf] pdfjs-dist not found in node_modules — run npm install first.');
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const folder of ['cmaps', 'standard_fonts']) {
  const from = join(pkg, folder);
  if (!existsSync(from)) {
    console.error(`[pdf] ${folder} missing from pdfjs-dist — Arabic PDFs may render wrong.`);
    process.exit(1);
  }
  cpSync(from, join(outDir, folder), { recursive: true });
  console.log(`[pdf] copied ${folder}`);
}
