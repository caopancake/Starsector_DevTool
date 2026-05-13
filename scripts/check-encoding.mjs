import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { TextDecoder } from 'node:util';

const root = process.cwd();
const textExtensions = new Set(['.bat', '.css', '.html', '.js', '.json', '.md', '.mjs', '.ps1', '.rs', '.toml', '.ts', '.vue']);
const ignoredDirs = new Set(['.git', 'dist', 'node_modules', 'release', 'target']);
const ignoredPathParts = ['src-tauri\\gen', 'src-tauri/gen', 'src-tauri\\target', 'src-tauri/target'];
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    const rel = relative(root, path);
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name) || ignoredPathParts.some((part) => rel.includes(part))) continue;
      files.push(...(await collectFiles(path)));
      continue;
    }
    const extension = entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.')) : '';
    if (textExtensions.has(extension)) files.push(path);
  }
  return files;
}

const failures = [];
for (const file of await collectFiles(root)) {
  const bytes = await readFile(file);
  const rel = relative(root, file);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    failures.push(`${rel}: UTF-8 BOM is not allowed`);
    continue;
  }
  try {
    utf8Decoder.decode(bytes);
  } catch {
    failures.push(`${rel}: is not valid UTF-8`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Encoding check passed: UTF-8 without BOM.');
