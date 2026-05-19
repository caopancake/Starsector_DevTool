import { cratePaths, rustLayerForCratePath, rustLayerForPath } from '../shared/rust-crate-paths.mjs';

const rustDependencyDirection = new Map([
  ['services', new Set(['services', 'domain', 'io', 'parsers', 'models', 'other'])],
  ['domain', new Set(['domain', 'models', 'other'])],
  ['io', new Set(['io', 'parsers', 'models', 'other'])],
  ['parsers', new Set(['parsers', 'models', 'other'])],
  ['models', new Set(['models', 'other'])],
]);

export const rustLowerLayerBoundaryRule = {
  name: 'rust-lower-layer-boundary',
  check(files) {
    const failures = [];
    for (const { rel, text } of files) {
      if (!rel.endsWith('.rs')) continue;
      const ownerLayer = rustLayerForPath(rel);
      const expectedDependencies = rustDependencyDirection.get(ownerLayer);
      if (!expectedDependencies) continue;
      for (const path of cratePaths(text)) {
        const targetLayer = rustLayerForCratePath(path);
        if (targetLayer === 'other' && isOutsideKnownArchitectureRoot(path)) {
          failures.push(`${rel}: unknown internal crate root '${path[0]}'`);
          continue;
        }
        if (!expectedDependencies.has(targetLayer)) {
          failures.push(`${rel}: Rust ${ownerLayer} layer must not depend on ${targetLayer} layer`);
        }
        if (path[0] === 'models' && path[1] === 'payloads' && ownerLayer !== 'commands') {
          failures.push(`${rel}: non-command Rust layers must not depend on command payload models`);
        }
      }
    }
    return failures;
  },
};

function isOutsideKnownArchitectureRoot(path) {
  return !['commands', 'domain', 'errors', 'io', 'models', 'parsers', 'services'].includes(path[0] ?? '');
}
