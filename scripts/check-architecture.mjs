import { collectArchitectureFiles } from './architecture/shared/files.mjs';
import { rules } from './architecture/rules/index.mjs';
import { architectureRulesSelfBoundaryRule } from './architecture/self-boundary.mjs';

const files = await collectArchitectureFiles(process.cwd());
const failures = [];

for (const rule of [architectureRulesSelfBoundaryRule, ...rules]) {
  failures.push(...rule.check(files));
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Architecture check passed.');
