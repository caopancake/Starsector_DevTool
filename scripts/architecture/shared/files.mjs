import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ignoredDirs = new Set(['.git', 'dist', 'node_modules', 'release', 'target']);
const ignoredPathParts = ['src-tauri\\gen', 'src-tauri/gen', 'src-tauri\\target', 'src-tauri/target'];
const architectureExtensions = new Set(['.json', '.rs', '.ts', '.vue']);

export async function collectArchitectureFiles(root) {
  const paths = await collectPaths(root, root);
  return Promise.all(
    paths.map(async (path) => ({
      path,
      rel: normalizePath(relative(root, path)),
      text: await readFile(path, 'utf8'),
    })),
  );
}

export function frontendFile(path) {
  return path.endsWith('.ts') || path.endsWith('.vue');
}

export function rustFile(path) {
  return path.endsWith('.rs');
}

async function collectPaths(root, dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    const rel = normalizePath(relative(root, path));
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name) || ignoredPathParts.some((part) => rel.includes(normalizePath(part)))) continue;
      files.push(...(await collectPaths(root, path)));
      continue;
    }
    const extension = entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.')) : '';
    if (architectureExtensions.has(extension) && (extension !== '.json' || rel.startsWith('schemas/'))) files.push(path);
  }
  return files;
}

function normalizePath(path) {
  return path.replace(/\\/g, '/');
}
