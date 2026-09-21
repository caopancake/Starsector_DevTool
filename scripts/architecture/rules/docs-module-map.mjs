import { singleFileByRel } from '../shared/files.mjs';

const SECTION_ORDER = ['定义', '参考', '边界', '链路', '规范', '陷阱'];
const MIN_SECTION_LINES = { 参考: 3, 边界: 5, 规范: 5, 陷阱: 3 };
const MAX_DEFINITION_LINES = 1;
const MAX_DOC_LINES = 300;

export const docsModuleMapRule = {
  name: 'docs-module-map',
  check(files) {
    const failures = [];
    const moduleMap = singleFileByRel(files, '.zcode/module-map.md');
    if (!moduleMap) {
      return ['.zcode/module-map.md: module map index file is missing'];
    }

    const docFiles = files.filter((file) => file.rel.startsWith('.zcode/modules/') && file.rel.endsWith('.md'));
    const indexed = extractIndexedDocs(moduleMap.text);
    const onDisk = new Set(docFiles.map((file) => file.rel.replace(/^\.zcode\//, '')));

    for (const entry of indexed) {
      if (!onDisk.has(entry.rel)) {
        failures.push(`.zcode/module-map.md: indexed doc ${entry.rel} does not exist`);
      }
    }
    for (const rel of onDisk) {
      if (!indexed.some((entry) => entry.rel === rel)) {
        failures.push(`${rel}: module doc exists but is not indexed in module map`);
      }
    }
    if (indexed.length !== new Set(indexed.map((entry) => entry.rel)).size) {
      failures.push('.zcode/module-map.md: module map indexes a doc more than once');
    }

    for (const file of docFiles) {
      const rel = file.rel.replace(/^\.zcode\//, '');
      failures.push(...checkDocStructure(rel, file.text));
    }
    return failures;
  },
};

function extractIndexedDocs(text) {
  const entries = [];
  for (const match of text.matchAll(/\]\(modules\/([a-z0-9-]+\.md)\)/g)) {
    entries.push({ rel: `modules/${match[1]}` });
  }
  return entries;
}

function checkDocStructure(rel, text) {
  const failures = [];
  const lines = text.split('\n');
  if (lines.length > MAX_DOC_LINES) {
    failures.push(`${rel}: module doc exceeds ${MAX_DOC_LINES} lines (${lines.length})`);
  }

  const headingIndexes = SECTION_ORDER.map((name) => lines.findIndex((line) => line.trim() === `## ${name}`));
  SECTION_ORDER.forEach((name, index) => {
    if (headingIndexes[index] < 0) {
      failures.push(`${rel}: missing required section ${name}`);
    }
    if (index > 0 && headingIndexes[index - 1] >= 0 && headingIndexes[index] >= 0 && headingIndexes[index] < headingIndexes[index - 1]) {
      failures.push(`${rel}: section ${name} must follow the fixed section order`);
    }
  });
  if (headingIndexes.some((index) => index < 0)) return failures;

  for (let index = 0; index < SECTION_ORDER.length; index += 1) {
    const body = sectionBody(lines, headingIndexes[index], headingIndexes[index + 1] ?? lines.length);
    const name = SECTION_ORDER[index];
    if (name === '定义') {
      if (body.contentLines.length > MAX_DEFINITION_LINES) {
        failures.push(`${rel}: 定义 must not exceed ${MAX_DEFINITION_LINES} line`);
      }
      continue;
    }
    if (name === '链路') continue;
    const min = MIN_SECTION_LINES[name];
    if (min && body.contentLines.length < min) {
      failures.push(`${rel}: ${name} must have at least ${min} content lines (found ${body.contentLines.length})`);
    }
  }
  return failures;
}

function sectionBody(lines, start, end) {
  const contentLines = [];
  for (let index = start + 1; index < end; index += 1) {
    const line = lines[index].trim();
    if (line.startsWith('## ')) break;
    if (line) contentLines.push(line);
  }
  return { contentLines };
}
